/**
 * Payment Provider Metadata and Utilities
 *
 * This file contains comprehensive information about all supported payment providers,
 * including their capabilities, regions, required credentials, and integration details.
 */

export type PaymentProvider =
  | "stripe"
  | "paypal"
  | "square"
  | "authorize_net"
  | "braintree"
  | "adyen"
  | "razorpay"
  | "paytm"
  | "flutterwave"
  | "mercado_pago"
  | "apple_pay"
  | "google_pay"
  | "amazon_pay"
  | "venmo"
  | "cash_app"
  | "klarna"
  | "afterpay"
  | "affirm"
  | "sezzle"
  | "coinbase_commerce"
  | "bitpay"
  | "crypto_com_pay";

export type PaymentProviderCategory =
  | "traditional_gateway"
  | "regional_provider"
  | "digital_wallet"
  | "bnpl"
  | "cryptocurrency";

export type PaymentCapability =
  | "one_time_payments"
  | "recurring_billing"
  | "subscriptions"
  | "marketplace_splits"
  | "refunds"
  | "partial_refunds"
  | "webhooks"
  | "fraud_detection"
  | "3d_secure"
  | "mobile_payments"
  | "pos_integration";

export interface PaymentProviderMetadata {
  id: PaymentProvider;
  name: string;
  displayName: string;
  category: PaymentProviderCategory;
  description: string;
  logo?: string;
  website: string;

  // Regional availability
  regions: string[]; // ISO country codes or regions
  primaryRegion?: string;

  // Capabilities
  capabilities: PaymentCapability[];

  // Supported currencies
  supportedCurrencies: string[];

  // Transaction fees (indicative)
  fees?: {
    percentage?: number;
    fixed?: number;
    currency?: string;
  };

  // Credentials required
  credentials: {
    [key: string]: {
      label: string;
      type: "text" | "password" | "select";
      required: boolean;
      encrypted: boolean;
      helpText?: string;
      options?: Array<{ value: string; label: string }>;
    };
  };

  // Integration details
  integration: {
    hasTestMode: boolean;
    hasSandbox: boolean;
    webhookSupport: boolean;
    sdkAvailable: boolean;
    apiDocumentation: string;
  };

  // Status
  status: "production" | "beta" | "coming_soon";
  popularity: "high" | "medium" | "low";
}

export const PAYMENT_PROVIDERS: Record<PaymentProvider, PaymentProviderMetadata> = {
  stripe: {
    id: "stripe",
    name: "stripe",
    displayName: "Stripe",
    category: "traditional_gateway",
    description: "Complete payments platform with powerful APIs and global reach",
    website: "https://stripe.com",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "marketplace_splits",
      "refunds",
      "partial_refunds",
      "webhooks",
      "fraud_detection",
      "3d_secure",
      "mobile_payments",
    ],
    supportedCurrencies: ["usd", "eur", "gbp", "cad", "aud", "jpy", "chf", "sek", "nok", "dkk"],
    fees: {
      percentage: 2.9,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      secretKey: {
        label: "Secret Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Stripe secret API key (starts with sk_)",
      },
      publishableKey: {
        label: "Publishable Key",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Stripe publishable API key (starts with pk_)",
      },
      webhookSecret: {
        label: "Webhook Secret",
        type: "password",
        required: false,
        encrypted: true,
        helpText: "Webhook signing secret for verifying events",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://stripe.com/docs/api",
    },
    status: "production",
    popularity: "high",
  },

  paypal: {
    id: "paypal",
    name: "paypal",
    displayName: "PayPal",
    category: "traditional_gateway",
    description: "Trusted digital payment platform with 400M+ active users worldwide",
    website: "https://www.paypal.com",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "refunds",
      "partial_refunds",
      "webhooks",
      "fraud_detection",
    ],
    supportedCurrencies: ["usd", "eur", "gbp", "cad", "aud", "jpy"],
    fees: {
      percentage: 2.9,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      clientId: {
        label: "Client ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your PayPal REST API Client ID",
      },
      clientSecret: {
        label: "Client Secret",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your PayPal REST API Secret",
      },
      webhookId: {
        label: "Webhook ID",
        type: "text",
        required: false,
        encrypted: false,
        helpText: "Webhook ID for event verification",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developer.paypal.com/docs/api/overview/",
    },
    status: "production",
    popularity: "high",
  },

  square: {
    id: "square",
    name: "square",
    displayName: "Square",
    category: "traditional_gateway",
    description: "All-in-one payment solution for online and in-person sales",
    website: "https://squareup.com",
    regions: ["US", "CA", "UK", "AU", "JP", "IE", "ES", "FR"],
    primaryRegion: "US",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "refunds",
      "partial_refunds",
      "webhooks",
      "pos_integration",
      "mobile_payments",
    ],
    supportedCurrencies: ["usd", "cad", "gbp", "aud", "jpy", "eur"],
    fees: {
      percentage: 2.9,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      accessToken: {
        label: "Access Token",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Square access token",
      },
      applicationId: {
        label: "Application ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Square application ID",
      },
      locationId: {
        label: "Location ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your primary Square location ID",
      },
      webhookSignatureKey: {
        label: "Webhook Signature Key",
        type: "password",
        required: false,
        encrypted: true,
        helpText: "Key for verifying webhook signatures",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developer.squareup.com/docs",
    },
    status: "production",
    popularity: "high",
  },

  razorpay: {
    id: "razorpay",
    name: "razorpay",
    displayName: "Razorpay",
    category: "regional_provider",
    description: "Leading payment gateway in India with 100+ payment methods",
    website: "https://razorpay.com",
    regions: ["IN", "MY", "SG"],
    primaryRegion: "India",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "refunds",
      "partial_refunds",
      "webhooks",
      "fraud_detection",
    ],
    supportedCurrencies: ["inr", "myr", "sgd"],
    fees: {
      percentage: 2.0,
      fixed: 0,
      currency: "inr",
    },
    credentials: {
      keyId: {
        label: "Key ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Razorpay Key ID",
      },
      keySecret: {
        label: "Key Secret",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Razorpay Key Secret",
      },
      webhookSecret: {
        label: "Webhook Secret",
        type: "password",
        required: false,
        encrypted: true,
        helpText: "Webhook secret for event verification",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://razorpay.com/docs/api/",
    },
    status: "production",
    popularity: "high",
  },

  paytm: {
    id: "paytm",
    name: "paytm",
    displayName: "Paytm",
    category: "regional_provider",
    description: "India's leading digital payment platform",
    website: "https://paytm.com",
    regions: ["IN"],
    primaryRegion: "India",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "refunds",
      "webhooks",
      "mobile_payments",
    ],
    supportedCurrencies: ["inr"],
    fees: {
      percentage: 1.99,
      fixed: 0,
      currency: "inr",
    },
    credentials: {
      merchantId: {
        label: "Merchant ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Paytm Merchant ID",
      },
      merchantKey: {
        label: "Merchant Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Paytm Merchant Key",
      },
      websiteName: {
        label: "Website Name",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your registered website name with Paytm",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developer.paytm.com/docs/",
    },
    status: "production",
    popularity: "medium",
  },

  flutterwave: {
    id: "flutterwave",
    name: "flutterwave",
    displayName: "Flutterwave",
    category: "regional_provider",
    description: "Leading payment technology company across Africa",
    website: "https://flutterwave.com",
    regions: ["NG", "GH", "KE", "UG", "ZA", "TZ"],
    primaryRegion: "Africa",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "refunds",
      "webhooks",
      "mobile_payments",
    ],
    supportedCurrencies: ["ngn", "ghs", "kes", "ugx", "zar", "tzs", "usd", "eur", "gbp"],
    fees: {
      percentage: 1.4,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      publicKey: {
        label: "Public Key",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Flutterwave public key",
      },
      secretKey: {
        label: "Secret Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Flutterwave secret key",
      },
      encryptionKey: {
        label: "Encryption Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Flutterwave encryption key",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developer.flutterwave.com/docs",
    },
    status: "production",
    popularity: "high",
  },

  mercado_pago: {
    id: "mercado_pago",
    name: "mercado_pago",
    displayName: "Mercado Pago",
    category: "regional_provider",
    description: "Leading payment solution in Latin America",
    website: "https://www.mercadopago.com",
    regions: ["AR", "BR", "CL", "CO", "MX", "PE", "UY"],
    primaryRegion: "Latin America",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "refunds",
      "partial_refunds",
      "webhooks",
    ],
    supportedCurrencies: ["ars", "brl", "clp", "cop", "mxn", "pen", "uyu"],
    fees: {
      percentage: 3.99,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      accessToken: {
        label: "Access Token",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Mercado Pago access token",
      },
      publicKey: {
        label: "Public Key",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Mercado Pago public key",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://www.mercadopago.com/developers",
    },
    status: "production",
    popularity: "high",
  },

  authorize_net: {
    id: "authorize_net",
    name: "authorize_net",
    displayName: "Authorize.Net",
    category: "traditional_gateway",
    description: "Trusted payment gateway with 25+ years of experience",
    website: "https://www.authorize.net",
    regions: ["US", "CA", "UK", "EU"],
    primaryRegion: "US",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "refunds",
      "partial_refunds",
      "webhooks",
      "fraud_detection",
    ],
    supportedCurrencies: ["usd", "cad", "gbp", "eur"],
    fees: {
      percentage: 2.9,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      apiLoginId: {
        label: "API Login ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Authorize.Net API Login ID",
      },
      transactionKey: {
        label: "Transaction Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Authorize.Net Transaction Key",
      },
      signatureKey: {
        label: "Signature Key",
        type: "password",
        required: false,
        encrypted: true,
        helpText: "Webhook signature key for verification",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developer.authorize.net/api/reference/",
    },
    status: "production",
    popularity: "medium",
  },

  braintree: {
    id: "braintree",
    name: "braintree",
    displayName: "Braintree",
    category: "traditional_gateway",
    description: "PayPal's full-stack payment platform for developers",
    website: "https://www.braintreepayments.com",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "marketplace_splits",
      "refunds",
      "partial_refunds",
      "webhooks",
      "fraud_detection",
      "3d_secure",
    ],
    supportedCurrencies: ["usd", "eur", "gbp", "aud", "cad"],
    fees: {
      percentage: 2.9,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      merchantId: {
        label: "Merchant ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Braintree Merchant ID",
      },
      publicKey: {
        label: "Public Key",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Braintree Public Key",
      },
      privateKey: {
        label: "Private Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Braintree Private Key",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developers.braintreepayments.com/",
    },
    status: "production",
    popularity: "medium",
  },

  adyen: {
    id: "adyen",
    name: "adyen",
    displayName: "Adyen",
    category: "traditional_gateway",
    description: "Enterprise payment platform for global businesses",
    website: "https://www.adyen.com",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "subscriptions",
      "marketplace_splits",
      "refunds",
      "partial_refunds",
      "webhooks",
      "fraud_detection",
      "3d_secure",
      "pos_integration",
    ],
    supportedCurrencies: ["usd", "eur", "gbp", "aud", "cad", "jpy", "chf"],
    fees: {
      percentage: 2.5,
      fixed: 0.10,
      currency: "usd",
    },
    credentials: {
      apiKey: {
        label: "API Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Adyen API key",
      },
      merchantAccount: {
        label: "Merchant Account",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Adyen merchant account name",
      },
      clientKey: {
        label: "Client Key",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Adyen client key for frontend",
      },
      hmacKey: {
        label: "HMAC Key",
        type: "password",
        required: false,
        encrypted: true,
        helpText: "HMAC key for webhook verification",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://docs.adyen.com/",
    },
    status: "production",
    popularity: "medium",
  },

  klarna: {
    id: "klarna",
    name: "klarna",
    displayName: "Klarna",
    category: "bnpl",
    description: "Buy now, pay later solution with flexible payment options",
    website: "https://www.klarna.com",
    regions: ["US", "UK", "DE", "SE", "NO", "FI", "DK", "NL", "AT", "CH"],
    primaryRegion: "EU/US",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "refunds",
      "partial_refunds",
      "webhooks",
    ],
    supportedCurrencies: ["usd", "eur", "gbp", "sek", "nok", "dkk", "chf"],
    fees: {
      percentage: 3.29,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      username: {
        label: "Username",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Klarna API username",
      },
      password: {
        label: "Password",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Klarna API password",
      },
      region: {
        label: "Region",
        type: "select",
        required: true,
        encrypted: false,
        helpText: "Your Klarna operating region",
        options: [
          { value: "eu", label: "Europe" },
          { value: "us", label: "United States" },
          { value: "oc", label: "Oceania" },
        ],
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://docs.klarna.com/",
    },
    status: "production",
    popularity: "high",
  },

  afterpay: {
    id: "afterpay",
    name: "afterpay",
    displayName: "Afterpay",
    category: "bnpl",
    description: "Shop now, pay later in 4 interest-free installments",
    website: "https://www.afterpay.com",
    regions: ["US", "UK", "AU", "NZ", "CA"],
    primaryRegion: "US/AU",
    capabilities: [
      "one_time_payments",
      "refunds",
      "partial_refunds",
      "webhooks",
    ],
    supportedCurrencies: ["usd", "gbp", "aud", "nzd", "cad"],
    fees: {
      percentage: 4.0,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      merchantId: {
        label: "Merchant ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Afterpay Merchant ID",
      },
      secretKey: {
        label: "Secret Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Afterpay Secret Key",
      },
      region: {
        label: "Region",
        type: "select",
        required: true,
        encrypted: false,
        helpText: "Your Afterpay operating region",
        options: [
          { value: "us", label: "United States" },
          { value: "uk", label: "United Kingdom" },
          { value: "au", label: "Australia" },
          { value: "nz", label: "New Zealand" },
          { value: "ca", label: "Canada" },
        ],
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developers.afterpay.com/",
    },
    status: "production",
    popularity: "high",
  },

  affirm: {
    id: "affirm",
    name: "affirm",
    displayName: "Affirm",
    category: "bnpl",
    description: "Transparent financing for online purchases",
    website: "https://www.affirm.com",
    regions: ["US", "CA"],
    primaryRegion: "US",
    capabilities: [
      "one_time_payments",
      "refunds",
      "partial_refunds",
      "webhooks",
    ],
    supportedCurrencies: ["usd", "cad"],
    fees: {
      percentage: 2.9,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      publicApiKey: {
        label: "Public API Key",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Affirm public API key",
      },
      privateApiKey: {
        label: "Private API Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Affirm private API key",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://docs.affirm.com/",
    },
    status: "production",
    popularity: "medium",
  },

  sezzle: {
    id: "sezzle",
    name: "sezzle",
    displayName: "Sezzle",
    category: "bnpl",
    description: "Interest-free installment payments for shoppers",
    website: "https://sezzle.com",
    regions: ["US", "CA"],
    primaryRegion: "US",
    capabilities: [
      "one_time_payments",
      "refunds",
      "webhooks",
    ],
    supportedCurrencies: ["usd", "cad"],
    fees: {
      percentage: 6.0,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      merchantId: {
        label: "Merchant ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Sezzle Merchant ID",
      },
      publicKey: {
        label: "Public Key",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Sezzle Public Key",
      },
      privateKey: {
        label: "Private Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Sezzle Private Key",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://docs.sezzle.com/",
    },
    status: "production",
    popularity: "low",
  },

  apple_pay: {
    id: "apple_pay",
    name: "apple_pay",
    displayName: "Apple Pay",
    category: "digital_wallet",
    description: "Secure payments using Apple devices",
    website: "https://www.apple.com/apple-pay/",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "mobile_payments",
    ],
    supportedCurrencies: ["usd", "eur", "gbp", "cad", "aud", "jpy"],
    fees: {
      percentage: 0,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      merchantId: {
        label: "Merchant ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Apple Pay Merchant ID",
      },
      certificateFile: {
        label: "Certificate File",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Path to your merchant certificate",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: false,
      sdkAvailable: true,
      apiDocumentation: "https://developer.apple.com/apple-pay/",
    },
    status: "production",
    popularity: "high",
  },

  google_pay: {
    id: "google_pay",
    name: "google_pay",
    displayName: "Google Pay",
    category: "digital_wallet",
    description: "Fast, simple checkout with Google",
    website: "https://pay.google.com",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "mobile_payments",
    ],
    supportedCurrencies: ["usd", "eur", "gbp", "cad", "aud", "jpy"],
    fees: {
      percentage: 0,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      merchantId: {
        label: "Merchant ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Google Pay Merchant ID",
      },
      merchantName: {
        label: "Merchant Name",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your business name",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: false,
      sdkAvailable: true,
      apiDocumentation: "https://developers.google.com/pay/api",
    },
    status: "production",
    popularity: "high",
  },

  amazon_pay: {
    id: "amazon_pay",
    name: "amazon_pay",
    displayName: "Amazon Pay",
    category: "digital_wallet",
    description: "Pay with your Amazon account credentials",
    website: "https://pay.amazon.com",
    regions: ["US", "UK", "DE", "FR", "IT", "ES", "JP"],
    primaryRegion: "US",
    capabilities: [
      "one_time_payments",
      "recurring_billing",
      "refunds",
      "webhooks",
    ],
    supportedCurrencies: ["usd", "eur", "gbp", "jpy"],
    fees: {
      percentage: 2.9,
      fixed: 0.30,
      currency: "usd",
    },
    credentials: {
      merchantId: {
        label: "Merchant ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Amazon Pay Merchant ID",
      },
      accessKeyId: {
        label: "Access Key ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Amazon MWS Access Key ID",
      },
      secretAccessKey: {
        label: "Secret Access Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Amazon MWS Secret Access Key",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developer.amazon.com/pay",
    },
    status: "production",
    popularity: "medium",
  },

  venmo: {
    id: "venmo",
    name: "venmo",
    displayName: "Venmo",
    category: "digital_wallet",
    description: "Social payment app for friends and purchases",
    website: "https://venmo.com",
    regions: ["US"],
    primaryRegion: "US",
    capabilities: [
      "one_time_payments",
      "refunds",
    ],
    supportedCurrencies: ["usd"],
    fees: {
      percentage: 1.9,
      fixed: 0.10,
      currency: "usd",
    },
    credentials: {
      merchantId: {
        label: "Merchant ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Venmo Merchant ID",
      },
      accessToken: {
        label: "Access Token",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Venmo API Access Token",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: false,
      sdkAvailable: true,
      apiDocumentation: "https://developer.venmo.com/",
    },
    status: "beta",
    popularity: "medium",
  },

  cash_app: {
    id: "cash_app",
    name: "cash_app",
    displayName: "Cash App Pay",
    category: "digital_wallet",
    description: "Accept payments through Cash App",
    website: "https://cash.app",
    regions: ["US", "UK"],
    primaryRegion: "US",
    capabilities: [
      "one_time_payments",
      "refunds",
    ],
    supportedCurrencies: ["usd", "gbp"],
    fees: {
      percentage: 2.75,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      applicationId: {
        label: "Application ID",
        type: "text",
        required: true,
        encrypted: false,
        helpText: "Your Cash App Application ID",
      },
      accessToken: {
        label: "Access Token",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Cash App Access Token",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://developers.cash.app/",
    },
    status: "beta",
    popularity: "medium",
  },

  coinbase_commerce: {
    id: "coinbase_commerce",
    name: "coinbase_commerce",
    displayName: "Coinbase Commerce",
    category: "cryptocurrency",
    description: "Accept cryptocurrency payments with ease",
    website: "https://commerce.coinbase.com",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "webhooks",
    ],
    supportedCurrencies: ["btc", "eth", "ltc", "usdc", "dai", "bch"],
    fees: {
      percentage: 1.0,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      apiKey: {
        label: "API Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Coinbase Commerce API key",
      },
      webhookSecret: {
        label: "Webhook Secret",
        type: "password",
        required: false,
        encrypted: true,
        helpText: "Shared secret for webhook verification",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://commerce.coinbase.com/docs/",
    },
    status: "production",
    popularity: "medium",
  },

  bitpay: {
    id: "bitpay",
    name: "bitpay",
    displayName: "BitPay",
    category: "cryptocurrency",
    description: "Bitcoin and cryptocurrency payment processor",
    website: "https://bitpay.com",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "refunds",
      "webhooks",
    ],
    supportedCurrencies: ["btc", "bch", "eth", "usdc", "gusd", "pax", "busd"],
    fees: {
      percentage: 1.0,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      apiToken: {
        label: "API Token",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your BitPay API token",
      },
      notificationEmail: {
        label: "Notification Email",
        type: "text",
        required: false,
        encrypted: false,
        helpText: "Email for payment notifications",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://bitpay.com/docs",
    },
    status: "production",
    popularity: "medium",
  },

  crypto_com_pay: {
    id: "crypto_com_pay",
    name: "crypto_com_pay",
    displayName: "Crypto.com Pay",
    category: "cryptocurrency",
    description: "Accept crypto payments with instant settlement",
    website: "https://crypto.com/pay",
    regions: ["worldwide"],
    primaryRegion: "Global",
    capabilities: [
      "one_time_payments",
      "webhooks",
    ],
    supportedCurrencies: ["btc", "eth", "cro", "usdc", "usdt"],
    fees: {
      percentage: 0,
      fixed: 0,
      currency: "usd",
    },
    credentials: {
      apiKey: {
        label: "API Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Crypto.com Pay API key",
      },
      secretKey: {
        label: "Secret Key",
        type: "password",
        required: true,
        encrypted: true,
        helpText: "Your Crypto.com Pay secret key",
      },
    },
    integration: {
      hasTestMode: true,
      hasSandbox: true,
      webhookSupport: true,
      sdkAvailable: true,
      apiDocumentation: "https://pay-docs.crypto.com/",
    },
    status: "production",
    popularity: "low",
  },
};

/**
 * Get provider metadata by ID
 */
export function getProviderMetadata(providerId: PaymentProvider): PaymentProviderMetadata {
  return PAYMENT_PROVIDERS[providerId];
}

/**
 * Get all providers by category
 */
export function getProvidersByCategory(category: PaymentProviderCategory): PaymentProviderMetadata[] {
  return Object.values(PAYMENT_PROVIDERS).filter(p => p.category === category);
}

/**
 * Get all providers supporting a specific capability
 */
export function getProvidersByCapability(capability: PaymentCapability): PaymentProviderMetadata[] {
  return Object.values(PAYMENT_PROVIDERS).filter(p => p.capabilities.includes(capability));
}

/**
 * Get providers available in a specific region
 */
export function getProvidersByRegion(region: string): PaymentProviderMetadata[] {
  return Object.values(PAYMENT_PROVIDERS).filter(p =>
    p.regions.includes("worldwide") || p.regions.includes(region.toUpperCase())
  );
}

/**
 * Get providers supporting a specific currency
 */
export function getProvidersByCurrency(currency: string): PaymentProviderMetadata[] {
  return Object.values(PAYMENT_PROVIDERS).filter(p =>
    p.supportedCurrencies.includes(currency.toLowerCase())
  );
}

/**
 * Get all production-ready providers
 */
export function getProductionProviders(): PaymentProviderMetadata[] {
  return Object.values(PAYMENT_PROVIDERS).filter(p => p.status === "production");
}

/**
 * Get high popularity providers
 */
export function getPopularProviders(): PaymentProviderMetadata[] {
  return Object.values(PAYMENT_PROVIDERS).filter(p => p.popularity === "high");
}

/**
 * Format provider display name for UI
 */
export function formatProviderName(providerId: string): string {
  const provider = PAYMENT_PROVIDERS[providerId as PaymentProvider];
  return provider ? provider.displayName : providerId;
}

/**
 * Check if provider supports a capability
 */
export function providerSupports(
  providerId: PaymentProvider,
  capability: PaymentCapability
): boolean {
  const provider = PAYMENT_PROVIDERS[providerId];
  return provider ? provider.capabilities.includes(capability) : false;
}

/**
 * Get recommended providers based on business needs
 */
export function getRecommendedProviders(params: {
  region?: string;
  currency?: string;
  capabilities?: PaymentCapability[];
  category?: PaymentProviderCategory;
}): PaymentProviderMetadata[] {
  let providers = Object.values(PAYMENT_PROVIDERS);

  if (params.region) {
    providers = providers.filter(p =>
      p.regions.includes("worldwide") || p.regions.includes(params.region!.toUpperCase())
    );
  }

  if (params.currency) {
    providers = providers.filter(p =>
      p.supportedCurrencies.includes(params.currency!.toLowerCase())
    );
  }

  if (params.capabilities && params.capabilities.length > 0) {
    providers = providers.filter(p =>
      params.capabilities!.every(cap => p.capabilities.includes(cap))
    );
  }

  if (params.category) {
    providers = providers.filter(p => p.category === params.category);
  }

  // Sort by popularity and status
  return providers.sort((a, b) => {
    const statusOrder = { production: 0, beta: 1, coming_soon: 2 };
    const popularityOrder = { high: 0, medium: 1, low: 2 };

    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }

    return popularityOrder[a.popularity] - popularityOrder[b.popularity];
  });
}
