import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  json,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  pgEnum,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  organizationId: varchar("organization_id").notNull(),
  isAdmin: boolean("is_admin").default(false),
  role: varchar("role").default("user"), // user, admin, agency, owner, manager, viewer
  roleTemplate: varchar("role_template"), // Reference to the role template used
  status: varchar("status").default("active"), // active, inactive, pending
  permissions: jsonb("permissions").$type<string[]>().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>(), // Custom user attributes
  lastLoginAt: timestamp("last_login_at"),
  invitedBy: varchar("invited_by"), // User ID who invited this user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing package enum
export const billingPackageEnum = pgEnum("billing_package", ["starter", "professional", "enterprise", "custom"]);

// Organization type enum for multi-tier hierarchy
export const organizationTypeEnum = pgEnum("organization_type", ["platform_owner", "agency", "end_customer"]);

// Credit package type enum
export const creditPackageTypeEnum = pgEnum("credit_package_type", [
  "agency_starter", "agency_growth", "agency_scale",
  "customer_basic", "customer_professional", "customer_business", "customer_enterprise"
]);

// Credit alert status enum
export const creditAlertStatusEnum = pgEnum("credit_alert_status", [
  "normal", "warning_25", "warning_10", "critical_5", "depleted"
]);

// Organizations table for multi-tenancy and multi-tier hierarchy
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  subdomain: varchar("subdomain"), // Custom subdomain for agency (e.g., 'agency-name' for agency-name.voiceai.com)
  customDomain: varchar("custom_domain"), // Full custom domain (e.g., dashboard.agency.com)
  parentOrganizationId: varchar("parent_organization_id"), // For hierarchy (agencies have parent, end customers have agency as parent)
  organizationType: organizationTypeEnum("organization_type").default("end_customer"), // platform_owner, agency, end_customer
  billingPackage: billingPackageEnum("billing_package").default("starter"),
  perCallRate: decimal("per_call_rate", { precision: 10, scale: 4 }).default('0.30'),
  perMinuteRate: decimal("per_minute_rate", { precision: 10, scale: 4 }).default('0.30'),
  monthlyCredits: integer("monthly_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  creditBalance: decimal("credit_balance", { precision: 10, scale: 2 }).default('0'), // Prepaid credits for agencies
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default('30'), // Percentage agencies keep from sales
  creditResetDate: timestamp("credit_reset_date"),
  customRateEnabled: boolean("custom_rate_enabled").default(false),
  maxAgents: integer("max_agents").default(5),
  maxUsers: integer("max_users").default(10),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeConnectAccountId: varchar("stripe_connect_account_id"), // For agencies to receive payouts
  subscriptionId: varchar("subscription_id"),
  billingStatus: varchar("billing_status").default('inactive'), // active, inactive, past_due, warning, paused
  creditAlertStatus: creditAlertStatusEnum("credit_alert_status").default("normal"),
  lastAlertSentAt: timestamp("last_alert_sent_at"),
  servicePausedAt: timestamp("service_paused_at"),
  lastPaymentDate: timestamp("last_payment_date"),
  // New fields for enhanced management
  metadata: jsonb("metadata").$type<Record<string, any>>(), // Flexible custom attributes
  settings: jsonb("settings").$type<{ // Organization-specific settings
    defaultUserRole?: string;
    autoProvisionResources?: boolean;
    welcomeMessage?: string;
    maxApiCallsPerDay?: number;
    customBranding?: {
      logo?: string;
      companyUrl?: string;
    };
  }>(),
  tierLimits: jsonb("tier_limits").$type<{ // Resource usage limits
    maxMinutesPerMonth?: number;
    maxCallsPerMonth?: number;
    maxStorageGB?: number;
    maxConcurrentCalls?: number;
  }>(),
  agencyPermissions: jsonb("agency_permissions").$type<string[]>().default([]), // Agency-level permissions
  agencyRole: varchar("agency_role"), // Role template for agency permissions
  elevenLabsApiKeyHash: varchar("elevenlabs_api_key_hash"), // Hash of current ElevenLabs API key to detect changes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Integration status enum
export const integrationStatusEnum = pgEnum("integration_status", ["ACTIVE", "INACTIVE", "ERROR", "PENDING_APPROVAL"]);

// Phone number provider enum
export const phoneProviderEnum = pgEnum("phone_provider", ["twilio", "sip_trunk"]);

// Phone number status enum  
export const phoneStatusEnum = pgEnum("phone_status", ["active", "inactive", "pending"]);

// Task status enum
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed", "rejected"]);

// Task type enum
export const taskTypeEnum = pgEnum("task_type", ["integration_approval", "webhook_approval", "agent_approval"]);

// RAG Configuration approval status enum

// Integrations table for storing API keys
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  provider: varchar("provider").notNull(), // 'elevenlabs'
  apiKey: varchar("api_key").notNull(), // encrypted
  apiKeyLast4: varchar("api_key_last4", { length: 4 }), // Last 4 chars for display
  status: integrationStatusEnum("status").notNull().default("PENDING_APPROVAL"),
  lastTested: timestamp("last_tested"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on organizationId and provider for upsert operations
  uniqueOrgProvider: unique("unique_org_provider").on(table.organizationId, table.provider),
}));

// Admin tasks table for tracking approvals
export const adminTasks = pgTable("admin_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: taskTypeEnum("type").notNull(),
  status: taskStatusEnum("status").notNull().default("pending"),
  title: varchar("title").notNull(),
  description: text("description"),
  relatedEntityId: varchar("related_entity_id").notNull(), // ID of integration/webhook/agent
  relatedEntityType: varchar("related_entity_type").notNull(), // 'integration', 'webhook', 'agent'
  organizationId: varchar("organization_id").notNull(),
  requestedBy: varchar("requested_by").notNull(), // User ID who requested
  approvedBy: varchar("approved_by"), // Admin ID who approved
  rejectedBy: varchar("rejected_by"), // Admin ID who rejected
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Approval webhooks table for notification endpoints
export const approvalWebhooks = pgTable("approval_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  webhookUrl: text("webhook_url").notNull(),
  secret: varchar("secret"), // For webhook signature verification
  events: json("events").$type<string[]>().notNull(), // ['task.created', 'task.approved', 'task.rejected']
  isActive: boolean("is_active").notNull().default(true),
  headers: json("headers").$type<Record<string, string>>(), // Custom headers to send with webhook
  lastTriggered: timestamp("last_triggered"),
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Phone numbers table
export const phoneNumbers = pgTable("phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  label: varchar("label").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  countryCode: varchar("country_code").notNull().default("+1"),
  provider: phoneProviderEnum("provider").notNull(),
  twilioAccountSid: varchar("twilio_account_sid"),
  twilioAuthToken: varchar("twilio_auth_token"), // encrypted
  sipTrunkUri: varchar("sip_trunk_uri"),
  sipUsername: varchar("sip_username"),
  sipPassword: varchar("sip_password"), // encrypted
  elevenLabsPhoneId: varchar("eleven_labs_phone_id"),
  agentId: varchar("agent_id"), // Local agent ID
  elevenLabsAgentId: varchar("elevenlabs_agent_id"), // ElevenLabs agent ID
  status: phoneStatusEnum("status").notNull().default("pending"),
  lastSynced: timestamp("last_synced"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System Templates table (managed by admins only)
export const systemTemplates = pgTable("system_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  content: text("content").notNull(),
  icon: varchar("icon"), // Icon name from lucide-react
  color: varchar("color"), // Tailwind color class
  order: integer("order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quick Action Buttons table (system buttons managed by admins, user buttons by users)
export const quickActionButtons = pgTable("quick_action_buttons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  prompt: text("prompt").notNull(),
  icon: varchar("icon").default("Sparkles"), // Icon name from lucide-react
  color: varchar("color").default("bg-blue-500 hover:bg-blue-600"), // Tailwind color classes
  category: varchar("category"), // To group related buttons
  order: integer("order").default(0),
  isSystem: boolean("is_system").notNull().default(false), // System buttons managed by admin only
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"), // User who created the button
  organizationId: varchar("organization_id"), // For user-created buttons
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agents table
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  elevenLabsAgentId: varchar("eleven_labs_agent_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  firstMessage: text("first_message"),
  systemPrompt: text("system_prompt"),
  language: varchar("language").default("en"),
  voiceId: varchar("voice_id"),
  voiceSettings: json("voice_settings").$type<{
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  }>(),
  multiVoiceConfig: json("multi_voice_config").$type<{
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
  llmSettings: json("llm_settings").$type<{
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }>(),
  tools: json("tools").$type<{
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
  dynamicVariables: json("dynamic_variables").$type<Record<string, string>>(),
  evaluationCriteria: json("evaluation_criteria").$type<{
    enabled?: boolean;
    criteria?: string[];
  }>(),
  dataCollection: json("data_collection").$type<{
    enabled?: boolean;
    fields?: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
  }>(),
  promptTemplates: json("prompt_templates").$type<Array<{
    id: string;
    name: string;
    content: string;
  }>>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User-Agent assignments table (maps which users can access which agents)
export const userAgents = pgTable("user_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  agentId: varchar("agent_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by"), // User ID of who made the assignment
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
export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(), // Required ElevenLabs conversation ID
  organizationId: varchar("organization_id").notNull(),
  agentId: varchar("agent_id"),
  elevenLabsCallId: varchar("eleven_labs_call_id"),
  phoneNumber: varchar("phone_number"), // Caller's phone number for real calls
  duration: integer("duration"), // in seconds
  transcript: json("transcript"),
  audioUrl: varchar("audio_url"),
  cost: decimal("cost", { precision: 10, scale: 4 }),
  status: varchar("status"), // completed, failed, in_progress
  summary: text("summary"), // AI-generated call summary
  summaryGeneratedAt: timestamp("summary_generated_at"), // When summary was created
  summaryStatus: varchar("summary_status"), // pending | success | failed | null
  summaryMetadata: json("summary_metadata").$type<SummaryMetadata | null>(), // Summary generation metadata
  audioStorageKey: varchar("audio_storage_key"), // Path to stored audio file in audio-storage/
  audioFetchStatus: varchar("audio_fetch_status"), // 'pending' | 'available' | 'failed' | 'unavailable' | null
  audioFetchedAt: timestamp("audio_fetched_at"), // Last fetch attempt timestamp
  recordingUrl: varchar("recording_url"), // Public URL for playback
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded"]);

// Payments table for tracking all payments
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  packageId: varchar("package_id"),
  planId: varchar("plan_id"), // Unified billing plan ID
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  platformAmount: decimal("platform_amount", { precision: 10, scale: 2 }), // Amount platform keeps
  agencyAmount: decimal("agency_amount", { precision: 10, scale: 2 }), // Amount agency receives
  currency: varchar("currency").default('usd'),
  status: paymentStatusEnum("status").notNull().default("pending"),
  paymentMethod: varchar("payment_method"), // stripe, paypal
  transactionId: varchar("transaction_id"), // External payment provider transaction ID
  stripeTransferId: varchar("stripe_transfer_id"), // Stripe Connect transfer ID
  description: text("description"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agency billing cycle enum
export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "quarterly", "annual", "one_time"]);

// Agency subscription status enum
export const agencySubscriptionStatusEnum = pgEnum("agency_subscription_status", ["active", "past_due", "canceled", "trialing", "paused"]);

// Agency Payment Configuration table - stores payment gateway settings for agencies
export const agencyPaymentConfig = pgTable("agency_payment_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique(), // Agency organization ID
  
  // Stripe configuration
  stripeSecretKey: text("stripe_secret_key"), // Encrypted
  stripePublishableKey: varchar("stripe_publishable_key"),
  stripeWebhookSecret: text("stripe_webhook_secret"), // Encrypted
  
  // PayPal configuration
  paypalClientId: varchar("paypal_client_id"),
  paypalClientSecret: text("paypal_client_secret"), // Encrypted
  paypalWebhookId: varchar("paypal_webhook_id"),
  
  // General settings
  defaultGateway: varchar("default_gateway"), // 'stripe' or 'paypal'
  currency: varchar("currency").default('usd'),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default('0'),
  
  // Status
  isConfigured: boolean("is_configured").default(false),
  lastVerifiedAt: timestamp("last_verified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agency Pricing Plans - agencies define their subscription plans
export const agencyPricingPlans = pgTable("agency_pricing_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(), // Agency organization ID
  
  // Plan details
  name: varchar("name").notNull(),
  description: text("description"),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).default('0'),
  currency: varchar("currency").default('usd'),
  
  // Trial settings
  trialDays: integer("trial_days").default(0),
  
  // Feature limits
  features: jsonb("features").$type<{
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
  isActive: boolean("is_active").default(true),
  isPopular: boolean("is_popular").default(false),
  
  // Stripe/PayPal product IDs
  stripeProductId: varchar("stripe_product_id"),
  stripePriceId: varchar("stripe_price_id"),
  paypalPlanId: varchar("paypal_plan_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agency Subscriptions - tracks user subscriptions to agency plans
export const agencySubscriptions = pgTable("agency_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  userId: varchar("user_id").notNull(),
  organizationId: varchar("organization_id").notNull(), // Customer organization
  agencyOrganizationId: varchar("agency_organization_id").notNull(), // Agency organization
  planId: varchar("plan_id").notNull(),
  
  // Subscription details
  status: agencySubscriptionStatusEnum("status").notNull().default("active"),
  
  // Billing details
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAt: timestamp("cancel_at"),
  canceledAt: timestamp("canceled_at"),
  trialEnd: timestamp("trial_end"),
  
  // Payment method
  paymentMethod: varchar("payment_method"), // 'stripe' or 'paypal'
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  paypalSubscriptionId: varchar("paypal_subscription_id"),
  
  // Usage tracking
  usageThisMonth: jsonb("usage_this_month").$type<{
    minutes?: number;
    calls?: number;
    apiRequests?: number;
  }>(),
  
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agency Transactions - payment history for agency billing
export const agencyTransactions = pgTable("agency_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  subscriptionId: varchar("subscription_id"),
  userId: varchar("user_id").notNull(),
  organizationId: varchar("organization_id").notNull(), // Customer organization
  agencyOrganizationId: varchar("agency_organization_id").notNull(), // Agency organization
  
  // Transaction details
  type: varchar("type").notNull(), // 'subscription', 'one_time', 'refund', 'credit'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default('usd'),
  status: paymentStatusEnum("status").notNull().default("pending"),
  
  // Payment details
  paymentMethod: varchar("payment_method"), // 'stripe' or 'paypal'
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  paypalOrderId: varchar("paypal_order_id"),
  
  // Invoice details
  invoiceNumber: varchar("invoice_number"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  
  // Timestamps
  paidAt: timestamp("paid_at"),
  failedAt: timestamp("failed_at"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment processor status enum
export const paymentProcessorStatusEnum = pgEnum("payment_processor_status", ["pending_validation", "active", "invalid", "disabled"]);

// Agency Payment Processors table - stores encrypted payment gateway settings for agencies
export const agencyPaymentProcessors = pgTable("agency_payment_processors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(), // Agency organization ID
  provider: varchar("provider").notNull(), // 'stripe' or 'paypal'
  
  // Encrypted credentials (AES-256-GCM)
  encryptedCredentials: text("encrypted_credentials").notNull(), // JSON with encrypted keys
  
  // Validation status
  status: paymentProcessorStatusEnum("status").notNull().default("pending_validation"),
  lastValidatedAt: timestamp("last_validated_at"),
  validationError: text("validation_error"),
  
  // Configuration
  isDefault: boolean("is_default").default(false),
  webhookEndpoint: varchar("webhook_endpoint"), // Agency-specific webhook URL
  
  // Metadata
  metadata: jsonb("metadata").$type<{
    publicKey?: string; // Stripe publishable key (safe to expose)
    webhookId?: string; // PayPal webhook ID
    mode?: "sandbox" | "production";
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on organizationId and provider for upsert operations
  uniqueOrgProvider: unique("unique_org_processor").on(table.organizationId, table.provider),
}));

// Agency Billing Plans table - comprehensive billing plans created by agencies
export const agencyBillingPlans = pgTable("agency_billing_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(), // Agency organization ID
  
  // Plan details
  name: varchar("name").notNull(),
  description: text("description"),
  billingCycle: billingCycleEnum("billing_cycle").notNull(), // monthly, quarterly, annual, one_time
  
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).default('0'),
  currency: varchar("currency").default('usd'),
  
  // Trial settings
  trialPeriodDays: integer("trial_period_days").default(0),
  
  // Features and limits
  features: jsonb("features").$type<{
    highlights: string[]; // Marketing bullet points
    callsLimit?: number;
    minutesLimit?: number;
    storageLimit?: number; // In GB
    agentsLimit?: number;
    customLimits?: Record<string, any>;
  }>().notNull(),
  
  // Payment processor product IDs
  stripeProductId: varchar("stripe_product_id"),
  stripePriceId: varchar("stripe_price_id"),
  paypalPlanId: varchar("paypal_plan_id"),
  
  // Display settings
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  isPublic: boolean("is_public").default(true), // Whether plan is visible to customers
  isPopular: boolean("is_popular").default(false),
  
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer subscription status enum
export const customerSubscriptionStatusEnum = pgEnum("customer_subscription_status", ["active", "past_due", "canceled", "trialing", "paused", "expired"]);

// Customer Subscriptions table - tracks customer subscriptions to agency plans
export const customerSubscriptions = pgTable("customer_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  agencyOrganizationId: varchar("agency_organization_id").notNull(), // Agency organization ID
  customerOrganizationId: varchar("customer_organization_id").notNull(), // Customer organization ID
  userId: varchar("user_id").notNull(), // User who subscribed
  planId: varchar("plan_id").notNull(), // Agency billing plan ID
  
  // Subscription details
  status: customerSubscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  
  // Payment processor subscription IDs
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  paypalSubscriptionId: varchar("paypal_subscription_id"),
  paymentProcessor: varchar("payment_processor"), // 'stripe' or 'paypal'
  
  // Trial information
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  
  // Usage tracking
  usageData: jsonb("usage_data").$type<{
    callsUsed: number;
    minutesUsed: number;
    storageUsed?: number;
    customUsage?: Record<string, any>;
  }>().default({ callsUsed: 0, minutesUsed: 0 }),
  
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  canceledAt: timestamp("canceled_at"),
});

// Customer Payment Methods table - stores customer payment methods linked to agency processors
export const customerPaymentMethods = pgTable("customer_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  agencyOrganizationId: varchar("agency_organization_id").notNull(), // Agency organization ID
  customerOrganizationId: varchar("customer_organization_id").notNull(), // Customer organization ID
  userId: varchar("user_id").notNull(), // User who added the payment method
  
  // Payment method details
  type: varchar("type").notNull(), // 'card', 'bank_account', 'paypal'
  provider: varchar("provider").notNull(), // 'stripe' or 'paypal'
  
  // Provider-specific IDs (encrypted)
  stripePaymentMethodId: varchar("stripe_payment_method_id"),
  stripeCustomerId: varchar("stripe_customer_id"),
  paypalBillingAgreementId: varchar("paypal_billing_agreement_id"),
  
  // Display information (safe to expose)
  displayName: varchar("display_name"), // e.g., "Visa ending in 4242"
  last4: varchar("last4"), // Last 4 digits of card
  brand: varchar("brand"), // Card brand (visa, mastercard, etc.)
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  
  // Status
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export const batchCalls = pgTable("batch_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  agentId: varchar("agent_id").notNull(),
  phoneNumberId: varchar("phone_number_id"),
  elevenlabsBatchId: varchar("elevenlabs_batch_id"),
  status: varchar("status").notNull().default("draft"), // draft, pending, in_progress, completed, failed, cancelled
  totalRecipients: integer("total_recipients").default(0),
  completedCalls: integer("completed_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Batch Call Recipients table
export const batchCallRecipients = pgTable("batch_call_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchCallId: varchar("batch_call_id").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, calling, completed, failed, no_answer, busy
  variables: jsonb("variables"), // Dynamic variables for personalization
  callDuration: integer("call_duration"), // in seconds
  callCost: decimal("call_cost", { precision: 10, scale: 4 }),
  errorMessage: text("error_message"),
  conversationId: varchar("conversation_id"),
  calledAt: timestamp("called_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing Packages table with multi-tier support
export const billingPackages = pgTable("billing_packages", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  displayName: varchar("display_name").notNull(),
  createdByOrganizationId: varchar("created_by_organization_id"), // Who created this package (null for platform packages)
  availableToType: organizationTypeEnum("available_to_type").default("end_customer"), // Which tier can buy this
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }), // What agents pay for this package
  marginPercentage: decimal("margin_percentage", { precision: 5, scale: 2 }).default('30'), // Maximum margin agents can add
  perCallRate: decimal("per_call_rate", { precision: 10, scale: 4 }).notNull(),
  perMinuteRate: decimal("per_minute_rate", { precision: 10, scale: 4 }).notNull(),
  monthlyCredits: integer("monthly_credits").notNull(),
  maxAgents: integer("max_agents").notNull(),
  maxUsers: integer("max_users").notNull(),
  features: jsonb("features").notNull().default('[]'),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  stripeProductId: varchar("stripe_product_id"),
  stripePriceId: varchar("stripe_price_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export const agentTests = pgTable("agent_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  agentId: varchar("agent_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  testScenarios: json("test_scenarios").$type<Array<{
    id: string;
    name: string;
    userInput: string;
    expectedResponse?: string;
    variables?: Record<string, string>;
    success?: boolean;
    actualResponse?: string;
  }>>(),
  results: json("results").$type<{
    totalTests: number;
    passed: number;
    failed: number;
    lastRunAt?: string;
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Widget configurations table
export const widgetConfigurations = pgTable("widget_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  agentId: varchar("agent_id").notNull(),
  name: varchar("name").notNull(),
  variant: varchar("variant").default("full"), // full, compact, minimal
  placement: varchar("placement").default("bottom-right"),
  bgColor: varchar("bg_color").default("#ffffff"),
  textColor: varchar("text_color").default("#000000"),
  btnColor: varchar("btn_color").default("#000000"),
  btnTextColor: varchar("btn_text_color").default("#ffffff"),
  borderRadius: integer("border_radius").default(8),
  actionText: text("action_text"),
  startCallText: text("start_call_text"),
  endCallText: text("end_call_text"),
  expandText: text("expand_text"),
  listeningText: text("listening_text"),
  speakingText: text("speaking_text"),
  showAvatar: boolean("show_avatar").default(true),
  disableBanner: boolean("disable_banner").default(false),
  micMutingEnabled: boolean("mic_muting_enabled").default(false),
  transcriptEnabled: boolean("transcript_enabled").default(false),
  textInputEnabled: boolean("text_input_enabled").default(true),
  defaultExpanded: boolean("default_expanded").default(false),
  alwaysExpanded: boolean("always_expanded").default(false),
  languageSelector: boolean("language_selector").default(false),
  supportsTextOnly: boolean("supports_text_only").default(true),
  customCss: text("custom_css"),
  embedCode: text("embed_code"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SIP Trunk configurations table
export const sipTrunkConfigurations = pgTable("sip_trunk_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: varchar("name").notNull(),
  uri: varchar("uri").notNull(),
  username: varchar("username"),
  password: varchar("password"), // encrypted
  domain: varchar("domain"),
  proxy: varchar("proxy"),
  transport: varchar("transport").default("udp"), // udp, tcp, tls
  registrationExpiry: integer("registration_expiry").default(3600),
  codec: varchar("codec").default("PCMU"), // PCMU, PCMA, G729, etc
  dtmfMode: varchar("dtmf_mode").default("rfc2833"), // rfc2833, inband, info
  callerIdName: varchar("caller_id_name"),
  callerIdNumber: varchar("caller_id_number"),
  maxConcurrentCalls: integer("max_concurrent_calls").default(10),
  status: varchar("status").default("inactive"), // active, inactive, error
  lastRegistered: timestamp("last_registered"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workspace settings table
export const workspaceSettings = pgTable("workspace_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique(),
  name: varchar("name").notNull(),
  logo: varchar("logo"),
  timezone: varchar("timezone").default("UTC"),
  dateFormat: varchar("date_format").default("MM/DD/YYYY"),
  timeFormat: varchar("time_format").default("12h"), // 12h, 24h
  language: varchar("language").default("en"),
  currency: varchar("currency").default("USD"),
  dataResidency: varchar("data_residency").default("us"), // us, eu, ap
  complianceSettings: json("compliance_settings").$type<{
    hipaa?: boolean;
    gdpr?: boolean;
    soc2?: boolean;
    zeroRetention?: boolean;
    recordingConsent?: boolean;
  }>(),
  securitySettings: json("security_settings").$type<{
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
  notificationSettings: json("notification_settings").$type<{
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    webhookNotifications?: boolean;
    dailyDigest?: boolean;
    weeklyReport?: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Analytics data table
export const analyticsData = pgTable("analytics_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  agentId: varchar("agent_id"),
  date: timestamp("date").notNull(),
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  totalMinutes: decimal("total_minutes", { precision: 10, scale: 2 }).default('0'),
  totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default('0'),
  averageCallDuration: decimal("average_call_duration", { precision: 10, scale: 2 }),
  averageSatisfaction: decimal("average_satisfaction", { precision: 3, scale: 2 }),
  uniqueCallers: integer("unique_callers").default(0),
  peakConcurrency: integer("peak_concurrency").default(0),
  languageBreakdown: json("language_breakdown").$type<Record<string, number>>(),
  errorBreakdown: json("error_breakdown").$type<Record<string, number>>(),
  hourlyDistribution: json("hourly_distribution").$type<number[]>(),
  toolUsage: json("tool_usage").$type<Record<string, number>>(),
  llmTokensUsed: integer("llm_tokens_used").default(0),
  llmCost: decimal("llm_cost", { precision: 10, scale: 4 }).default('0'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Conversation feedback table
export const conversationFeedback = pgTable("conversation_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  conversationId: varchar("conversation_id").notNull(),
  agentId: varchar("agent_id"),
  rating: integer("rating"), // 1-5
  feedback: text("feedback"),
  tags: json("tags").$type<string[]>(),
  sentiment: varchar("sentiment"), // positive, neutral, negative
  resolved: boolean("resolved").default(false),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// LLM Usage tracking table
export const llmUsage = pgTable("llm_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  agentId: varchar("agent_id"),
  conversationId: varchar("conversation_id"),
  model: varchar("model").notNull(),
  provider: varchar("provider").notNull(), // openai, anthropic, google
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  cost: decimal("cost", { precision: 10, scale: 6 }).default('0'),
  latency: integer("latency"), // in milliseconds
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agent overrides table
export const agentOverrides = pgTable("agent_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  agentId: varchar("agent_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  overrideConfig: json("override_config").$type<{
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
  conditions: json("conditions").$type<{
    timeRange?: { start: string; end: string };
    dayOfWeek?: string[];
    phoneNumbers?: string[];
    customCondition?: string;
  }>(),
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// MCP Server configurations table
export const mcpServerConfigurations = pgTable("mcp_server_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  serverType: varchar("server_type").notNull(), // sse, streamable_http
  url: varchar("url").notNull(),
  secretToken: varchar("secret_token"), // encrypted
  approvalMode: varchar("approval_mode").default("always_ask"), // always_ask, fine_grained, no_approval
  trusted: boolean("trusted").default(false),
  allowedTools: json("allowed_tools").$type<string[]>(),
  configuration: json("configuration").$type<Record<string, any>>(),
  status: varchar("status").default("inactive"), // active, inactive, error
  lastConnected: timestamp("last_connected"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transaction type enum for credit transactions
export const transactionTypeEnum = pgEnum("transaction_type", ["purchase", "usage", "refund", "commission", "transfer"]);

// Agency Commissions table for tracking revenue sharing
export const agencyCommissions = pgTable("agency_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyOrganizationId: varchar("agency_organization_id").notNull(), // Agency who earned commission
  customerOrganizationId: varchar("customer_organization_id").notNull(), // Customer who made purchase
  paymentId: varchar("payment_id"), // Link to payment record
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Commission amount
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(), // Commission rate applied
  status: varchar("status").default("pending"), // pending, paid, cancelled
  paidAt: timestamp("paid_at"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Credit Transactions table for tracking credit purchases and usage
export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  type: transactionTypeEnum("type").notNull(), // purchase, usage, refund, commission, transfer
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Positive for credits, negative for debits
  creditAmount: integer("credit_amount"), // Number of credits (if applicable)
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }),
  relatedPaymentId: varchar("related_payment_id"), // Link to payment if purchase
  relatedCallId: varchar("related_call_id"), // Link to call if usage
  description: text("description"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agency invitation status enum
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "rejected", "expired"]);

// Agency Invitations table for onboarding new agencies
export const agencyInvitations = pgTable("agency_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inviterOrganizationId: varchar("inviter_organization_id").notNull(), // Platform owner who sent invitation
  inviteeEmail: varchar("invitee_email").notNull(),
  inviteeName: varchar("invitee_name"),
  inviteeCompany: varchar("invitee_company"),
  status: invitationStatusEnum("status").notNull().default("pending"),
  invitationCode: varchar("invitation_code").notNull().unique(), // Unique code for accepting invitation
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default('30'), // Offered commission rate
  initialCredits: decimal("initial_credits", { precision: 10, scale: 2 }).default('0'), // Starting credit bonus
  customMessage: text("custom_message"),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  createdOrganizationId: varchar("created_organization_id"), // Organization created when invitation accepted
  createdAt: timestamp("created_at").defaultNow(),
});

// User Invitations table for inviting users to organizations
export const userInvitations = pgTable("user_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  email: varchar("email").notNull(),
  role: varchar("role").default("user"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  invitedBy: varchar("invited_by").notNull(),
  status: invitationStatusEnum("status").notNull().default("pending"),
  code: varchar("code").notNull().unique(),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  acceptedBy: varchar("accepted_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit packages table for prepaid credit bundles
export const creditPackages = pgTable("credit_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageType: creditPackageTypeEnum("package_type").notNull().unique(),
  name: varchar("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  credits: integer("credits").notNull(),
  bonusCredits: integer("bonus_credits").default(0), // Extra credits as bonus
  targetAudience: organizationTypeEnum("target_audience").notNull(), // agency or end_customer
  isMonthly: boolean("is_monthly").default(false), // true for monthly plans, false for one-time packs
  features: jsonb("features").$type<string[]>(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit alerts tracking table
export const creditAlerts = pgTable("credit_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  alertType: creditAlertStatusEnum("alert_type").notNull(),
  creditPercentage: decimal("credit_percentage", { precision: 5, scale: 2 }), // Percentage remaining
  creditsRemaining: integer("credits_remaining"),
  message: text("message"),
  notificationSent: boolean("notification_sent").default(false),
  emailSent: boolean("email_sent").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by"), // User ID who acknowledged
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("credit_alerts_org_idx").on(table.organizationId),
  index("credit_alerts_created_idx").on(table.createdAt),
]);

// Role Templates table for predefined role configurations
export const roleTemplates = pgTable("role_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"), // Null for system templates, org ID for custom
  name: varchar("name").notNull(),
  label: varchar("label").notNull(),
  description: text("description"),
  organizationType: organizationTypeEnum("organization_type").notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull(),
  isDefault: boolean("is_default").default(false),
  isSystem: boolean("is_system").default(false), // System templates can't be edited
  icon: varchar("icon"), // Icon name for UI
  color: varchar("color"), // Color for UI badge
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit action enum
export const auditActionEnum = pgEnum("audit_action", [
  "user_created", "user_updated", "user_deleted",
  "org_created", "org_updated", "org_deleted",
  "permission_granted", "permission_revoked",
  "agent_created", "agent_updated", "agent_deleted",
  "login", "logout", "password_changed",
  "billing_updated", "payment_processed"
]);

// Audit Logs table for tracking all system changes
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  userId: varchar("user_id"),
  userEmail: varchar("user_email"),
  action: auditActionEnum("action").notNull(),
  entityType: varchar("entity_type"), // user, organization, agent, etc.
  entityId: varchar("entity_id"),
  changes: jsonb("changes").$type<{
    before?: Record<string, any>;
    after?: Record<string, any>;
  }>(),
  metadata: jsonb("metadata").$type<{
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    additionalInfo?: Record<string, any>;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("audit_logs_org_idx").on(table.organizationId),
  index("audit_logs_user_idx").on(table.userId),
  index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  index("audit_logs_created_idx").on(table.createdAt),
]);

// Unified Billing Plans - Hierarchical billing structure for platform, agencies, and customers
export const unifiedBillingPlans = pgTable("unified_billing_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Hierarchy
  parentPlanId: varchar("parent_plan_id"), // Reference to parent plan for inheritance
  createdByOrganizationId: varchar("created_by_organization_id").notNull(), // Platform or agency that created this
  organizationType: organizationTypeEnum("organization_type").notNull(), // Who can purchase this plan
  
  // Plan details
  name: varchar("name").notNull(),
  description: text("description"),
  planType: varchar("plan_type").notNull(), // 'subscription', 'one_time', 'usage_based', 'credit_pack'
  billingCycle: varchar("billing_cycle"), // 'monthly', 'quarterly', 'annual', null for one-time
  
  // Pricing
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).default('0'),
  
  // Revenue sharing
  platformFeePercentage: decimal("platform_fee_percentage", { precision: 5, scale: 2 }).default('30'), // Platform takes this %
  agencyMarginPercentage: decimal("agency_margin_percentage", { precision: 5, scale: 2 }).default('0'), // Agency adds this margin
  
  // Features and limits
  features: jsonb("features").$type<{
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
  stripeProductId: varchar("stripe_product_id"),
  stripePriceId: varchar("stripe_price_id"),
  paypalPlanId: varchar("paypal_plan_id"),
  
  // Display settings
  isActive: boolean("is_active").default(true),
  isPopular: boolean("is_popular").default(false),
  displayOrder: integer("display_order").default(0),
  
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("unified_plans_parent_idx").on(table.parentPlanId),
  index("unified_plans_org_idx").on(table.createdByOrganizationId),
  index("unified_plans_type_idx").on(table.organizationType),
]);

// Payment Splits - Track how payments are distributed between platform and agencies
export const paymentSplits = pgTable("payment_splits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  paymentId: varchar("payment_id").notNull(),
  fromOrganizationId: varchar("from_organization_id").notNull(), // Customer who paid
  toOrganizationId: varchar("to_organization_id").notNull(), // Platform or agency receiving
  
  // Split details
  splitType: varchar("split_type").notNull(), // 'platform_fee', 'agency_revenue', 'commission'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  
  // Transfer details
  transferStatus: varchar("transfer_status").default('pending'), // 'pending', 'processing', 'completed', 'failed'
  stripeTransferId: varchar("stripe_transfer_id"),
  transferredAt: timestamp("transferred_at"),
  
  // Error handling
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("payment_splits_payment_idx").on(table.paymentId),
  index("payment_splits_from_idx").on(table.fromOrganizationId),
  index("payment_splits_to_idx").on(table.toOrganizationId),
]);

// Unified Subscriptions - Single table for all subscription types
export const unifiedSubscriptions = pgTable("unified_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  organizationId: varchar("organization_id").notNull(), // Subscriber organization
  planId: varchar("plan_id").notNull(), // Unified billing plan
  parentSubscriptionId: varchar("parent_subscription_id"), // For nested subscriptions
  
  // Subscription details
  status: varchar("status").notNull().default("active"), // 'active', 'trialing', 'past_due', 'canceled', 'paused'
  
  // Billing periods
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  trialEnd: timestamp("trial_end"),
  cancelAt: timestamp("cancel_at"),
  canceledAt: timestamp("canceled_at"),
  pausedAt: timestamp("paused_at"),
  
  // Payment method
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  paypalSubscriptionId: varchar("paypal_subscription_id"),
  
  // Usage tracking
  currentUsage: jsonb("current_usage").$type<{
    minutes?: number;
    calls?: number;
    agents?: number;
    users?: number;
    credits?: number;
  }>(),
  
  // Custom pricing overrides
  customPrice: decimal("custom_price", { precision: 10, scale: 2 }),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }),
  
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("unified_subs_org_idx").on(table.organizationId),
  index("unified_subs_plan_idx").on(table.planId),
  index("unified_subs_status_idx").on(table.status),
]);

// Whitelabel configurations for agencies
export const whitelabelConfigs = pgTable("whitelabel_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique(),
  
  // Basic branding
  appName: varchar("app_name").default("VoiceAI Dashboard"),
  companyName: varchar("company_name"),
  
  // Logo URLs (stored in cloud storage)
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  
  // Simple toggles
  removePlatformBranding: boolean("remove_platform_branding").default(false),
  
  // Support links (optional)
  supportUrl: text("support_url"),
  documentationUrl: text("documentation_url"),
  
  // Metadata
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
