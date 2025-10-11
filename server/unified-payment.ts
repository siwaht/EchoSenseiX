import Stripe from 'stripe';
import { Request, Response } from 'express';
import { db } from './db';
import { 
  organizations, 
  payments, 
  paymentSplits,
  unifiedBillingPlans,
  unifiedSubscriptions,
  agencyCommissions
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

// Initialize Stripe with platform account (lazy initialization)
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    });
  }
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}

// Calculate payment splits based on plan configuration
export function calculatePaymentSplits(
  amount: number,
  platformFeePercentage: number,
  agencyMarginPercentage: number = 0
) {
  const platformFee = (amount * platformFeePercentage) / 100;
  const agencyAmount = amount - platformFee;
  
  return {
    platformAmount: platformFee,
    agencyAmount: agencyAmount,
    totalAmount: amount
  };
}

// Create a Stripe Connect account for an agency
export async function createStripeConnectAccount(req: Request, res: Response) {
  try {
    const { organizationId } = req.body;
    
    // Get organization details
    const [org] = await db()
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
      
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    // Create Stripe Connect account
    const account = await getStripe().accounts.create({
      type: 'express',
      country: 'US',
      email: org.name.toLowerCase().replace(/\s/g, '') + '@agency.com',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: 'company',
      company: {
        name: org.name,
      },
    });
    
    // Update organization with Stripe Connect account ID
    await db()
      .update(organizations)
      .set({ stripeConnectAccountId: account.id })
      .where(eq(organizations.id, organizationId));
    
    // Create account link for onboarding
    const accountLink = await getStripe().accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/agency/billing-settings`,
      return_url: `${process.env.FRONTEND_URL}/agency/billing-settings?connected=true`,
      type: 'account_onboarding',
    });
    
    res.json({ 
      accountId: account.id,
      onboardingUrl: accountLink.url 
    });
  } catch (error: any) {
    console.error('Error creating Stripe Connect account:', error);
    res.status(500).json({ 
      error: 'Failed to create Stripe Connect account',
      message: error.message 
    });
  }
}

// Create unified payment intent with automatic splitting
export async function createUnifiedPaymentIntent(req: Request, res: Response) {
  try {
    const { 
      organizationId, // Customer organization
      planId,         // Unified billing plan
      amount,
      metadata = {}
    } = req.body;
    
    // Get the plan details
    const [plan] = await db()
      .select()
      .from(unifiedBillingPlans)
      .where(eq(unifiedBillingPlans.id, planId));
      
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Get customer organization
    const [customerOrg] = await db()
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
      
    if (!customerOrg) {
      return res.status(404).json({ error: 'Customer organization not found' });
    }
    
    // Get agency organization if customer has a parent
    let agencyOrg = null;
    if (customerOrg.parentOrganizationId) {
      [agencyOrg] = await db()
        .select()
        .from(organizations)
        .where(eq(organizations.id, customerOrg.parentOrganizationId));
    }
    
    // Calculate payment splits
    const splits = calculatePaymentSplits(
      amount,
      Number(plan.platformFeePercentage),
      Number(plan.agencyMarginPercentage)
    );
    
    // Create payment intent with platform account
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        ...metadata,
        organizationId,
        planId,
        platformAmount: splits.platformAmount.toString(),
        agencyAmount: splits.agencyAmount.toString(),
        agencyOrgId: agencyOrg?.id || '',
      },
      // If agency has Stripe Connect, set up for automatic transfer
      ...(agencyOrg?.stripeConnectAccountId && {
        transfer_data: {
          destination: agencyOrg.stripeConnectAccountId,
          amount: Math.round(splits.agencyAmount * 100),
        },
      }),
    });
    
    // Record the payment attempt
    const [payment] = await db()
      .insert(payments)
      .values({
        organizationId,
        planId,
        amount: amount.toString(),
        platformAmount: splits.platformAmount.toString(),
        agencyAmount: splits.agencyAmount.toString(),
        status: 'pending',
        paymentMethod: 'stripe',
        transactionId: paymentIntent.id,
      })
      .returning();
    
    // Create payment split records
    if (agencyOrg) {
      // Platform fee split
      await db().insert(paymentSplits).values({
        paymentId: payment.id,
        fromOrganizationId: organizationId,
        toOrganizationId: 'platform', // Special ID for platform
        splitType: 'platform_fee',
        amount: splits.platformAmount.toString(),
        percentage: plan.platformFeePercentage,
        transferStatus: 'pending',
      });
      
      // Agency revenue split
      await db().insert(paymentSplits).values({
        paymentId: payment.id,
        fromOrganizationId: organizationId,
        toOrganizationId: agencyOrg.id,
        splitType: 'agency_revenue',
        amount: splits.agencyAmount.toString(),
        percentage: (100 - Number(plan.platformFeePercentage)).toString(),
        transferStatus: 'pending',
      });
    }
    
    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      splits: splits
    });
  } catch (error: any) {
    console.error('Error creating unified payment intent:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      message: error.message 
    });
  }
}

// Handle payment confirmation and execute splits
export async function confirmUnifiedPayment(req: Request, res: Response) {
  try {
    const { paymentIntentId } = req.body;
    
    // Retrieve the payment intent from Stripe
    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update payment status
      await db()
        .update(payments)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(payments.transactionId, paymentIntentId));
      
      // Get payment splits
      const [payment] = await db()
        .select()
        .from(payments)
        .where(eq(payments.transactionId, paymentIntentId));
        
      if (payment) {
        // Update payment splits as completed
        await db()
          .update(paymentSplits)
          .set({
            transferStatus: 'completed',
            transferredAt: new Date(),
            stripeTransferId: paymentIntent.id
          })
          .where(eq(paymentSplits.paymentId, payment.id));
        
        // Create commission record for agency
        if (payment.agencyAmount && Number(payment.agencyAmount) > 0) {
          const metadata = paymentIntent.metadata;
          if (metadata.agencyOrgId) {
            await db().insert(agencyCommissions).values({
              agencyOrganizationId: metadata.agencyOrgId,
              customerOrganizationId: metadata.organizationId,
              paymentId: payment.id,
              amount: payment.agencyAmount,
              rate: '70', // Agency keeps 70% (100% - 30% platform fee)
              status: 'paid',
              paidAt: new Date(),
              description: `Commission from payment ${paymentIntentId}`
            });
          }
        }
      }
      
      res.json({ 
        success: true, 
        status: 'completed',
        paymentId: payment?.id 
      });
    } else {
      res.json({ 
        success: false, 
        status: paymentIntent.status 
      });
    }
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ 
      error: 'Failed to confirm payment',
      message: error.message 
    });
  }
}

// Create unified subscription
export async function createUnifiedSubscription(req: Request, res: Response) {
  try {
    const { 
      organizationId, // Customer organization
      planId,         // Unified billing plan
      paymentMethodId // Stripe payment method ID
    } = req.body;
    
    // Get the plan details
    const [plan] = await db()
      .select()
      .from(unifiedBillingPlans)
      .where(eq(unifiedBillingPlans.id, planId));
      
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Get or create Stripe customer
    const [org] = await db()
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
      
    let customerId = org.stripeCustomerId;
    
    if (!customerId) {
      const customer = await getStripe().customers.create({
        metadata: {
          organizationId: organizationId
        }
      });
      customerId = customer.id;
      
      await db()
        .update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, organizationId));
    }
    
    // Attach payment method to customer
    await getStripe().paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    // Set as default payment method
    await getStripe().customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    // Create subscription with Stripe
    const subscription = await getStripe().subscriptions.create({
      customer: customerId,
      items: [{
        price: plan.stripePriceId!,
      }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        organizationId,
        planId,
      },
    }) as any; // Cast to any to avoid Response wrapper type issues
    
    // Create unified subscription record
    const [unifiedSub] = await db()
      .insert(unifiedSubscriptions)
      .values({
        organizationId,
        planId,
        status: 'active',
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        currentUsage: {},
      })
      .returning();
    
    res.json({ 
      subscriptionId: unifiedSub.id,
      stripeSubscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ 
      error: 'Failed to create subscription',
      message: error.message 
    });
  }
}

// Handle Stripe webhooks for unified billing
export async function handleUnifiedWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  let event: Stripe.Event;
  
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  try {
    // Handle different event types - cast to any to avoid strict type checking
    const eventType = event.type as any;
    
    if (eventType === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Update payment status
      await db()
        .update(payments)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(payments.transactionId, paymentIntent.id));
      
      // Execute payment splits
      await executePaymentSplits(paymentIntent.id);
    } 
    else if (eventType === 'subscription.created' || eventType === 'subscription.updated') {
      const subscription = event.data.object as any; // Cast to any to access all properties
      
      // Update subscription status
      await db()
        .update(unifiedSubscriptions)
        .set({
          status: subscription.status as any,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        })
        .where(eq(unifiedSubscriptions.stripeSubscriptionId, subscription.id));
    }
    else if (eventType === 'invoice.payment_succeeded') {
      const invoice = event.data.object as any; // Cast to any to access all properties
      
      // Create payment record for subscription payment
      if (invoice.subscription && invoice.payment_intent) {
        const metadata = invoice.metadata;
        if (metadata && metadata.planId && metadata.organizationId) {
          const [plan] = await db()
            .select()
            .from(unifiedBillingPlans)
            .where(eq(unifiedBillingPlans.id, metadata.planId));
            
          if (plan) {
            const splits = calculatePaymentSplits(
              invoice.amount_paid / 100,
              Number(plan.platformFeePercentage),
              Number(plan.agencyMarginPercentage)
            );
            
            const paymentIntentId = typeof invoice.payment_intent === 'string' 
              ? invoice.payment_intent 
              : invoice.payment_intent?.id || '';
            
            await db().insert(payments).values({
              organizationId: metadata.organizationId,
              planId: metadata.planId,
              amount: (invoice.amount_paid / 100).toString(),
              platformAmount: splits.platformAmount.toString(),
              agencyAmount: splits.agencyAmount.toString(),
              status: 'completed',
              paymentMethod: 'stripe',
              transactionId: paymentIntentId,
              completedAt: new Date(),
            });
          }
        }
      }
    }
    else if (eventType === 'customer.subscription.deleted') {
      const deletedSub = event.data.object as Stripe.Subscription;
      
      // Cancel subscription
      await db()
        .update(unifiedSubscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
        })
        .where(eq(unifiedSubscriptions.stripeSubscriptionId, deletedSub.id));
    }
    
    res.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Execute payment splits after successful payment
async function executePaymentSplits(paymentIntentId: string) {
  try {
    // Get payment and splits
    const [payment] = await db()
      .select()
      .from(payments)
      .where(eq(payments.transactionId, paymentIntentId));
      
    if (!payment) return;
    
    const splits = await db()
      .select()
      .from(paymentSplits)
      .where(eq(paymentSplits.paymentId, payment.id));
    
    for (const split of splits) {
      if (split.splitType === 'agency_revenue' && split.toOrganizationId !== 'platform') {
        // Get agency organization
        const [agencyOrg] = await db()
          .select()
          .from(organizations)
          .where(eq(organizations.id, split.toOrganizationId));
        
        if (agencyOrg?.stripeConnectAccountId) {
          try {
            // Create transfer to agency's Stripe Connect account
            const transfer = await getStripe().transfers.create({
              amount: Math.round(Number(split.amount) * 100),
              currency: 'usd',
              destination: agencyOrg.stripeConnectAccountId,
              transfer_group: paymentIntentId,
              metadata: {
                paymentId: payment.id,
                splitId: split.id,
              },
            });
            
            // Update split with transfer ID
            await db()
              .update(paymentSplits)
              .set({
                transferStatus: 'completed',
                stripeTransferId: transfer.id,
                transferredAt: new Date(),
              })
              .where(eq(paymentSplits.id, split.id));
          } catch (error) {
            console.error('Error creating transfer:', error);
            
            // Update split with error
            await db()
              .update(paymentSplits)
              .set({
                transferStatus: 'failed',
                failureReason: (error as any).message,
                retryCount: sql`${paymentSplits.retryCount} + 1`,
              })
              .where(eq(paymentSplits.id, split.id));
          }
        }
      } else if (split.splitType === 'platform_fee') {
        // Platform fee is automatically kept, just update status
        await db()
          .update(paymentSplits)
          .set({
            transferStatus: 'completed',
            transferredAt: new Date(),
          })
          .where(eq(paymentSplits.id, split.id));
      }
    }
  } catch (error) {
    console.error('Error executing payment splits:', error);
  }
}

// Get payment analytics for unified billing
export async function getUnifiedPaymentAnalytics(req: Request, res: Response) {
  try {
    const { organizationId, startDate, endDate } = req.query;
    
    // Build query conditions
    const conditions = [];
    if (organizationId) {
      conditions.push(eq(payments.organizationId, organizationId as string));
    }
    
    // Get payments with splits
    const paymentsData = await db()
      .select({
        payment: payments,
        splits: sql<any>`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ${paymentSplits.id},
                'splitType', ${paymentSplits.splitType},
                'amount', ${paymentSplits.amount},
                'toOrganizationId', ${paymentSplits.toOrganizationId},
                'transferStatus', ${paymentSplits.transferStatus}
              )
            ) FILTER (WHERE ${paymentSplits.id} IS NOT NULL),
            '[]'::json
          )
        `,
      })
      .from(payments)
      .leftJoin(paymentSplits, eq(payments.id, paymentSplits.paymentId))
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(payments.id);
    
    // Calculate totals
    const totals = paymentsData.reduce((acc, { payment }) => {
      if (payment.status === 'completed') {
        acc.totalRevenue += Number(payment.amount);
        acc.platformRevenue += Number(payment.platformAmount || 0);
        acc.agencyRevenue += Number(payment.agencyAmount || 0);
        acc.completedPayments += 1;
      } else if (payment.status === 'pending') {
        acc.pendingPayments += 1;
      } else if (payment.status === 'failed') {
        acc.failedPayments += 1;
      }
      return acc;
    }, {
      totalRevenue: 0,
      platformRevenue: 0,
      agencyRevenue: 0,
      completedPayments: 0,
      pendingPayments: 0,
      failedPayments: 0,
    });
    
    res.json({
      payments: paymentsData,
      totals,
    });
  } catch (error: any) {
    console.error('Error getting payment analytics:', error);
    res.status(500).json({ 
      error: 'Failed to get payment analytics',
      message: error.message 
    });
  }
}