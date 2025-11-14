/**
 * Platform-Agnostic Provider Registry
 *
 * Central export point for all provider types and factories
 * Makes EchoSenseiX completely platform-independent
 */

// Voice Providers
export * from './voice-provider';
export * from './voice-factory';
export { ElevenLabsVoiceProvider } from './voice/elevenlabs-voice-provider';
export { OpenAIVoiceProvider } from './voice/openai-voice-provider';
export { GoogleVoiceProvider } from './voice/google-voice-provider';

// Payment Providers
export * from './payment-provider';
export * from './payment-factory';
export { StripePaymentProvider } from './payment/stripe-payment-provider';

// LLM Providers
export * from './llm-provider';
export * from './llm-factory';

// Provider Types
export type ProviderType =
  | 'voice'
  | 'payment'
  | 'llm'
  | 'auth'
  | 'database'
  | 'storage'
  | 'email'
  | 'sms'
  | 'cache'
  | 'logging';

/**
 * Provider Registry
 * Lists all available providers for each service type
 */
export const PROVIDER_REGISTRY = {
  voice: {
    available: ['elevenlabs', 'openai', 'google', 'azure', 'aws-polly'],
    implemented: ['elevenlabs', 'openai', 'google'],
    default: 'elevenlabs',
  },
  payment: {
    available: ['stripe', 'paypal', 'square', 'braintree', 'razorpay'],
    implemented: ['stripe'],
    default: 'stripe',
  },
  llm: {
    available: ['openai', 'anthropic', 'mistral', 'google'],
    implemented: [],
    default: 'openai',
  },
  database: {
    available: ['postgresql', 'mongodb', 'mysql', 'supabase', 'sqlite'],
    implemented: ['postgresql', 'mongodb', 'mysql', 'supabase'],
    default: 'postgresql',
  },
  storage: {
    available: ['local', 's3', 'gcs', 'azure'],
    implemented: ['local', 's3', 'gcs', 'azure'],
    default: 'local',
  },
  email: {
    available: ['sendgrid', 'mailgun', 'smtp'],
    implemented: ['sendgrid', 'mailgun', 'smtp'],
    default: 'sendgrid',
  },
  sms: {
    available: ['twilio', 'vonage', 'aws-sns'],
    implemented: [],
    default: 'twilio',
  },
  auth: {
    available: ['local', 'oauth', 'auth0', 'supabase'],
    implemented: ['local'],
    default: 'local',
  },
  cache: {
    available: ['memory', 'redis', 'memcached'],
    implemented: ['memory'],
    default: 'memory',
  },
  logging: {
    available: ['console', 'cloudwatch', 'datadog', 'sentry'],
    implemented: ['console'],
    default: 'console',
  },
} as const;

/**
 * Get provider configuration summary
 */
export function getProvidersSummary() {
  const summary: Record<string, any> = {};

  for (const [type, config] of Object.entries(PROVIDER_REGISTRY)) {
    summary[type] = {
      available: config.available.length,
      implemented: config.implemented.length,
      default: config.default,
      ready: config.implemented.length > 0,
    };
  }

  return summary;
}

/**
 * Check if a provider is implemented
 */
export function isProviderImplemented(type: ProviderType, provider: string): boolean {
  const registry = PROVIDER_REGISTRY[type];
  return registry ? registry.implemented.includes(provider as any) : false;
}

/**
 * Get default provider for a type
 */
export function getDefaultProvider(type: ProviderType): string {
  return PROVIDER_REGISTRY[type]?.default || '';
}
