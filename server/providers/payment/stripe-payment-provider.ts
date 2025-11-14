/**
 * Stripe Payment Provider
 * Wraps existing Stripe integration into the unified payment interface
 */

import { BasePaymentProvider, type PaymentConfig, type Customer, type PaymentIntent, type CreatePaymentIntentOptions, type Subscription, type CreateSubscriptionOptions, type Refund, type WebhookEvent } from '../payment-provider';

export class StripePaymentProvider extends BasePaymentProvider {
  private stripe: any;

  constructor(config: PaymentConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    this.validateConfig();
    this.log('Initializing Stripe provider...');

    try {
      // Dynamically import Stripe
      const Stripe = (await import('stripe')).default;

      this.stripe = new Stripe(this.config.secretKey!, {
        apiVersion: '2024-11-20.acacia' as any,
      });

      this.ready = true;
      this.log('Stripe provider initialized successfully');
    } catch (error: any) {
      this.log(`Failed to initialize: ${error.message}`, 'error');
      throw error;
    }
  }

  getProviderName(): string {
    return 'stripe';
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, any>): Promise<Customer> {
    if (!this.ready) await this.initialize();

    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata,
      });

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: customer.metadata,
      };
    } catch (error: any) {
      this.log(`Failed to create customer: ${error.message}`, 'error');
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    if (!this.ready) await this.initialize();

    try {
      const customer = await this.stripe.customers.retrieve(customerId);

      if (customer.deleted) return null;

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: customer.metadata,
      };
    } catch (error: any) {
      this.log(`Failed to get customer: ${error.message}`, 'error');
      return null;
    }
  }

  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    if (!this.ready) await this.initialize();

    try {
      const customer = await this.stripe.customers.update(customerId, updates);

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        metadata: customer.metadata,
      };
    } catch (error: any) {
      this.log(`Failed to update customer: ${error.message}`, 'error');
      throw error;
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    if (!this.ready) await this.initialize();

    try {
      await this.stripe.customers.del(customerId);
    } catch (error: any) {
      this.log(`Failed to delete customer: ${error.message}`, 'error');
      throw error;
    }
  }

  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent> {
    if (!this.ready) await this.initialize();

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: options.amount,
        currency: options.currency,
        customer: options.customerId,
        payment_method: options.paymentMethodId,
        description: options.description,
        metadata: options.metadata,
        capture_method: options.captureMethod || 'automatic',
      });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        metadata: paymentIntent.metadata,
      };
    } catch (error: any) {
      this.log(`Failed to create payment intent: ${error.message}`, 'error');
      throw error;
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null> {
    if (!this.ready) await this.initialize();

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        metadata: paymentIntent.metadata,
      };
    } catch (error: any) {
      this.log(`Failed to get payment intent: ${error.message}`, 'error');
      return null;
    }
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    if (!this.ready) await this.initialize();

    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        metadata: paymentIntent.metadata,
      };
    } catch (error: any) {
      this.log(`Failed to confirm payment intent: ${error.message}`, 'error');
      throw error;
    }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    if (!this.ready) await this.initialize();

    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'canceled',
        metadata: paymentIntent.metadata,
      };
    } catch (error: any) {
      this.log(`Failed to cancel payment intent: ${error.message}`, 'error');
      throw error;
    }
  }

  async createSubscription(options: CreateSubscriptionOptions): Promise<Subscription> {
    if (!this.ready) await this.initialize();

    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: options.customerId,
        items: options.items.map(item => ({
          price: item.priceId,
          quantity: item.quantity || 1,
        })),
        trial_period_days: options.trialPeriodDays,
        metadata: options.metadata,
      });

      return {
        id: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items: subscription.items.data.map((item: any) => ({
          id: item.id,
          priceId: item.price.id,
          quantity: item.quantity,
        })),
      };
    } catch (error: any) {
      this.log(`Failed to create subscription: ${error.message}`, 'error');
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    if (!this.ready) await this.initialize();

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      return {
        id: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items: subscription.items.data.map((item: any) => ({
          id: item.id,
          priceId: item.price.id,
          quantity: item.quantity,
        })),
      };
    } catch (error: any) {
      this.log(`Failed to get subscription: ${error.message}`, 'error');
      return null;
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = false): Promise<Subscription> {
    if (!this.ready) await this.initialize();

    try {
      const subscription = cancelAtPeriodEnd
        ? await this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
        : await this.stripe.subscriptions.cancel(subscriptionId);

      return {
        id: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items: subscription.items.data.map((item: any) => ({
          id: item.id,
          priceId: item.price.id,
          quantity: item.quantity,
        })),
      };
    } catch (error: any) {
      this.log(`Failed to cancel subscription: ${error.message}`, 'error');
      throw error;
    }
  }

  async updateSubscription(subscriptionId: string, updates: Partial<CreateSubscriptionOptions>): Promise<Subscription> {
    if (!this.ready) await this.initialize();

    try {
      const updateParams: any = { metadata: updates.metadata };

      if (updates.items) {
        updateParams.items = updates.items.map(item => ({
          price: item.priceId,
          quantity: item.quantity || 1,
        }));
      }

      const subscription = await this.stripe.subscriptions.update(subscriptionId, updateParams);

      return {
        id: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items: subscription.items.data.map((item: any) => ({
          id: item.id,
          priceId: item.price.id,
          quantity: item.quantity,
        })),
      };
    } catch (error: any) {
      this.log(`Failed to update subscription: ${error.message}`, 'error');
      throw error;
    }
  }

  async createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Refund> {
    if (!this.ready) await this.initialize();

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason,
      });

      return {
        id: refund.id,
        amount: refund.amount,
        status: refund.status,
        reason: refund.reason,
      };
    } catch (error: any) {
      this.log(`Failed to create refund: ${error.message}`, 'error');
      throw error;
    }
  }

  async constructWebhookEvent(payload: string | Buffer, signature: string, secret?: string): Promise<WebhookEvent> {
    if (!this.ready) await this.initialize();

    try {
      const webhookSecret = secret || this.config.webhookSecret;
      if (!webhookSecret) {
        throw new Error('Webhook secret is required');
      }

      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      return {
        id: event.id,
        type: event.type,
        data: event.data.object,
        created: new Date(event.created * 1000),
      };
    } catch (error: any) {
      this.log(`Failed to construct webhook event: ${error.message}`, 'error');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.ready) return false;

      // Simple API check
      await this.stripe.paymentIntents.list({ limit: 1 });
      return true;
    } catch (error: any) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }
}
