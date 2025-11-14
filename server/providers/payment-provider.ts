/**
 * Payment Provider Interface
 *
 * Platform-agnostic payment processing abstraction
 * Supports: Stripe, PayPal, Square, Braintree, and more
 */

export interface PaymentConfig {
  provider: 'stripe' | 'paypal' | 'square' | 'braintree' | 'razorpay' | 'custom';
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  mode?: 'test' | 'live';
  options?: Record<string, any>;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal' | 'other';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface CreatePaymentIntentOptions {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, any>;
  captureMethod?: 'automatic' | 'manual';
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  clientSecret?: string;
  metadata?: Record<string, any>;
}

export interface Subscription {
  id: string;
  customerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  items: SubscriptionItem[];
}

export interface SubscriptionItem {
  id: string;
  priceId: string;
  quantity: number;
}

export interface CreateSubscriptionOptions {
  customerId: string;
  items: Array<{
    priceId: string;
    quantity?: number;
  }>;
  trialPeriodDays?: number;
  metadata?: Record<string, any>;
}

export interface Refund {
  id: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: Date;
}

export interface PaymentProvider {
  /**
   * Get provider name
   */
  getProviderName(): string;

  /**
   * Initialize the provider
   */
  initialize(): Promise<void>;

  /**
   * Check if provider is ready
   */
  isReady(): boolean;

  // Customer Management
  createCustomer(email: string, name?: string, metadata?: Record<string, any>): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer>;
  deleteCustomer(customerId: string): Promise<void>;

  // Payment Intents
  createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent>;
  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null>;
  confirmPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;
  cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;

  // Subscriptions
  createSubscription(options: CreateSubscriptionOptions): Promise<Subscription>;
  getSubscription(subscriptionId: string): Promise<Subscription | null>;
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<Subscription>;
  updateSubscription(subscriptionId: string, updates: Partial<CreateSubscriptionOptions>): Promise<Subscription>;

  // Refunds
  createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Refund>;

  // Webhooks
  constructWebhookEvent(payload: string | Buffer, signature: string, secret?: string): Promise<WebhookEvent>;

  // Health Check
  healthCheck(): Promise<boolean>;
}

/**
 * Base Payment Provider with common functionality
 */
export abstract class BasePaymentProvider implements PaymentProvider {
  protected config: PaymentConfig;
  protected ready: boolean = false;

  constructor(config: PaymentConfig) {
    this.config = config;
  }

  abstract getProviderName(): string;
  abstract initialize(): Promise<void>;
  abstract createCustomer(email: string, name?: string, metadata?: Record<string, any>): Promise<Customer>;
  abstract getCustomer(customerId: string): Promise<Customer | null>;
  abstract updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer>;
  abstract deleteCustomer(customerId: string): Promise<void>;
  abstract createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent>;
  abstract getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null>;
  abstract confirmPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;
  abstract cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;
  abstract createSubscription(options: CreateSubscriptionOptions): Promise<Subscription>;
  abstract getSubscription(subscriptionId: string): Promise<Subscription | null>;
  abstract cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<Subscription>;
  abstract updateSubscription(subscriptionId: string, updates: Partial<CreateSubscriptionOptions>): Promise<Subscription>;
  abstract createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Refund>;
  abstract constructWebhookEvent(payload: string | Buffer, signature: string, secret?: string): Promise<WebhookEvent>;
  abstract healthCheck(): Promise<boolean>;

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Log provider operations
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = `[PAYMENT:${this.getProviderName().toUpperCase()}]`;
    const fullMessage = `${prefix} ${message}`;

    switch (level) {
      case 'info':
        console.log(fullMessage);
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'error':
        console.error(fullMessage);
        break;
    }
  }

  /**
   * Validate configuration
   */
  protected validateConfig(): void {
    if (!this.config.secretKey && this.config.provider !== 'custom') {
      throw new Error(`Secret key is required for ${this.config.provider} provider`);
    }
  }

  /**
   * Convert amount to cents
   */
  protected toCents(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Convert cents to dollars
   */
  protected fromCents(cents: number): number {
    return cents / 100;
  }
}
