import { db } from './db';
import { unifiedBillingPlans } from '@shared/schema';

async function seedBillingPlans() {
  console.log('🌱 Seeding billing plans...');

  try {
    // Clear existing plans (optional - comment out if you want to keep existing)
    await db().delete(unifiedBillingPlans);

    // Use a special platform organization ID for system-created plans
    const PLATFORM_ORG_ID = 'platform-system';

    // ============== FREE TRIAL PLANS ==============
    const freeTrialPlans = [
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'end_customer' as const,
        name: 'Free Trial',
        planType: 'credit_pack',
        description: 'Get started with $15 in free credits - no credit card required',
        billingCycle: null,
        basePrice: '0',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          includedCredits: 15,
          maxAgents: 1,
          maxMinutesPerMonth: 100,
          maxUsers: 1,
          apiAccess: false,
          customBranding: false,
          whitelabel: false,
          supportLevel: 'community'
        },
        isActive: true,
        displayOrder: 0,
      },
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'agency' as const,
        name: 'Agency Free Trial',
        planType: 'credit_pack',
        description: 'Start your agency with $25 in free credits - no credit card required',
        billingCycle: null,
        basePrice: '0',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          includedCredits: 25,
          maxAgents: 3,
          maxMinutesPerMonth: 150,
          maxUsers: 3,
          apiAccess: false,
          customBranding: true,
          whitelabel: false,
          supportLevel: 'priority'
        },
        isActive: true,
        displayOrder: 0,
      }
    ];

    // ============== CUSTOMER PAID PLANS (20% below market) ==============
    const customerPlans = [
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'end_customer' as const,
        name: 'Starter',
        planType: 'subscription',
        description: 'Perfect for small businesses getting started with voice AI',
        billingCycle: 'monthly',
        basePrice: '23',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          maxAgents: 1,
          maxMinutesPerMonth: 50,
          maxUsers: 2,
          perMinuteRate: 0.12,
          apiAccess: false,
          customBranding: false,
          whitelabel: false,
          supportLevel: 'email'
        },
        isActive: true,
        displayOrder: 1,
      },
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'end_customer' as const,
        name: 'Growth',
        planType: 'subscription',
        description: 'Scale your voice AI operations with more agents and minutes',
        billingCycle: 'monthly',
        basePrice: '79',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          maxAgents: 3,
          maxMinutesPerMonth: 300,
          maxUsers: 5,
          perMinuteRate: 0.10,
          apiAccess: false,
          customBranding: false,
          whitelabel: false,
          supportLevel: 'priority'
        },
        isActive: true,
        isPopular: true,
        displayOrder: 2,
      },
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'end_customer' as const,
        name: 'Professional',
        planType: 'subscription',
        description: 'Professional features for growing companies',
        billingCycle: 'monthly',
        basePrice: '239',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          maxAgents: 10,
          maxMinutesPerMonth: 1000,
          maxUsers: 15,
          perMinuteRate: 0.08,
          apiAccess: true,
          customBranding: false,
          whitelabel: false,
          supportLevel: 'dedicated'
        },
        isActive: true,
        displayOrder: 3,
      },
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'end_customer' as const,
        name: 'Enterprise',
        planType: 'subscription',
        description: 'Unlimited scale for enterprise operations',
        billingCycle: 'monthly',
        basePrice: '639',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          maxAgents: 999,
          maxMinutesPerMonth: 3000,
          maxUsers: 999,
          perMinuteRate: 0.06,
          apiAccess: true,
          customBranding: true,
          whitelabel: true,
          supportLevel: '24/7'
        },
        isActive: true,
        displayOrder: 4,
      }
    ];

    // ============== AGENCY PLANS (35% below market) ==============
    const agencyPlans = [
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'agency' as const,
        name: 'Agency Starter',
        planType: 'subscription',
        description: 'Start your voice AI agency business',
        billingCycle: 'monthly',
        basePrice: '97',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          maxAgents: 10,
          maxMinutesPerMonth: 500,
          maxUsers: 10,
          perMinuteRate: 0.10,
          apiAccess: true,
          customBranding: true,
          whitelabel: true,
          supportLevel: 'priority'
        },
        isActive: true,
        displayOrder: 10,
      },
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'agency' as const,
        name: 'Agency Growth',
        planType: 'subscription',
        description: 'Scale your agency with more clients and features',
        billingCycle: 'monthly',
        basePrice: '259',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          maxAgents: 50,
          maxMinutesPerMonth: 2000,
          maxUsers: 50,
          perMinuteRate: 0.08,
          apiAccess: true,
          customBranding: true,
          whitelabel: true,
          supportLevel: 'priority'
        },
        isActive: true,
        isPopular: true,
        displayOrder: 11,
      },
      {
        createdByOrganizationId: PLATFORM_ORG_ID,
        organizationType: 'agency' as const,
        name: 'Agency Scale',
        planType: 'subscription',
        description: 'Enterprise agency solution with maximum flexibility',
        billingCycle: 'monthly',
        basePrice: '649',
        platformFeePercentage: '30',
        agencyMarginPercentage: '0',
        features: {
          maxAgents: 999,
          maxMinutesPerMonth: 10000,
          maxUsers: 999,
          perMinuteRate: 0.06,
          apiAccess: true,
          customBranding: true,
          whitelabel: true,
          supportLevel: 'dedicated'
        },
        isActive: true,
        displayOrder: 12,
      }
    ];

    // Insert all plans
    const allPlans = [...freeTrialPlans, ...customerPlans, ...agencyPlans];
    
    for (const plan of allPlans) {
      await db().insert(unifiedBillingPlans).values({
        ...plan,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(`✅ Successfully seeded ${allPlans.length} billing plans`);
    console.log('   - 2 free trial plans');
    console.log('   - 4 customer plans (20% below market)');
    console.log('   - 3 agency plans (35% below market)');
    console.log('\n📊 Pricing Summary:');
    console.log('   Customer Plans: $0 (trial), $23, $79, $239, $639');
    console.log('   Agency Plans: $0 (trial), $97, $259, $649');
    console.log('   Revenue Split: 70% to agencies, 30% to platform');

  } catch (error) {
    console.error('❌ Error seeding billing plans:', error);
    throw error;
  }
}

// Run the seed function
seedBillingPlans()
  .then(() => {
    console.log('✨ Billing plans seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed billing plans:', error);
    process.exit(1);
  });