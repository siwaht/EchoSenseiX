import { sql } from 'drizzle-orm';
import {
  index,
  sqliteTable,
  text,
  integer,
  real,
  unique,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: integer("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  organizationId: text("organization_id").notNull(),
  isAdmin: integer("is_admin", { mode: 'boolean' }).default(false),
  role: text("role").default("user"), // user, admin, agency, owner, manager, viewer
  roleTemplate: text("role_template"), // Reference to the role template used
  status: text("status").default("active"), // active, inactive, pending
  permissions: text("permissions", { mode: 'json' }).$type<string[]>().default([]),
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(), // Custom user attributes
  lastLoginAt: integer("last_login_at", { mode: 'timestamp' }),
  invitedBy: text("invited_by"), // User ID who invited this user
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Organizations table for multi-tenancy and multi-tier hierarchy
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subdomain: text("subdomain"), // Custom subdomain for agency (e.g., 'agency-name' for agency-name.voiceai.com)
  customDomain: text("custom_domain"), // Full custom domain (e.g., dashboard.agency.com)
  parentOrganizationId: text("parent_organization_id"), // For hierarchy (agencies have parent, end customers have agency as parent)
  organizationType: text("organization_type").default("end_customer"), // platform_owner, agency, end_customer
  billingPackage: text("billing_package").default("starter"),
  perCallRate: real("per_call_rate").default(0.30),
  perMinuteRate: real("per_minute_rate").default(0.30),
  monthlyCredits: integer("monthly_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  creditBalance: real("credit_balance").default(0), // Prepaid credits for agencies
  commissionRate: real("commission_rate").default(30), // Percentage agencies keep from sales
  creditResetDate: integer("credit_reset_date", { mode: 'timestamp' }),
  customRateEnabled: integer("custom_rate_enabled", { mode: 'boolean' }).default(false),
  maxAgents: integer("max_agents").default(5),
  maxUsers: integer("max_users").default(10),
  stripeCustomerId: text("stripe_customer_id"),
  stripeConnectAccountId: text("stripe_connect_account_id"), // For agencies to receive payouts
  subscriptionId: text("subscription_id"),
  billingStatus: text("billing_status").default('inactive'), // active, inactive, past_due, warning, paused
  creditAlertStatus: text("credit_alert_status").default("normal"),
  lastAlertSentAt: integer("last_alert_sent_at", { mode: 'timestamp' }),
  servicePausedAt: integer("service_paused_at", { mode: 'timestamp' }),
  lastPaymentDate: integer("last_payment_date", { mode: 'timestamp' }),
  // New fields for enhanced management
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(), // Flexible custom attributes
  settings: text("settings", { mode: 'json' }).$type<{ // Organization-specific settings
    defaultUserRole?: string;
    autoProvisionResources?: boolean;
    welcomeMessage?: string;
    maxApiCallsPerDay?: number;
    customBranding?: {
      logo?: string;
      companyUrl?: string;
    };
  }>(),
  tierLimits: text("tier_limits", { mode: 'json' }).$type<{ // Resource usage limits
    maxMinutesPerMonth?: number;
    maxCallsPerMonth?: number;
    maxStorageGB?: number;
    maxConcurrentCalls?: number;
  }>(),
  agencyPermissions: text("agency_permissions", { mode: 'json' }).$type<string[]>().default([]), // Agency-level permissions
  agencyRole: text("agency_role"), // Role template for agency permissions
  elevenLabsApiKeyHash: text("elevenlabs_api_key_hash"), // Hash of current ElevenLabs API key to detect changes
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Integrations table for storing API keys
export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  provider: text("provider").notNull(), // 'elevenlabs'
  apiKey: text("api_key").notNull(), // encrypted
  apiKeyLast4: text("api_key_last4"), // Last 4 chars for display
  status: text("status").notNull().default("PENDING_APPROVAL"),
  lastTested: integer("last_tested", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  // Unique constraint on organizationId and provider for upsert operations
  uniqueOrgProvider: unique("unique_org_provider").on(table.organizationId, table.provider),
}));

// Admin tasks table for tracking approvals
export const adminTasks = sqliteTable("admin_tasks", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  title: text("title").notNull(),
  description: text("description"),
  relatedEntityId: text("related_entity_id").notNull(), // ID of integration/webhook/agent
  relatedEntityType: text("related_entity_type").notNull(), // 'integration', 'webhook', 'agent'
  organizationId: text("organization_id").notNull(),
  requestedBy: text("requested_by").notNull(), // User ID who requested
  approvedBy: text("approved_by"), // Admin ID who approved
  rejectedBy: text("rejected_by"), // Admin ID who rejected
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Approval webhooks table for notification endpoints
export const approvalWebhooks = sqliteTable("approval_webhooks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  webhookUrl: text("webhook_url").notNull(),
  secret: text("secret"), // For webhook signature verification
  events: text("events", { mode: 'json' }).$type<string[]>().notNull(), // ['task.created', 'task.approved', 'task.rejected']
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  headers: text("headers", { mode: 'json' }).$type<Record<string, string>>(), // Custom headers to send with webhook
  lastTriggered: integer("last_triggered", { mode: 'timestamp' }),
  failureCount: integer("failure_count").default(0),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Phone numbers table
export const phoneNumbers = sqliteTable("phone_numbers", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  label: text("label").notNull(),
  phoneNumber: text("phone_number").notNull(),
  countryCode: text("country_code").notNull().default("+1"),
  provider: text("provider").notNull(),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"), // encrypted
  sipTrunkUri: text("sip_trunk_uri"),
  sipUsername: text("sip_username"),
  sipPassword: text("sip_password"), // encrypted
  elevenLabsPhoneId: text("eleven_labs_phone_id"),
  agentId: text("agent_id"), // Local agent ID
  elevenLabsAgentId: text("elevenlabs_agent_id"), // ElevenLabs agent ID
  status: text("status").notNull().default("pending"),
  lastSynced: integer("last_synced", { mode: 'timestamp' }),
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// System Templates table (managed by admins only)
export const systemTemplates = sqliteTable("system_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  icon: text("icon"), // Icon name from lucide-react
  color: text("color"), // Tailwind color class
  order: integer("order").default(0),
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Quick Action Buttons table (system buttons managed by admins, user buttons by users)
export const quickActionButtons = sqliteTable("quick_action_buttons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  icon: text("icon").default("Sparkles"), // Icon name from lucide-react
  color: text("color").default("bg-blue-500 hover:bg-blue-600"), // Tailwind color classes
  category: text("category"), // To group related buttons
  order: integer("order").default(0),
  isSystem: integer("is_system", { mode: 'boolean' }).notNull().default(false), // System buttons managed by admin only
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  createdBy: text("created_by"), // User who created the button
  organizationId: text("organization_id"), // For user-created buttons
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agents table
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  elevenLabsAgentId: text("eleven_labs_agent_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  firstMessage: text("first_message"),
  systemPrompt: text("system_prompt"),
  language: text("language").default("en"),
  voiceId: text("voice_id"),
  voiceSettings: text("voice_settings", { mode: 'json' }).$type<{
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  }>(),
  multiVoiceConfig: text("multi_voice_config", { mode: 'json' }).$type<{
    enabled?: boolean;
    voices?: Array<{
      voiceId: string;
      name: string;
      character?: string;
      description?: string;
      triggerKeywords?: string[];
      triggerCondition?: string;
      stability?: number;
      similarityBoost?: number;
    }>;
    defaultVoice?: string;
    switchingMode?: "keyword" | "character" | "manual";
  }>(),
  llmSettings: text("llm_settings", { mode: 'json' }).$type<{
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }>(),
  tools: text("tools", { mode: 'json' }).$type<{
    // ElevenLabs System Tools
    systemTools?: {
      endCall?: {
        enabled: boolean;
        description?: string;
        disableInterruptions?: boolean;
      };
      detectLanguage?: {
        enabled: boolean;
        supportedLanguages?: string[];
        description?: string;
        disableInterruptions?: boolean;
      };
      skipTurn?: {
        enabled: boolean;
        description?: string;
        disableInterruptions?: boolean;
      };
      transferToAgent?: {
        enabled: boolean;
        description?: string;
        disableInterruptions?: boolean;
        transferRules?: Array<{
          agentId: string;
          agentName?: string;
          condition: string;
          delayMs?: number;
          transferMessage?: string;
          enableFirstMessage?: boolean;
        }>;
      };
      transferToNumber?: {
        enabled: boolean;
        phoneNumbers?: Array<{
          number: string;
          label: string;
          condition?: string;
        }>;
        description?: string;
        disableInterruptions?: boolean;
      };
      playKeypadTone?: {
        enabled: boolean;
        description?: string;
        disableInterruptions?: boolean;
      };
      voicemailDetection?: {
        enabled: boolean;
        leaveMessage?: boolean;
        messageContent?: string;
        description?: string;
        disableInterruptions?: boolean;
      };
    };
    // Webhooks
    webhooks?: Array<{
      id: string;
      name: string;
      url: string;
      method?: string;
      headers?: Record<string, string>;
      description?: string;
      enabled?: boolean;
    }>;
    // Platform webhook settings
    conversationInitiationWebhook?: {
      enabled: boolean;
      url?: string;
      description?: string;
    };
    postCallWebhook?: {
      enabled: boolean;
      url?: string;
      description?: string;
    };
    // Integrations
    integrations?: Array<{
      id: string;
      name: string;
      type: string;
      configuration?: Record<string, any>;
      enabled?: boolean;
    }>;
    // Custom Tools (webhooks, integrations, MCP servers)
    customTools?: Array<{
      id: string;
      name: string;
      type: 'webhook' | 'integration' | 'server' | 'client' | 'custom' | 'mcp';
      url?: string;
      method?: string;
      headers?: Record<string, string>;
      parameters?: Record<string, any>;
      configuration?: Record<string, any>;
      description?: string;
      enabled: boolean;
      // MCP-specific fields
      mcpConfig?: {
        serverType: 'sse' | 'streamable_http';
        secretToken?: string;
        approvalMode: 'always_ask' | 'fine_grained' | 'no_approval';
        trusted: boolean;
      };
      // Approval status for custom tools  
      approvalStatus?: 'pending' | 'approved' | 'rejected';
      // Webhook-specific parameter fields
      queryParameters?: Array<{
        name: string;
        type: string;
        required: boolean;
        valueType: string;
        description: string;
      }>;
      bodyParameters?: Array<{
        name: string;
        type: string;
        required: boolean;
        valueType: string;
        description: string;
      }>;
      pathParameters?: Array<{
        name: string;
        type: string;
        required: boolean;
        valueType: string;
        description: string;
      }>;
    }>;
    // Tool IDs for ElevenLabs
    toolIds?: string[];
    // Legacy MCP Servers (for backward compatibility)
    mcpServers?: Array<{
      id: string;
      name: string;
      url: string;
      apiKey?: string;
      configuration?: Record<string, any>;
      enabled: boolean;
    }>;
  }>(),
  dynamicVariables: text("dynamic_variables", { mode: 'json' }).$type<Record<string, string>>(),
  evaluationCriteria: text("evaluation_criteria", { mode: 'json' }).$type<{
    enabled?: boolean;
    criteria?: string[];
  }>(),
  dataCollection: text("data_collection", { mode: 'json' }).$type<{
    enabled?: boolean;
    fields?: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
  }>(),
  promptTemplates: text("prompt_templates", { mode: 'json' }).$type<Array<{
    id: string;
    name: string;
    content: string;
  }>>(),
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// User-Agent assignments table (maps which users can access which agents)
export const userAgents = sqliteTable("user_agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  agentId: text("agent_id").notNull(),
  assignedAt: integer("assigned_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  assignedBy: text("assigned_by"), // User ID of who made the assignment
}, (table) => ({
  // Unique constraint to prevent duplicate assignments
  uniqueUserAgent: unique("unique_user_agent").on(table.userId, table.agentId),
  // Index for faster lookups
  userIdIdx: index("user_agents_user_id_idx").on(table.userId),
  agentIdIdx: index("user_agents_agent_id_idx").on(table.agentId),
}));

// Summary metadata interface
export interface SummaryMetadata {
  provider?: string;
  model?: string;
  tokens?: number;
  cost?: number;
  promptVersion?: string;
}

// Call logs table
export const callLogs = sqliteTable("call_logs", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(), // Required ElevenLabs conversation ID
  organizationId: text("organization_id").notNull(),
  agentId: text("agent_id"),
  elevenLabsCallId: text("eleven_labs_call_id"),
  phoneNumber: text("phone_number"), // Caller's phone number for real calls
  duration: integer("duration"), // in seconds
  transcript: text("transcript", { mode: 'json' }),
  audioUrl: text("audio_url"),
  cost: real("cost"),
  status: text("status"), // completed, failed, in_progress
  summary: text("summary"), // AI-generated call summary
  summaryGeneratedAt: integer("summary_generated_at", { mode: 'timestamp' }), // When summary was created
  summaryStatus: text("summary_status"), // pending | success | failed | null
  summaryMetadata: text("summary_metadata", { mode: 'json' }).$type<SummaryMetadata | null>(), // Summary generation metadata
  audioStorageKey: text("audio_storage_key"), // Path to stored audio file in audio-storage/
  audioFetchStatus: text("audio_fetch_status"), // 'pending' | 'available' | 'failed' | 'unavailable' | null
  audioFetchedAt: integer("audio_fetched_at", { mode: 'timestamp' }), // Last fetch attempt timestamp
  recordingUrl: text("recording_url"), // Public URL for playback
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Payments table for tracking all payments
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  packageId: text("package_id"),
  planId: text("plan_id"), // Unified billing plan ID
  amount: real("amount").notNull(),
  platformAmount: real("platform_amount"), // Amount platform keeps
  agencyAmount: real("agency_amount"), // Amount agency receives
  currency: text("currency").default('usd'),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"), // stripe, paypal
  transactionId: text("transaction_id"), // External payment provider transaction ID
  stripeTransferId: text("stripe_transfer_id"), // Stripe Connect transfer ID
  description: text("description"),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
  failedAt: integer("failed_at", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agency Payment Configuration table - stores payment gateway settings for agencies
export const agencyPaymentConfig = sqliteTable("agency_payment_config", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().unique(), // Agency organization ID
  
  // Stripe configuration
  stripeSecretKey: text("stripe_secret_key"), // Encrypted
  stripePublishableKey: text("stripe_publishable_key"),
  stripeWebhookSecret: text("stripe_webhook_secret"), // Encrypted
  
  // PayPal configuration
  paypalClientId: text("paypal_client_id"),
  paypalClientSecret: text("paypal_client_secret"), // Encrypted
  paypalWebhookId: text("paypal_webhook_id"),
  
  // General settings
  defaultGateway: text("default_gateway"), // 'stripe' or 'paypal'
  currency: text("currency").default('usd'),
  taxRate: real("tax_rate").default(0),
  
  // Status
  isConfigured: integer("is_configured", { mode: 'boolean' }).default(false),
  lastVerifiedAt: integer("last_verified_at", { mode: 'timestamp' }),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agency Pricing Plans - agencies define their subscription plans
export const agencyPricingPlans = sqliteTable("agency_pricing_plans", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(), // Agency organization ID
  
  // Plan details
  name: text("name").notNull(),
  description: text("description"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  
  // Pricing
  price: real("price").notNull(),
  setupFee: real("setup_fee").default(0),
  currency: text("currency").default('usd'),
  
  // Trial settings
  trialDays: integer("trial_days").default(0),
  
  // Feature limits
  features: text("features", { mode: 'json' }).$type<{
    maxAgents?: number;
    maxMinutesPerMonth?: number;
    maxCallsPerMonth?: number;
    includedMinutes?: number;
    perMinuteOverage?: number;
    supportLevel?: string;
    customBranding?: boolean;
    apiAccess?: boolean;
  }>(),
  
  // Display settings
  displayOrder: integer("display_order").default(0),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  isPopular: integer("is_popular", { mode: 'boolean' }).default(false),
  
  // Stripe/PayPal product IDs
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  paypalPlanId: text("paypal_plan_id"),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agency Subscriptions - tracks user subscriptions to agency plans
export const agencySubscriptions = sqliteTable("agency_subscriptions", {
  id: text("id").primaryKey(),
  
  // References
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(), // Customer organization
  agencyOrganizationId: text("agency_organization_id").notNull(), // Agency organization
  planId: text("plan_id").notNull(),
  
  // Subscription details
  status: text("status").notNull().default("active"),
  
  // Billing details
  currentPeriodStart: integer("current_period_start", { mode: 'timestamp' }).notNull(),
  currentPeriodEnd: integer("current_period_end", { mode: 'timestamp' }).notNull(),
  cancelAt: integer("cancel_at", { mode: 'timestamp' }),
  canceledAt: integer("canceled_at", { mode: 'timestamp' }),
  trialEnd: integer("trial_end", { mode: 'timestamp' }),
  
  // Payment method
  paymentMethod: text("payment_method"), // 'stripe' or 'paypal'
  stripeSubscriptionId: text("stripe_subscription_id"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  
  // Usage tracking
  usageThisMonth: text("usage_this_month", { mode: 'json' }).$type<{
    minutes?: number;
    calls?: number;
    apiRequests?: number;
  }>(),
  
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agency Transactions - payment history for agency billing
export const agencyTransactions = sqliteTable("agency_transactions", {
  id: text("id").primaryKey(),
  
  // References
  subscriptionId: text("subscription_id"),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(), // Customer organization
  agencyOrganizationId: text("agency_organization_id").notNull(), // Agency organization
  
  // Transaction details
  type: text("type").notNull(), // 'subscription', 'one_time', 'refund', 'credit'
  amount: real("amount").notNull(),
  currency: text("currency").default('usd'),
  status: text("status").notNull().default("pending"),
  
  // Payment details
  paymentMethod: text("payment_method"), // 'stripe' or 'paypal'
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paypalOrderId: text("paypal_order_id"),
  
  // Invoice details
  invoiceNumber: text("invoice_number"),
  description: text("description"),
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  
  // Timestamps
  paidAt: integer("paid_at", { mode: 'timestamp' }),
  failedAt: integer("failed_at", { mode: 'timestamp' }),
  refundedAt: integer("refunded_at", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agency Payment Processors table - stores encrypted payment gateway settings for agencies
export const agencyPaymentProcessors = sqliteTable("agency_payment_processors", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(), // Agency organization ID
  provider: text("provider").notNull(), // 'stripe' or 'paypal'
  
  // Encrypted credentials (AES-256-GCM)
  encryptedCredentials: text("encrypted_credentials").notNull(), // JSON with encrypted keys
  
  // Validation status
  status: text("status").notNull().default("pending_validation"),
  lastValidatedAt: integer("last_validated_at", { mode: 'timestamp' }),
  validationError: text("validation_error"),
  
  // Configuration
  isDefault: integer("is_default", { mode: 'boolean' }).default(false),
  webhookEndpoint: text("webhook_endpoint"), // Agency-specific webhook URL
  
  // Metadata
  metadata: text("metadata", { mode: 'json' }).$type<{
    publicKey?: string; // Stripe publishable key (safe to expose)
    webhookId?: string; // PayPal webhook ID
    mode?: "sandbox" | "production";
  }>(),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  // Unique constraint on organizationId and provider for upsert operations
  uniqueOrgProvider: unique("unique_org_processor").on(table.organizationId, table.provider),
}));

// Agency Billing Plans table - comprehensive billing plans created by agencies
export const agencyBillingPlans = sqliteTable("agency_billing_plans", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(), // Agency organization ID
  
  // Plan details
  name: text("name").notNull(),
  description: text("description"),
  billingCycle: text("billing_cycle").notNull(), // monthly, quarterly, annual, one_time
  
  // Pricing
  price: real("price").notNull(),
  setupFee: real("setup_fee").default(0),
  currency: text("currency").default('usd'),
  
  // Trial settings
  trialPeriodDays: integer("trial_period_days").default(0),
  
  // Features and limits
  features: text("features", { mode: 'json' }).$type<{
    highlights: string[]; // Marketing bullet points
    callsLimit?: number;
    minutesLimit?: number;
    storageLimit?: number; // In GB
    agentsLimit?: number;
    customLimits?: Record<string, any>;
  }>().notNull(),
  
  // Payment processor product IDs
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  paypalPlanId: text("paypal_plan_id"),
  
  // Display settings
  displayOrder: integer("display_order").default(0),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  isPublic: integer("is_public", { mode: 'boolean' }).default(true), // Whether plan is visible to customers
  isPopular: integer("is_popular", { mode: 'boolean' }).default(false),
  
  // Metadata
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Customer Subscriptions table - tracks customer subscriptions to agency plans
export const customerSubscriptions = sqliteTable("customer_subscriptions", {
  id: text("id").primaryKey(),
  
  // References
  agencyOrganizationId: text("agency_organization_id").notNull(), // Agency organization ID
  customerOrganizationId: text("customer_organization_id").notNull(), // Customer organization ID
  userId: text("user_id").notNull(), // User who subscribed
  planId: text("plan_id").notNull(), // Agency billing plan ID
  
  // Subscription details
  status: text("status").notNull().default("active"),
  currentPeriodStart: integer("current_period_start", { mode: 'timestamp' }).notNull(),
  currentPeriodEnd: integer("current_period_end", { mode: 'timestamp' }).notNull(),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: 'boolean' }).default(false),
  
  // Payment processor subscription IDs
  stripeSubscriptionId: text("stripe_subscription_id"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  paymentProcessor: text("payment_processor"), // 'stripe' or 'paypal'
  
  // Trial information
  trialStart: integer("trial_start", { mode: 'timestamp' }),
  trialEnd: integer("trial_end", { mode: 'timestamp' }),
  
  // Usage tracking
  usageData: text("usage_data", { mode: 'json' }).$type<{
    callsUsed: number;
    minutesUsed: number;
    storageUsed?: number;
    customUsage?: Record<string, any>;
  }>().default({ callsUsed: 0, minutesUsed: 0 }),
  
  // Metadata
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  canceledAt: integer("canceled_at", { mode: 'timestamp' }),
});

// Customer Payment Methods table - stores customer payment methods linked to agency processors
export const customerPaymentMethods = sqliteTable("customer_payment_methods", {
  id: text("id").primaryKey(),
  
  // References
  agencyOrganizationId: text("agency_organization_id").notNull(), // Agency organization ID
  customerOrganizationId: text("customer_organization_id").notNull(), // Customer organization ID
  userId: text("user_id").notNull(), // User who added the payment method
  
  // Payment method details
  type: text("type").notNull(), // 'card', 'bank_account', 'paypal'
  provider: text("provider").notNull(), // 'stripe' or 'paypal'
  
  // Provider-specific IDs (encrypted)
  stripePaymentMethodId: text("stripe_payment_method_id"),
  stripeCustomerId: text("stripe_customer_id"),
  paypalBillingAgreementId: text("paypal_billing_agreement_id"),
  
  // Display information (safe to expose)
  displayName: text("display_name"), // e.g., "Visa ending in 4242"
  last4: text("last4"), // Last 4 digits of card
  brand: text("brand"), // Card brand (visa, mastercard, etc.)
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  
  // Status
  isDefault: integer("is_default", { mode: 'boolean' }).default(false),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  
  // Metadata
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});



// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  integrations: many(integrations),
  agents: many(agents),
  callLogs: many(callLogs),
  payments: many(payments),
  phoneNumbers: many(phoneNumbers),
  batchCalls: many(batchCalls),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  assignedAgents: many(userAgents),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [agents.organizationId],
    references: [organizations.id],
  }),
  callLogs: many(callLogs),
  userAssignments: many(userAgents),
}));

export const userAgentsRelations = relations(userAgents, ({ one }) => ({
  user: one(users, {
    fields: [userAgents.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [userAgents.agentId],
    references: [agents.id],
  }),
}));

export const callLogsRelations = relations(callLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [callLogs.organizationId],
    references: [organizations.id],
  }),
  agent: one(agents, {
    fields: [callLogs.agentId],
    references: [agents.id],
  }),
}));

// Zod schemas
export const upsertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserAgentSchema = createInsertSchema(userAgents).omit({
  id: true,
  assignedAt: true,
});

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertPhoneNumberSchema = createInsertSchema(phoneNumbers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Batch Calls table for outbound calling
export const batchCalls = sqliteTable("batch_calls", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  agentId: text("agent_id").notNull(),
  phoneNumberId: text("phone_number_id"),
  elevenlabsBatchId: text("elevenlabs_batch_id"),
  status: text("status").notNull().default("draft"), // draft, pending, in_progress, completed, failed, cancelled
  totalRecipients: integer("total_recipients").default(0),
  completedCalls: integer("completed_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  metadata: text("metadata", { mode: 'json' }),
  startedAt: integer("started_at", { mode: 'timestamp' }),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Batch Call Recipients table
export const batchCallRecipients = sqliteTable("batch_call_recipients", {
  id: text("id").primaryKey(),
  batchCallId: text("batch_call_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull().default("pending"), // pending, calling, completed, failed, no_answer, busy
  variables: text("variables", { mode: 'json' }), // Dynamic variables for personalization
  callDuration: integer("call_duration"), // in seconds
  callCost: real("call_cost"),
  errorMessage: text("error_message"),
  conversationId: text("conversation_id"),
  calledAt: integer("called_at", { mode: 'timestamp' }),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Billing Packages table with multi-tier support
export const billingPackages = sqliteTable("billing_packages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  createdByOrganizationId: text("created_by_organization_id"), // Who created this package (null for platform packages)
  availableToType: text("available_to_type").default("end_customer"), // Which tier can buy this
  baseCost: real("base_cost"), // What agents pay for this package
  marginPercentage: real("margin_percentage").default(30), // Maximum margin agents can add
  perCallRate: real("per_call_rate").notNull(),
  perMinuteRate: real("per_minute_rate").notNull(),
  monthlyCredits: integer("monthly_credits").notNull(),
  maxAgents: integer("max_agents").notNull(),
  maxUsers: integer("max_users").notNull(),
  features: text("features", { mode: 'json' }).notNull().default('[]'),
  monthlyPrice: real("monthly_price").notNull(),
  yearlyPrice: real("yearly_price"),
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const insertBillingPackageSchema = createInsertSchema(billingPackages).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertBatchCallSchema = createInsertSchema(batchCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBatchCallRecipientSchema = createInsertSchema(batchCallRecipients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemTemplateSchema = createInsertSchema(systemTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminTaskSchema = createInsertSchema(adminTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApprovalWebhookSchema = createInsertSchema(approvalWebhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuickActionButtonSchema = createInsertSchema(quickActionButtons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


// Agent Testing table
export const agentTests = sqliteTable("agent_tests", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  agentId: text("agent_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  testScenarios: text("test_scenarios", { mode: 'json' }).$type<Array<{
    id: string;
    name: string;
    userInput: string;
    expectedResponse?: string;
    variables?: Record<string, string>;
    success?: boolean;
    actualResponse?: string;
  }>>(),
  results: text("results", { mode: 'json' }).$type<{
    totalTests: number;
    passed: number;
    failed: number;
    lastRunAt?: string;
  }>(),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Widget configurations table
export const widgetConfigurations = sqliteTable("widget_configurations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  agentId: text("agent_id").notNull(),
  name: text("name").notNull(),
  variant: text("variant").default("full"), // full, compact, minimal
  placement: text("placement").default("bottom-right"),
  bgColor: text("bg_color").default("#ffffff"),
  textColor: text("text_color").default("#000000"),
  btnColor: text("btn_color").default("#000000"),
  btnTextColor: text("btn_text_color").default("#ffffff"),
  borderRadius: integer("border_radius").default(8),
  actionText: text("action_text"),
  startCallText: text("start_call_text"),
  endCallText: text("end_call_text"),
  expandText: text("expand_text"),
  listeningText: text("listening_text"),
  speakingText: text("speaking_text"),
  showAvatar: integer("show_avatar", { mode: 'boolean' }).default(true),
  disableBanner: integer("disable_banner", { mode: 'boolean' }).default(false),
  micMutingEnabled: integer("mic_muting_enabled", { mode: 'boolean' }).default(false),
  transcriptEnabled: integer("transcript_enabled", { mode: 'boolean' }).default(false),
  textInputEnabled: integer("text_input_enabled", { mode: 'boolean' }).default(true),
  defaultExpanded: integer("default_expanded", { mode: 'boolean' }).default(false),
  alwaysExpanded: integer("always_expanded", { mode: 'boolean' }).default(false),
  languageSelector: integer("language_selector", { mode: 'boolean' }).default(false),
  supportsTextOnly: integer("supports_text_only", { mode: 'boolean' }).default(true),
  customCss: text("custom_css"),
  embedCode: text("embed_code"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// SIP Trunk configurations table
export const sipTrunkConfigurations = sqliteTable("sip_trunk_configurations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  uri: text("uri").notNull(),
  username: text("username"),
  password: text("password"), // encrypted
  domain: text("domain"),
  proxy: text("proxy"),
  transport: text("transport").default("udp"), // udp, tcp, tls
  registrationExpiry: integer("registration_expiry").default(3600),
  codec: text("codec").default("PCMU"), // PCMU, PCMA, G729, etc
  dtmfMode: text("dtmf_mode").default("rfc2833"), // rfc2833, inband, info
  callerIdName: text("caller_id_name"),
  callerIdNumber: text("caller_id_number"),
  maxConcurrentCalls: integer("max_concurrent_calls").default(10),
  status: text("status").default("inactive"), // active, inactive, error
  lastRegistered: integer("last_registered", { mode: 'timestamp' }),
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Workspace settings table
export const workspaceSettings = sqliteTable("workspace_settings", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().unique(),
  name: text("name").notNull(),
  logo: text("logo"),
  timezone: text("timezone").default("UTC"),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  timeFormat: text("time_format").default("12h"), // 12h, 24h
  language: text("language").default("en"),
  currency: text("currency").default("USD"),
  dataResidency: text("data_residency").default("us"), // us, eu, ap
  complianceSettings: text("compliance_settings", { mode: 'json' }).$type<{
    hipaa?: boolean;
    gdpr?: boolean;
    soc2?: boolean;
    zeroRetention?: boolean;
    recordingConsent?: boolean;
  }>(),
  securitySettings: text("security_settings", { mode: 'json' }).$type<{
    twoFactorRequired?: boolean;
    ssoEnabled?: boolean;
    ipWhitelist?: string[];
    sessionTimeout?: number;
    passwordPolicy?: {
      minLength?: number;
      requireUppercase?: boolean;
      requireNumbers?: boolean;
      requireSpecialChars?: boolean;
      expiryDays?: number;
    };
  }>(),
  notificationSettings: text("notification_settings", { mode: 'json' }).$type<{
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    webhookNotifications?: boolean;
    dailyDigest?: boolean;
    weeklyReport?: boolean;
  }>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Analytics data table
export const analyticsData = sqliteTable("analytics_data", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  agentId: text("agent_id"),
  date: integer("date", { mode: 'timestamp' }).notNull(),
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  totalMinutes: real("total_minutes").default(0),
  totalCost: real("total_cost").default(0),
  averageCallDuration: real("average_call_duration"),
  averageSatisfaction: real("average_satisfaction"),
  uniqueCallers: integer("unique_callers").default(0),
  peakConcurrency: integer("peak_concurrency").default(0),
  languageBreakdown: text("language_breakdown", { mode: 'json' }).$type<Record<string, number>>(),
  errorBreakdown: text("error_breakdown", { mode: 'json' }).$type<Record<string, number>>(),
  hourlyDistribution: text("hourly_distribution", { mode: 'json' }).$type<number[]>(),
  toolUsage: text("tool_usage", { mode: 'json' }).$type<Record<string, number>>(),
  llmTokensUsed: integer("llm_tokens_used").default(0),
  llmCost: real("llm_cost").default(0),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Conversation feedback table
export const conversationFeedback = sqliteTable("conversation_feedback", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  agentId: text("agent_id"),
  rating: integer("rating"), // 1-5
  feedback: text("feedback"),
  tags: text("tags", { mode: 'json' }).$type<string[]>(),
  sentiment: text("sentiment"), // positive, neutral, negative
  resolved: integer("resolved", { mode: 'boolean' }).default(false),
  resolvedBy: text("resolved_by"),
  resolvedAt: integer("resolved_at", { mode: 'timestamp' }),
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// LLM Usage tracking table
export const llmUsage = sqliteTable("llm_usage", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  agentId: text("agent_id"),
  conversationId: text("conversation_id"),
  model: text("model").notNull(),
  provider: text("provider").notNull(), // openai, anthropic, google
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  cost: real("cost").default(0),
  latency: integer("latency"), // in milliseconds
  success: integer("success", { mode: 'boolean' }).default(true),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agent overrides table
export const agentOverrides = sqliteTable("agent_overrides", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  agentId: text("agent_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  overrideConfig: text("override_config", { mode: 'json' }).$type<{
    prompt?: string;
    firstMessage?: string;
    language?: string;
    voiceId?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: string[];
    dynamicVariables?: Record<string, string>;
  }>(),
  conditions: text("conditions", { mode: 'json' }).$type<{
    timeRange?: { start: string; end: string };
    dayOfWeek?: string[];
    phoneNumbers?: string[];
    customCondition?: string;
  }>(),
  priority: integer("priority").default(0),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// MCP Server configurations table
export const mcpServerConfigurations = sqliteTable("mcp_server_configurations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  serverType: text("server_type").notNull(), // sse, streamable_http
  url: text("url").notNull(),
  secretToken: text("secret_token"), // encrypted
  approvalMode: text("approval_mode").default("always_ask"), // always_ask, fine_grained, no_approval
  trusted: integer("trusted", { mode: 'boolean' }).default(false),
  allowedTools: text("allowed_tools", { mode: 'json' }).$type<string[]>(),
  configuration: text("configuration", { mode: 'json' }).$type<Record<string, any>>(),
  status: text("status").default("inactive"), // active, inactive, error
  lastConnected: integer("last_connected", { mode: 'timestamp' }),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agency Commissions table for tracking revenue sharing
export const agencyCommissions = sqliteTable("agency_commissions", {
  id: text("id").primaryKey(),
  agencyOrganizationId: text("agency_organization_id").notNull(), // Agency who earned commission
  customerOrganizationId: text("customer_organization_id").notNull(), // Customer who made purchase
  paymentId: text("payment_id"), // Link to payment record
  amount: real("amount").notNull(), // Commission amount
  rate: real("rate").notNull(), // Commission rate applied
  status: text("status").default("pending"), // pending, paid, cancelled
  paidAt: integer("paid_at", { mode: 'timestamp' }),
  description: text("description"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Credit Transactions table for tracking credit purchases and usage
export const creditTransactions = sqliteTable("credit_transactions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  type: text("type").notNull(), // purchase, usage, refund, commission, transfer
  amount: real("amount").notNull(), // Positive for credits, negative for debits
  creditAmount: integer("credit_amount"), // Number of credits (if applicable)
  balanceBefore: real("balance_before"),
  balanceAfter: real("balance_after"),
  relatedPaymentId: text("related_payment_id"), // Link to payment if purchase
  relatedCallId: text("related_call_id"), // Link to call if usage
  description: text("description"),
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Agency Invitations table for onboarding new agencies
export const agencyInvitations = sqliteTable("agency_invitations", {
  id: text("id").primaryKey(),
  inviterOrganizationId: text("inviter_organization_id").notNull(), // Platform owner who sent invitation
  inviteeEmail: text("invitee_email").notNull(),
  inviteeName: text("invitee_name"),
  inviteeCompany: text("invitee_company"),
  status: text("status").notNull().default("pending"),
  invitationCode: text("invitation_code").notNull().unique(), // Unique code for accepting invitation
  commissionRate: real("commission_rate").default(30), // Offered commission rate
  initialCredits: real("initial_credits").default(0), // Starting credit bonus
  customMessage: text("custom_message"),
  expiresAt: integer("expires_at", { mode: 'timestamp' }),
  acceptedAt: integer("accepted_at", { mode: 'timestamp' }),
  rejectedAt: integer("rejected_at", { mode: 'timestamp' }),
  createdOrganizationId: text("created_organization_id"), // Organization created when invitation accepted
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// User Invitations table for inviting users to organizations
export const userInvitations = sqliteTable("user_invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  email: text("email").notNull(),
  role: text("role").default("user"),
  permissions: text("permissions", { mode: 'json' }).$type<string[]>().default([]),
  invitedBy: text("invited_by").notNull(),
  status: text("status").notNull().default("pending"),
  code: text("code").notNull().unique(),
  expiresAt: integer("expires_at", { mode: 'timestamp' }),
  acceptedAt: integer("accepted_at", { mode: 'timestamp' }),
  acceptedBy: text("accepted_by"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Credit packages table for prepaid credit bundles
export const creditPackages = sqliteTable("credit_packages", {
  id: text("id").primaryKey(),
  packageType: text("package_type").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  credits: integer("credits").notNull(),
  bonusCredits: integer("bonus_credits").default(0), // Extra credits as bonus
  targetAudience: text("target_audience").notNull(), // agency or end_customer
  isMonthly: integer("is_monthly", { mode: 'boolean' }).default(false), // true for monthly plans, false for one-time packs
  features: text("features", { mode: 'json' }).$type<string[]>(),
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Credit alerts tracking table
export const creditAlerts = sqliteTable("credit_alerts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  alertType: text("alert_type").notNull(),
  creditPercentage: real("credit_percentage"), // Percentage remaining
  creditsRemaining: integer("credits_remaining"),
  message: text("message"),
  notificationSent: integer("notification_sent", { mode: 'boolean' }).default(false),
  emailSent: integer("email_sent", { mode: 'boolean' }).default(false),
  acknowledgedAt: integer("acknowledged_at", { mode: 'timestamp' }),
  acknowledgedBy: text("acknowledged_by"), // User ID who acknowledged
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("credit_alerts_org_idx").on(table.organizationId),
  index("credit_alerts_created_idx").on(table.createdAt),
]);

// Role Templates table for predefined role configurations
export const roleTemplates = sqliteTable("role_templates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"), // Null for system templates, org ID for custom
  name: text("name").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  organizationType: text("organization_type").notNull(),
  permissions: text("permissions", { mode: 'json' }).$type<string[]>().notNull(),
  isDefault: integer("is_default", { mode: 'boolean' }).default(false),
  isSystem: integer("is_system", { mode: 'boolean' }).default(false), // System templates can't be edited
  icon: text("icon"), // Icon name for UI
  color: text("color"), // Color for UI badge
  order: integer("order").default(0),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Audit Logs table for tracking all system changes
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  userId: text("user_id"),
  userEmail: text("user_email"),
  action: text("action").notNull(),
  entityType: text("entity_type"), // user, organization, agent, etc.
  entityId: text("entity_id"),
  changes: text("changes", { mode: 'json' }).$type<{
    before?: Record<string, any>;
    after?: Record<string, any>;
  }>(),
  metadata: text("metadata", { mode: 'json' }).$type<{
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    additionalInfo?: Record<string, any>;
  }>(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("audit_logs_org_idx").on(table.organizationId),
  index("audit_logs_user_idx").on(table.userId),
  index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  index("audit_logs_created_idx").on(table.createdAt),
]);

// Unified Billing Plans - Hierarchical billing structure for platform, agencies, and customers
export const unifiedBillingPlans = sqliteTable("unified_billing_plans", {
  id: text("id").primaryKey(),
  
  // Hierarchy
  parentPlanId: text("parent_plan_id"), // Reference to parent plan for inheritance
  createdByOrganizationId: text("created_by_organization_id").notNull(), // Platform or agency that created this
  organizationType: text("organization_type").notNull(), // Who can purchase this plan
  
  // Plan details
  name: text("name").notNull(),
  description: text("description"),
  planType: text("plan_type").notNull(), // 'subscription', 'one_time', 'usage_based', 'credit_pack'
  billingCycle: text("billing_cycle"), // 'monthly', 'quarterly', 'annual', null for one-time
  
  // Pricing
  basePrice: real("base_price").notNull(),
  setupFee: real("setup_fee").default(0),
  
  // Revenue sharing
  platformFeePercentage: real("platform_fee_percentage").default(30), // Platform takes this %
  agencyMarginPercentage: real("agency_margin_percentage").default(0), // Agency adds this margin
  
  // Features and limits
  features: text("features", { mode: 'json' }).$type<{
    maxAgents?: number;
    maxUsers?: number;
    maxMinutesPerMonth?: number;
    maxCallsPerMonth?: number;
    includedCredits?: number;
    perMinuteRate?: number;
    perCallRate?: number;
    customBranding?: boolean;
    whitelabel?: boolean;
    apiAccess?: boolean;
    supportLevel?: string;
  }>().notNull(),
  
  // Stripe/PayPal integration
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  paypalPlanId: text("paypal_plan_id"),
  
  // Display settings
  isActive: integer("is_active", { mode: 'boolean' }).default(true),
  isPopular: integer("is_popular", { mode: 'boolean' }).default(false),
  displayOrder: integer("display_order").default(0),
  
  // Metadata
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("unified_plans_parent_idx").on(table.parentPlanId),
  index("unified_plans_org_idx").on(table.createdByOrganizationId),
  index("unified_plans_type_idx").on(table.organizationType),
]);

// Payment Splits - Track how payments are distributed between platform and agencies
export const paymentSplits = sqliteTable("payment_splits", {
  id: text("id").primaryKey(),
  
  // References
  paymentId: text("payment_id").notNull(),
  fromOrganizationId: text("from_organization_id").notNull(), // Customer who paid
  toOrganizationId: text("to_organization_id").notNull(), // Platform or agency receiving
  
  // Split details
  splitType: text("split_type").notNull(), // 'platform_fee', 'agency_revenue', 'commission'
  amount: real("amount").notNull(),
  percentage: real("percentage"),
  
  // Transfer details
  transferStatus: text("transfer_status").default('pending'), // 'pending', 'processing', 'completed', 'failed'
  stripeTransferId: text("stripe_transfer_id"),
  transferredAt: integer("transferred_at", { mode: 'timestamp' }),
  
  // Error handling
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("payment_splits_payment_idx").on(table.paymentId),
  index("payment_splits_from_idx").on(table.fromOrganizationId),
  index("payment_splits_to_idx").on(table.toOrganizationId),
]);

// Unified Subscriptions - Single table for all subscription types
export const unifiedSubscriptions = sqliteTable("unified_subscriptions", {
  id: text("id").primaryKey(),
  
  // References
  organizationId: text("organization_id").notNull(), // Subscriber organization
  planId: text("plan_id").notNull(), // Unified billing plan
  parentSubscriptionId: text("parent_subscription_id"), // For nested subscriptions
  
  // Subscription details
  status: text("status").notNull().default("active"), // 'active', 'trialing', 'past_due', 'canceled', 'paused'
  
  // Billing periods
  currentPeriodStart: integer("current_period_start", { mode: 'timestamp' }).notNull(),
  currentPeriodEnd: integer("current_period_end", { mode: 'timestamp' }).notNull(),
  trialEnd: integer("trial_end", { mode: 'timestamp' }),
  cancelAt: integer("cancel_at", { mode: 'timestamp' }),
  canceledAt: integer("canceled_at", { mode: 'timestamp' }),
  pausedAt: integer("paused_at", { mode: 'timestamp' }),
  
  // Payment method
  stripeSubscriptionId: text("stripe_subscription_id"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  
  // Usage tracking
  currentUsage: text("current_usage", { mode: 'json' }).$type<{
    minutes?: number;
    calls?: number;
    agents?: number;
    users?: number;
    credits?: number;
  }>(),
  
  // Custom pricing overrides
  customPrice: real("custom_price"),
  discountPercentage: real("discount_percentage"),
  
  metadata: text("metadata", { mode: 'json' }).$type<Record<string, any>>(),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("unified_subs_org_idx").on(table.organizationId),
  index("unified_subs_plan_idx").on(table.planId),
  index("unified_subs_status_idx").on(table.status),
]);

// Whitelabel configurations for agencies
export const whitelabelConfigs = sqliteTable("whitelabel_configs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().unique(),
  
  // Basic branding
  appName: text("app_name").default("VoiceAI Dashboard"),
  companyName: text("company_name"),
  
  // Logo URLs (stored in cloud storage)
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  
  // Simple toggles
  removePlatformBranding: integer("remove_platform_branding", { mode: 'boolean' }).default(false),
  
  // Support links (optional)
  supportUrl: text("support_url"),
  documentationUrl: text("documentation_url"),
  
  // Metadata
  isActive: integer("is_active", { mode: 'boolean' }).notNull().default(true),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => [
  index("whitelabel_org_idx").on(table.organizationId),
]);


// Insert schemas for new tables
export const insertAgentTestSchema = createInsertSchema(agentTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWidgetConfigurationSchema = createInsertSchema(widgetConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSipTrunkConfigurationSchema = createInsertSchema(sipTrunkConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkspaceSettingsSchema = createInsertSchema(workspaceSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnalyticsDataSchema = createInsertSchema(analyticsData).omit({
  id: true,
  createdAt: true,
});

export const insertConversationFeedbackSchema = createInsertSchema(conversationFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertLlmUsageSchema = createInsertSchema(llmUsage).omit({
  id: true,
  createdAt: true,
});

export const insertAgentOverrideSchema = createInsertSchema(agentOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMcpServerConfigurationSchema = createInsertSchema(mcpServerConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgencyCommissionSchema = createInsertSchema(agencyCommissions).omit({
  id: true,
  createdAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertAgencyInvitationSchema = createInsertSchema(agencyInvitations).omit({
  id: true,
  invitationCode: true,
  createdAt: true,
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  code: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditPackageSchema = createInsertSchema(creditPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditAlertSchema = createInsertSchema(creditAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertRoleTemplateSchema = createInsertSchema(roleTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertWhitelabelConfigSchema = createInsertSchema(whitelabelConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgencyPaymentConfigSchema = createInsertSchema(agencyPaymentConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgencyPricingPlanSchema = createInsertSchema(agencyPricingPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgencySubscriptionSchema = createInsertSchema(agencySubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgencyTransactionSchema = createInsertSchema(agencyTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertAgencyPaymentProcessorSchema = createInsertSchema(agencyPaymentProcessors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgencyBillingPlanSchema = createInsertSchema(agencyBillingPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSubscriptionSchema = createInsertSchema(customerSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerPaymentMethodSchema = createInsertSchema(customerPaymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUnifiedBillingPlanSchema = createInsertSchema(unifiedBillingPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSplitSchema = createInsertSchema(paymentSplits).omit({
  id: true,
  createdAt: true,
});

export const insertUnifiedSubscriptionSchema = createInsertSchema(unifiedSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Payment relations (defined after billingPackages table)
export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  package: one(billingPackages, {
    fields: [payments.packageId],
    references: [billingPackages.id],
  }),
}));

export const billingPackagesRelations = relations(billingPackages, ({ many }) => ({
  payments: many(payments),
}));

// Batch call relations (must be after table definitions)
export const batchCallsRelations = relations(batchCalls, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [batchCalls.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [batchCalls.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [batchCalls.agentId],
    references: [agents.id],
  }),
  phoneNumber: one(phoneNumbers, {
    fields: [batchCalls.phoneNumberId],
    references: [phoneNumbers.id],
  }),
  recipients: many(batchCallRecipients),
}));

export const batchCallRecipientsRelations = relations(batchCallRecipients, ({ one }) => ({
  batchCall: one(batchCalls, {
    fields: [batchCallRecipients.batchCallId],
    references: [batchCalls.id],
  }),
}));

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type CustomTool = NonNullable<NonNullable<Agent['tools']>['customTools']>[number];
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type InsertPhoneNumber = z.infer<typeof insertPhoneNumberSchema>;
export type BillingPackage = typeof billingPackages.$inferSelect;
export type InsertBillingPackage = z.infer<typeof insertBillingPackageSchema>;
export type BatchCall = typeof batchCalls.$inferSelect;
export type InsertBatchCall = z.infer<typeof insertBatchCallSchema>;
export type BatchCallRecipient = typeof batchCallRecipients.$inferSelect;
export type InsertBatchCallRecipient = z.infer<typeof insertBatchCallRecipientSchema>;
export type SystemTemplate = typeof systemTemplates.$inferSelect;
export type InsertSystemTemplate = z.infer<typeof insertSystemTemplateSchema>;
export type RoleTemplate = typeof roleTemplates.$inferSelect;
export type InsertRoleTemplate = z.infer<typeof insertRoleTemplateSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type InsertCreditPackage = z.infer<typeof insertCreditPackageSchema>;
export type CreditAlert = typeof creditAlerts.$inferSelect;
export type InsertCreditAlert = z.infer<typeof insertCreditAlertSchema>;
export type QuickActionButton = typeof quickActionButtons.$inferSelect;
export type InsertQuickActionButton = z.infer<typeof insertQuickActionButtonSchema>;
export type AdminTask = typeof adminTasks.$inferSelect;
export type InsertAdminTask = z.infer<typeof insertAdminTaskSchema>;
export type ApprovalWebhook = typeof approvalWebhooks.$inferSelect;
export type InsertApprovalWebhook = z.infer<typeof insertApprovalWebhookSchema>;
export type AgentTest = typeof agentTests.$inferSelect;
export type InsertAgentTest = z.infer<typeof insertAgentTestSchema>;
export type WidgetConfiguration = typeof widgetConfigurations.$inferSelect;
export type InsertWidgetConfiguration = z.infer<typeof insertWidgetConfigurationSchema>;
export type SipTrunkConfiguration = typeof sipTrunkConfigurations.$inferSelect;
export type InsertSipTrunkConfiguration = z.infer<typeof insertSipTrunkConfigurationSchema>;
export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;
export type InsertWorkspaceSettings = z.infer<typeof insertWorkspaceSettingsSchema>;
export type AnalyticsData = typeof analyticsData.$inferSelect;
export type InsertAnalyticsData = z.infer<typeof insertAnalyticsDataSchema>;
export type ConversationFeedback = typeof conversationFeedback.$inferSelect;
export type InsertConversationFeedback = z.infer<typeof insertConversationFeedbackSchema>;
export type LlmUsage = typeof llmUsage.$inferSelect;
export type InsertLlmUsage = z.infer<typeof insertLlmUsageSchema>;
export type AgentOverride = typeof agentOverrides.$inferSelect;
export type InsertAgentOverride = z.infer<typeof insertAgentOverrideSchema>;
export type McpServerConfiguration = typeof mcpServerConfigurations.$inferSelect;
export type InsertMcpServerConfiguration = z.infer<typeof insertMcpServerConfigurationSchema>;
export type AgencyCommission = typeof agencyCommissions.$inferSelect;
export type InsertAgencyCommission = z.infer<typeof insertAgencyCommissionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type AgencyInvitation = typeof agencyInvitations.$inferSelect;
export type InsertAgencyInvitation = z.infer<typeof insertAgencyInvitationSchema>;
export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type WhitelabelConfig = typeof whitelabelConfigs.$inferSelect;
export type InsertWhitelabelConfig = z.infer<typeof insertWhitelabelConfigSchema>;
export type AgencyPaymentConfig = typeof agencyPaymentConfig.$inferSelect;
export type InsertAgencyPaymentConfig = z.infer<typeof insertAgencyPaymentConfigSchema>;
export type AgencyPricingPlan = typeof agencyPricingPlans.$inferSelect;
export type InsertAgencyPricingPlan = z.infer<typeof insertAgencyPricingPlanSchema>;
export type AgencySubscription = typeof agencySubscriptions.$inferSelect;
export type InsertAgencySubscription = z.infer<typeof insertAgencySubscriptionSchema>;
export type AgencyTransaction = typeof agencyTransactions.$inferSelect;
export type InsertAgencyTransaction = z.infer<typeof insertAgencyTransactionSchema>;
export type UnifiedBillingPlan = typeof unifiedBillingPlans.$inferSelect;
export type InsertUnifiedBillingPlan = z.infer<typeof insertUnifiedBillingPlanSchema>;
export type PaymentSplit = typeof paymentSplits.$inferSelect;
export type InsertPaymentSplit = z.infer<typeof insertPaymentSplitSchema>;
export type UnifiedSubscription = typeof unifiedSubscriptions.$inferSelect;
export type InsertUnifiedSubscription = z.infer<typeof insertUnifiedSubscriptionSchema>;
export type AgencyPaymentProcessor = typeof agencyPaymentProcessors.$inferSelect;
export type InsertAgencyPaymentProcessor = z.infer<typeof insertAgencyPaymentProcessorSchema>;
export type AgencyBillingPlan = typeof agencyBillingPlans.$inferSelect;
export type InsertAgencyBillingPlan = z.infer<typeof insertAgencyBillingPlanSchema>;
export type CustomerSubscription = typeof customerSubscriptions.$inferSelect;
export type InsertCustomerSubscription = z.infer<typeof insertCustomerSubscriptionSchema>;
export type CustomerPaymentMethod = typeof customerPaymentMethods.$inferSelect;
export type InsertCustomerPaymentMethod = z.infer<typeof insertCustomerPaymentMethodSchema>;
