/**
 * Payment Provider Factory
 */

import type { PaymentProvider, PaymentConfig } from './payment-provider';
import { StripePaymentProvider } from './payment/stripe-payment-provider';

export class PaymentProviderFactory {
  private static instance: PaymentProvider | null = null;

  static createProvider(config: PaymentConfig): PaymentProvider {
    console.log(`[PAYMENT-FACTORY] Creating ${config.provider} provider...`);

    switch (config.provider) {
      case 'stripe':
        return new StripePaymentProvider(config);

      case 'paypal':
      case 'square':
      case 'braintree':
      case 'razorpay':
        throw new Error(`${config.provider} provider not yet implemented`);

      default:
        throw new Error(`Unsupported payment provider: ${config.provider}`);
    }
  }

  static async getInstance(config?: PaymentConfig): Promise<PaymentProvider> {
    if (this.instance && this.instance.isReady()) {
      return this.instance;
    }

    if (!config) {
      config = this.getConfigFromEnv();
    }

    this.instance = this.createProvider(config);
    await this.instance.initialize();

    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }

  static getConfigFromEnv(): PaymentConfig {
    const provider = (process.env.PAYMENT_PROVIDER || 'stripe') as PaymentConfig['provider'];

    return {
      provider,
      secretKey: process.env.STRIPE_SECRET_KEY || process.env.PAYMENT_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET,
      mode: process.env.PAYMENT_MODE as 'test' | 'live' || 'test',
    };
  }
}

export async function getPaymentProvider(config?: PaymentConfig): Promise<PaymentProvider> {
  return PaymentProviderFactory.getInstance(config);
}
