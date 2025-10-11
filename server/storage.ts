import {
  users,
  organizations,
  integrations,
  agents,
  userAgents,
  callLogs,
  billingPackages,
  payments,
  phoneNumbers,
  batchCalls,
  batchCallRecipients,
  systemTemplates,
  quickActionButtons,
  adminTasks,
  approvalWebhooks,
  agencyCommissions,
  creditTransactions,
  agencyInvitations,
  userInvitations,
  creditPackages,
  creditAlerts,
  whitelabelConfigs,
  agencyPaymentConfig,
  agencyPricingPlans,
  agencySubscriptions,
  agencyTransactions,
  agencyPaymentProcessors,
  agencyBillingPlans,
  customerSubscriptions,
  customerPaymentMethods,
  type User,
  type UpsertUser,
  type Organization,
  type InsertOrganization,
  type Integration,
  type InsertIntegration,
  type Agent,
  type InsertAgent,
  type CallLog,
  type InsertCallLog,
  type BillingPackage,
  type Payment,
  type InsertPayment,
  type PhoneNumber,
  type InsertPhoneNumber,
  type BatchCall,
  type InsertBatchCall,
  type BatchCallRecipient,
  type InsertBatchCallRecipient,
  type SystemTemplate,
  type InsertSystemTemplate,
  type QuickActionButton,
  type InsertQuickActionButton,
  type AdminTask,
  type InsertAdminTask,
  type ApprovalWebhook,
  type InsertApprovalWebhook,
  type AgencyCommission,
  type InsertAgencyCommission,
  type CreditTransaction,
  type InsertCreditTransaction,
  type AgencyInvitation,
  type InsertAgencyInvitation,
  type UserInvitation,
  type InsertUserInvitation,
  type CreditPackage,
  type InsertCreditPackage,
  type CreditAlert,
  type InsertCreditAlert,
  type WhitelabelConfig,
  type InsertWhitelabelConfig,
  type AgencyPaymentConfig,
  type InsertAgencyPaymentConfig,
  type AgencyPricingPlan,
  type InsertAgencyPricingPlan,
  type AgencySubscription,
  type InsertAgencySubscription,
  type AgencyTransaction,
  type InsertAgencyTransaction,
  type AgencyPaymentProcessor,
  type InsertAgencyPaymentProcessor,
  type AgencyBillingPlan,
  type InsertAgencyBillingPlan,
  type CustomerSubscription,
  type InsertCustomerSubscription,
  type CustomerPaymentMethod,
  type InsertCustomerPaymentMethod,
  unifiedBillingPlans,
  paymentSplits,
  unifiedSubscriptions,
  type UnifiedBillingPlan,
  type InsertUnifiedBillingPlan,
  type PaymentSplit,
  type InsertPaymentSplit,
  type UnifiedSubscription,
  type InsertUnifiedSubscription,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sum, avg, max, or, inArray, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: Partial<User>): Promise<User>;
  
  // Agency user management operations
  getOrganizationUsers(organizationId: string): Promise<User[]>;
  updateUserPermissions(userId: string, organizationId: string, permissions: string[]): Promise<User>;
  updateUserRole(userId: string, organizationId: string, role: "admin" | "manager" | "user"): Promise<User>;
  removeUserFromOrganization(userId: string, organizationId: string): Promise<void>;
  assignAgentsToUser(userId: string, organizationId: string, agentIds: string[]): Promise<void>;
  getUserAssignedAgents(userId: string, organizationId: string): Promise<Agent[]>;
  getUsersWithAssignedAgents(userIds: string[], organizationId: string): Promise<Map<string, Agent[]>>;
  
  // User invitation operations
  createInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  getOrganizationInvitations(organizationId: string): Promise<UserInvitation[]>;
  getInvitation(id: string): Promise<UserInvitation | undefined>;
  getInvitationByCode(code: string): Promise<UserInvitation | undefined>;
  updateInvitation(id: string, updates: Partial<UserInvitation>): Promise<UserInvitation>;
  deleteInvitation(id: string): Promise<void>;
  acceptInvitation(invitationId: string, userId: string): Promise<void>;

  // Organization operations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySubdomain(subdomain: string): Promise<Organization | undefined>;
  getOrganizationByCustomDomain(domain: string): Promise<Organization | undefined>;
  updateOrganizationSubdomain(id: string, subdomain: string): Promise<Organization>;

  // Integration operations
  getIntegration(organizationId: string, provider: string): Promise<Integration | undefined>;
  getAllIntegrations(): Promise<Integration[]>;
  upsertIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegrationStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING_APPROVAL", lastTested?: Date): Promise<void>;
  
  // Whitelabel configuration operations
  getWhitelabelConfig(organizationId: string): Promise<WhitelabelConfig | undefined>;
  getAllWhitelabelConfigs(): Promise<WhitelabelConfig[]>;
  createWhitelabelConfig(config: InsertWhitelabelConfig): Promise<WhitelabelConfig>;
  updateWhitelabelConfig(organizationId: string, config: Partial<InsertWhitelabelConfig>): Promise<WhitelabelConfig>;
  
  // Admin task operations
  createAdminTask(task: InsertAdminTask): Promise<AdminTask>;
  getAdminTasks(status?: "pending" | "in_progress" | "completed" | "rejected"): Promise<AdminTask[]>;
  getAdminTask(id: string): Promise<AdminTask | undefined>;
  updateAdminTask(id: string, updates: Partial<AdminTask>): Promise<AdminTask>;
  completeApprovalTask(taskId: string, adminId: string): Promise<void>;

  // Agent operations
  getAgents(organizationId: string): Promise<Agent[]>;
  getAgent(id: string, organizationId: string): Promise<Agent | undefined>;
  getAgentByElevenLabsId(elevenLabsAgentId: string, organizationId: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, organizationId: string, updates: Partial<InsertAgent>): Promise<Agent>;
  deleteAgent(id: string, organizationId: string): Promise<void>;

  // Call log operations
  getCallLogs(organizationId: string, limit?: number, offset?: number, agentId?: string): Promise<{ data: CallLog[]; total: number }>;
  getCallLog(id: string, organizationId: string): Promise<CallLog | undefined>;
  getCallLogByElevenLabsId(elevenLabsCallId: string, organizationId: string): Promise<CallLog | undefined>;
  getCallLogByConversationId(organizationId: string, conversationId: string): Promise<CallLog | undefined>;
  createCallLog(callLog: InsertCallLog & { createdAt?: Date }): Promise<CallLog>;
  updateCallLog(id: string, organizationId: string, updates: Partial<InsertCallLog>): Promise<CallLog>;

  // Phone number operations
  getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]>;
  getPhoneNumber(id: string, organizationId: string): Promise<PhoneNumber | undefined>;
  createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber>;
  updatePhoneNumber(id: string, organizationId: string, updates: Partial<InsertPhoneNumber>): Promise<PhoneNumber>;
  deletePhoneNumber(id: string, organizationId: string): Promise<void>;

  // Analytics operations
  getOrganizationStats(organizationId: string, agentId?: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    estimatedCost: number;
    activeAgents: number;
    lastSync?: Date;
  }>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getAllOrganizations(): Promise<Organization[]>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization>;
  deleteOrganization(id: string): Promise<void>;
  toggleUserStatus(id: string, status: 'active' | 'inactive' | 'pending'): Promise<User>;
  toggleOrganizationStatus(id: string, isActive: boolean): Promise<Organization>;
  getAdminBillingData(): Promise<{
    totalUsers: number;
    totalOrganizations: number;
    totalCalls: number;
    totalRevenue: number;
    organizationsData: Array<{
      id: string;
      name: string;
      userCount: number;
      totalCalls: number;
      totalMinutes: number;
      estimatedCost: number;
      billingPackage?: string;
      perCallRate?: number;
      perMinuteRate?: number;
      monthlyCredits?: number;
      usedCredits?: number;
    }>;
  }>;
  
  // Billing operations
  getBillingPackages(): Promise<BillingPackage[]>;
  getBillingPackage(id: string): Promise<BillingPackage | undefined>;
  createBillingPackage(pkg: Partial<BillingPackage>): Promise<BillingPackage>;
  updateBillingPackage(id: string, updates: Partial<BillingPackage>): Promise<BillingPackage>;
  deleteBillingPackage(id: string): Promise<void>;

  // Payment operations  
  getPaymentHistory(organizationId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment>;

  // Agency Payment Configuration operations
  getAgencyPaymentConfig(organizationId: string): Promise<AgencyPaymentConfig | undefined>;
  createAgencyPaymentConfig(config: InsertAgencyPaymentConfig): Promise<AgencyPaymentConfig>;
  updateAgencyPaymentConfig(organizationId: string, updates: Partial<InsertAgencyPaymentConfig>): Promise<AgencyPaymentConfig>;
  
  // Agency Pricing Plan operations
  getAgencyPricingPlans(organizationId: string): Promise<AgencyPricingPlan[]>;
  getAgencyPricingPlan(id: string): Promise<AgencyPricingPlan | undefined>;
  createAgencyPricingPlan(plan: InsertAgencyPricingPlan): Promise<AgencyPricingPlan>;
  updateAgencyPricingPlan(id: string, updates: Partial<InsertAgencyPricingPlan>): Promise<AgencyPricingPlan>;
  deleteAgencyPricingPlan(id: string): Promise<void>;
  
  // Agency Subscription operations
  getAgencySubscriptions(agencyOrganizationId: string): Promise<AgencySubscription[]>;
  getAgencySubscription(id: string): Promise<AgencySubscription | undefined>;
  getUserSubscription(userId: string, agencyOrganizationId: string): Promise<AgencySubscription | undefined>;
  createAgencySubscription(subscription: InsertAgencySubscription): Promise<AgencySubscription>;
  updateAgencySubscription(id: string, updates: Partial<InsertAgencySubscription>): Promise<AgencySubscription>;
  cancelAgencySubscription(id: string): Promise<void>;
  
  // Agency Transaction operations
  getAgencyTransactions(agencyOrganizationId: string, limit?: number): Promise<AgencyTransaction[]>;
  getAgencyTransaction(id: string): Promise<AgencyTransaction | undefined>;
  createAgencyTransaction(transaction: InsertAgencyTransaction): Promise<AgencyTransaction>;
  updateAgencyTransaction(id: string, updates: Partial<InsertAgencyTransaction>): Promise<AgencyTransaction>;

  // Agency Payment Processor operations
  getAgencyPaymentProcessors(organizationId: string): Promise<AgencyPaymentProcessor[]>;
  getAgencyPaymentProcessor(organizationId: string, provider: string): Promise<AgencyPaymentProcessor | undefined>;
  createAgencyPaymentProcessor(processor: InsertAgencyPaymentProcessor): Promise<AgencyPaymentProcessor>;
  updateAgencyPaymentProcessor(id: string, updates: Partial<InsertAgencyPaymentProcessor>): Promise<AgencyPaymentProcessor>;
  deleteAgencyPaymentProcessor(organizationId: string, provider: string): Promise<void>;

  // Agency Billing Plan operations (new schema)
  getAgencyBillingPlans(organizationId: string, includeInactive?: boolean): Promise<AgencyBillingPlan[]>;
  getAgencyBillingPlan(id: string): Promise<AgencyBillingPlan | undefined>;
  createAgencyBillingPlan(plan: InsertAgencyBillingPlan): Promise<AgencyBillingPlan>;
  updateAgencyBillingPlan(id: string, updates: Partial<InsertAgencyBillingPlan>): Promise<AgencyBillingPlan>;
  deleteAgencyBillingPlan(id: string): Promise<void>;

  // Customer Subscription operations
  getCustomerSubscriptions(agencyOrganizationId: string): Promise<CustomerSubscription[]>;
  getCustomerSubscription(id: string): Promise<CustomerSubscription | undefined>;
  getCustomerSubscriptionByCustomer(customerOrganizationId: string): Promise<CustomerSubscription | undefined>;
  createCustomerSubscription(subscription: InsertCustomerSubscription): Promise<CustomerSubscription>;
  updateCustomerSubscription(id: string, updates: Partial<InsertCustomerSubscription>): Promise<CustomerSubscription>;
  cancelCustomerSubscription(id: string): Promise<void>;

  // Customer Payment Method operations
  getCustomerPaymentMethods(customerOrganizationId: string): Promise<CustomerPaymentMethod[]>;
  getCustomerPaymentMethod(id: string): Promise<CustomerPaymentMethod | undefined>;
  createCustomerPaymentMethod(method: InsertCustomerPaymentMethod): Promise<CustomerPaymentMethod>;
  updateCustomerPaymentMethod(id: string, updates: Partial<InsertCustomerPaymentMethod>): Promise<CustomerPaymentMethod>;
  deleteCustomerPaymentMethod(id: string): Promise<void>;
  setDefaultPaymentMethod(customerOrganizationId: string, methodId: string): Promise<void>;

  // Batch call operations
  getBatchCalls(organizationId: string): Promise<BatchCall[]>;
  getBatchCall(id: string, organizationId: string): Promise<BatchCall | undefined>;
  createBatchCall(data: InsertBatchCall): Promise<BatchCall>;
  updateBatchCall(id: string, organizationId: string, data: Partial<BatchCall>): Promise<BatchCall>;
  deleteBatchCall(id: string, organizationId: string): Promise<void>;

  // System template operations (admin only)
  getSystemTemplates(): Promise<SystemTemplate[]>;
  getSystemTemplate(id: string): Promise<SystemTemplate | undefined>;
  createSystemTemplate(template: InsertSystemTemplate): Promise<SystemTemplate>;
  updateSystemTemplate(id: string, updates: Partial<InsertSystemTemplate>): Promise<SystemTemplate>;
  deleteSystemTemplate(id: string): Promise<void>;
  
  // Quick Action Button operations
  getQuickActionButtons(organizationId?: string): Promise<QuickActionButton[]>;
  getQuickActionButton(id: string): Promise<QuickActionButton | undefined>;
  createQuickActionButton(button: InsertQuickActionButton): Promise<QuickActionButton>;
  updateQuickActionButton(id: string, updates: Partial<InsertQuickActionButton>): Promise<QuickActionButton>;
  deleteQuickActionButton(id: string): Promise<void>;
  
  // Batch call recipient operations
  getBatchCallRecipients(batchCallId: string): Promise<BatchCallRecipient[]>;
  createBatchCallRecipients(recipients: InsertBatchCallRecipient[]): Promise<BatchCallRecipient[]>;
  updateBatchCallRecipient(id: string, data: Partial<BatchCallRecipient>): Promise<BatchCallRecipient>;
  
  // Unified Billing Plan operations
  getUnifiedBillingPlans(organizationType?: string): Promise<UnifiedBillingPlan[]>;
  getUnifiedBillingPlan(id: string): Promise<UnifiedBillingPlan | undefined>;
  createUnifiedBillingPlan(plan: InsertUnifiedBillingPlan): Promise<UnifiedBillingPlan>;
  updateUnifiedBillingPlan(id: string, updates: Partial<InsertUnifiedBillingPlan>): Promise<UnifiedBillingPlan>;
  deleteUnifiedBillingPlan(id: string): Promise<void>;
  
  // Payment Split operations
  getPaymentSplits(paymentId: string): Promise<PaymentSplit[]>;
  createPaymentSplit(split: InsertPaymentSplit): Promise<PaymentSplit>;
  updatePaymentSplit(id: string, updates: Partial<InsertPaymentSplit>): Promise<PaymentSplit>;
  
  // Unified Subscription operations
  getUnifiedSubscriptions(organizationId: string): Promise<UnifiedSubscription[]>;
  getUnifiedSubscription(id: string): Promise<UnifiedSubscription | undefined>;
  createUnifiedSubscription(subscription: InsertUnifiedSubscription): Promise<UnifiedSubscription>;
  updateUnifiedSubscription(id: string, updates: Partial<InsertUnifiedSubscription>): Promise<UnifiedSubscription>;
  cancelUnifiedSubscription(id: string): Promise<void>;
  
  // Approval webhook operations
  getApprovalWebhooks(): Promise<ApprovalWebhook[]>;
  getApprovalWebhook(id: string): Promise<ApprovalWebhook | undefined>;
  createApprovalWebhook(webhook: InsertApprovalWebhook): Promise<ApprovalWebhook>;
  updateApprovalWebhook(id: string, updates: Partial<InsertApprovalWebhook>): Promise<ApprovalWebhook>;
  deleteApprovalWebhook(id: string): Promise<void>;

  // Multi-tier operations
  getChildOrganizations(parentId: string): Promise<Organization[]>;
  getAgencyCommissions(agencyOrganizationId: string): Promise<AgencyCommission[]>;
  createAgencyCommission(commission: InsertAgencyCommission): Promise<AgencyCommission>;
  updateAgencyCommission(id: string, updates: Partial<AgencyCommission>): Promise<AgencyCommission>;

  // Credit package operations
  getCreditPackages(targetAudience?: "agency" | "end_customer"): Promise<CreditPackage[]>;
  getCreditPackage(id: string): Promise<CreditPackage | undefined>;
  createCreditPackage(creditPackage: InsertCreditPackage): Promise<CreditPackage>;
  updateCreditPackage(id: string, updates: Partial<InsertCreditPackage>): Promise<CreditPackage>;
  deleteCreditPackage(id: string): Promise<void>;

  // Credit transaction operations
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  getCreditTransactions(organizationId: string, limit?: number): Promise<CreditTransaction[]>;
  purchaseCredits(organizationId: string, packageId: string, paymentId: string): Promise<{ success: boolean; newBalance: number }>;
  consumeCredits(organizationId: string, amount: number, callId?: string): Promise<{ success: boolean; remainingBalance: number }>;

  // Credit alert operations
  checkAndCreateCreditAlerts(organizationId: string): Promise<void>;
  getCreditAlerts(organizationId: string, unacknowledged?: boolean): Promise<CreditAlert[]>;
  acknowledgeCreditAlert(alertId: string, userId: string): Promise<void>;
  getAgencyInvitations(organizationId: string): Promise<AgencyInvitation[]>;
  getAgencyInvitationByCode(code: string): Promise<AgencyInvitation | undefined>;
  createAgencyInvitation(invitation: InsertAgencyInvitation): Promise<AgencyInvitation>;
  updateAgencyInvitation(id: string, updates: Partial<AgencyInvitation>): Promise<AgencyInvitation>;
  acceptAgencyInvitation(code: string, userId: string): Promise<Organization>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db().select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db().select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    // Default permissions for all users
    const defaultPermissions = [
      'manage_users',
      'manage_branding',
      'manage_voices',
      'manage_agents',
      'access_playground',
      'view_call_history',
      'manage_phone_numbers'
    ];

    // If no organization exists for this user, create one
    let organizationId = userData.organizationId;
    
    if (!organizationId) {
      const [org] = await db().insert(organizations).values({
        name: userData.email?.split('@')[0] || 'Personal Organization'
      }).returning();
      organizationId = org.id;
    }

    const [user] = await db().insert(users).values({
      email: userData.email!,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      organizationId,
      isAdmin: userData.email === "cc@siwaht.com",
      permissions: userData.permissions || defaultPermissions,
    }).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Default permissions for all users
    const defaultPermissions = [
      'manage_users',
      'manage_branding',
      'manage_voices',
      'manage_agents',
      'access_playground',
      'view_call_history',
      'manage_phone_numbers'
    ];

    // If no organizationId provided, create a new organization for the user
    let organizationId = userData.organizationId;
    if (!organizationId) {
      const orgName = userData.email ? userData.email.split('@')[0] + "'s Organization" : "Personal Organization";
      const organization = await this.createOrganization({ name: orgName });
      organizationId = organization.id;
    }

    // Check if this is the admin user
    const isAdmin = userData.email === 'cc@siwaht.com';

    const [user] = await db()
      .insert(users)
      .values({ ...userData, organizationId, isAdmin, permissions: userData.permissions || defaultPermissions })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          organizationId,
          isAdmin,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Agency user management operations
  async getOrganizationUsers(organizationId: string): Promise<User[]> {
    return await db()
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId));
  }

  async updateUserPermissions(userId: string, organizationId: string, permissions: string[]): Promise<User> {
    const [user] = await db()
      .update(users)
      .set({ permissions, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserRole(userId: string, organizationId: string, role: "admin" | "manager" | "user"): Promise<User> {
    const [user] = await db()
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async removeUserFromOrganization(userId: string, organizationId: string): Promise<void> {
    await db()
      .delete(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)));
  }

  async assignAgentsToUser(userId: string, organizationId: string, agentIds: string[]): Promise<void> {
    // First, remove existing assignments
    await db()
      .delete(userAgents)
      .where(eq(userAgents.userId, userId));
    
    // Then add new assignments
    if (agentIds.length > 0) {
      await db()
        .insert(userAgents)
        .values(agentIds.map(agentId => ({ userId, agentId })));
    }
  }

  async getUserAssignedAgents(userId: string, organizationId: string): Promise<Agent[]> {
    const result = await db()
      .select({ agent: agents })
      .from(userAgents)
      .innerJoin(agents, eq(userAgents.agentId, agents.id))
      .where(and(
        eq(userAgents.userId, userId),
        eq(agents.organizationId, organizationId)
      ));
    
    return result.map(r => r.agent);
  }
  
  // Batch method to fetch assigned agents for multiple users at once (prevents N+1 queries)
  async getUsersWithAssignedAgents(userIds: string[], organizationId: string): Promise<Map<string, Agent[]>> {
    if (userIds.length === 0) {
      return new Map();
    }
    
    const result = await db()
      .select({ 
        userId: userAgents.userId,
        agent: agents 
      })
      .from(userAgents)
      .innerJoin(agents, eq(userAgents.agentId, agents.id))
      .where(and(
        inArray(userAgents.userId, userIds),
        eq(agents.organizationId, organizationId)
      ));
    
    // Group agents by userId
    const userAgentsMap = new Map<string, Agent[]>();
    for (const row of result) {
      if (!userAgentsMap.has(row.userId)) {
        userAgentsMap.set(row.userId, []);
      }
      userAgentsMap.get(row.userId)!.push(row.agent);
    }
    
    // Ensure all userIds have an entry (even if empty)
    for (const userId of userIds) {
      if (!userAgentsMap.has(userId)) {
        userAgentsMap.set(userId, []);
      }
    }
    
    return userAgentsMap;
  }

  // User invitation operations
  async createInvitation(invitation: InsertUserInvitation): Promise<UserInvitation> {
    const crypto = require('crypto');
    const code = crypto.randomBytes(16).toString('hex');
    
    const [inv] = await db()
      .insert(userInvitations)
      .values({ ...invitation, code })
      .returning();
    return inv;
  }

  async getOrganizationInvitations(organizationId: string): Promise<UserInvitation[]> {
    return await db()
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.organizationId, organizationId))
      .orderBy(desc(userInvitations.createdAt));
  }

  async getInvitation(id: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db()
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.id, id));
    return invitation;
  }

  async getInvitationByCode(code: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db()
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.code, code));
    return invitation;
  }

  async updateInvitation(id: string, updates: Partial<UserInvitation>): Promise<UserInvitation> {
    const [invitation] = await db()
      .update(userInvitations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userInvitations.id, id))
      .returning();
    if (!invitation) throw new Error("Invitation not found");
    return invitation;
  }

  async deleteInvitation(id: string): Promise<void> {
    await db()
      .delete(userInvitations)
      .where(eq(userInvitations.id, id));
  }

  async acceptInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await this.getInvitation(invitationId);
    if (!invitation) throw new Error("Invitation not found");
    
    // Update user's organization and permissions
    await db()
      .update(users)
      .set({
        organizationId: invitation.organizationId,
        role: invitation.role,
        permissions: invitation.permissions,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    // Mark invitation as accepted
    await this.updateInvitation(invitationId, { 
      status: "accepted",
      acceptedAt: new Date(),
      acceptedBy: userId
    });
  }

  // Organization operations
  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    const [org] = await db().insert(organizations).values(orgData).returning();
    return org;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db().select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationBySubdomain(subdomain: string): Promise<Organization | undefined> {
    const [org] = await db()
      .select()
      .from(organizations)
      .where(eq(organizations.subdomain, subdomain));
    return org;
  }

  async getOrganizationByCustomDomain(domain: string): Promise<Organization | undefined> {
    const [org] = await db()
      .select()
      .from(organizations)
      .where(eq(organizations.customDomain, domain));
    return org;
  }

  async updateOrganizationSubdomain(id: string, subdomain: string): Promise<Organization> {
    const [org] = await db()
      .update(organizations)
      .set({ subdomain, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    if (!org) throw new Error("Organization not found");
    return org;
  }

  // Integration operations
  async getIntegration(organizationId: string, provider: string): Promise<Integration | undefined> {
    const [integration] = await db()
      .select()
      .from(integrations)
      .where(and(eq(integrations.organizationId, organizationId), eq(integrations.provider, provider)));
    return integration;
  }

  async getAllIntegrations(): Promise<Integration[]> {
    return await db()
      .select()
      .from(integrations);
  }

  async upsertIntegration(integrationData: InsertIntegration): Promise<Integration> {
    console.log("Database upsertIntegration called with:", {
      organizationId: integrationData.organizationId,
      provider: integrationData.provider,
      status: integrationData.status,
      apiKeyLength: integrationData.apiKey?.length
    });
    
    const [integration] = await db()
      .insert(integrations)
      .values(integrationData)
      .onConflictDoUpdate({
        target: [integrations.organizationId, integrations.provider],
        set: {
          ...integrationData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    console.log("Database upsertIntegration result:", integration?.id);
    return integration;
  }

  async updateIntegrationStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING_APPROVAL", lastTested?: Date): Promise<void> {
    await db()
      .update(integrations)
      .set({
        status,
        lastTested,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id));
  }

  // Agent operations
  async getAgents(organizationId: string): Promise<Agent[]> {
    return db().select().from(agents).where(eq(agents.organizationId, organizationId));
  }

  async getAgent(id: string, organizationId: string): Promise<Agent | undefined> {
    const [agent] = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
    return agent;
  }

  async getAgentByElevenLabsId(elevenLabsAgentId: string, organizationId: string): Promise<Agent | undefined> {
    const [agent] = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.elevenLabsAgentId, elevenLabsAgentId), eq(agents.organizationId, organizationId)));
    return agent;
  }

  async createAgent(agentData: any): Promise<Agent> {
    // Ensure the JSON fields are properly typed
    const data = {
      ...agentData,
      voiceSettings: agentData.voiceSettings || null,
      llmSettings: agentData.llmSettings || null,
      tools: agentData.tools || null,
      dynamicVariables: agentData.dynamicVariables || null,
      evaluationCriteria: agentData.evaluationCriteria || null,
      dataCollection: agentData.dataCollection || null,
    };
    const [agent] = await db().insert(agents).values([data]).returning();
    return agent;
  }

  async updateAgent(id: string, organizationId: string, updates: Partial<Omit<Agent, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<Agent> {
    const [agent] = await db()
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)))
      .returning();
    return agent;
  }

  async deleteAgent(organizationId: string, id: string): Promise<void> {
    await db()
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
  }

  // Admin Agent operations
  async getAllAgents(): Promise<Agent[]> {
    // Get all agents with their organization details
    const result = await db()
      .select({
        agent: agents,
        organization: organizations,
      })
      .from(agents)
      .leftJoin(organizations, eq(agents.organizationId, organizations.id));
    
    return result.map(r => ({
      ...r.agent,
      organizationName: r.organization?.name || 'Unknown',
    }));
  }

  async reassignAgentToOrganization(agentId: string, newOrganizationId: string): Promise<Agent> {
    // Update the agent's organization
    const [agent] = await db()
      .update(agents)
      .set({ 
        organizationId: newOrganizationId,
        updatedAt: new Date() 
      })
      .where(eq(agents.id, agentId))
      .returning();
    
    // Also clear any user assignments for this agent since it's moving to a new org
    await db()
      .delete(userAgents)
      .where(eq(userAgents.agentId, agentId));
    
    return agent;
  }

  async getAgentsByOrganization(organizationId: string): Promise<string[]> {
    const agentList = await db()
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.organizationId, organizationId));
    
    return agentList.map(a => a.id);
  }

  // User-Agent assignment operations
  async getAgentsForUser(userId: string, organizationId: string): Promise<Agent[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    
    console.log(`Getting agents for user ${user.email} (isAdmin: ${user.isAdmin}, role: ${user.role})`);
    
    // Admins and agencies can see all agents in their org
    if (user.isAdmin || user.role === 'agency') {
      // For agencies, also include agents from child organizations
      if (user.role === 'agency') {
        const childOrgs = await db()
          .select()
          .from(organizations)
          .where(eq(organizations.parentOrganizationId, organizationId));
        const orgIds = [organizationId, ...childOrgs.map(org => org.id)];
        return db()
          .select()
          .from(agents)
          .where(inArray(agents.organizationId, orgIds));
      }
      // Regular admins see all agents in their org
      return this.getAgents(organizationId);
    }
    
    // Regular users only see agents assigned to them
    const assignedAgents = await db()
      .select({
        agent: agents,
      })
      .from(userAgents)
      .innerJoin(agents, eq(userAgents.agentId, agents.id))
      .where(eq(userAgents.userId, userId));
    
    console.log(`Found ${assignedAgents.length} assigned agents for user ${user.email}`);
    assignedAgents.forEach(a => {
      console.log(`  - ${a.agent.name} (${a.agent.id})`);
    });
    
    return assignedAgents.map(row => row.agent);
  }

  async assignAgentToUser(userId: string, agentId: string, assignedBy?: string): Promise<void> {
    await db()
      .insert(userAgents)
      .values({ userId, agentId, assignedBy })
      .onConflictDoNothing();
  }

  async unassignAgentFromUser(userId: string, agentId: string): Promise<void> {
    await db()
      .delete(userAgents)
      .where(and(eq(userAgents.userId, userId), eq(userAgents.agentId, agentId)));
  }

  async getUserAgentAssignments(agentId: string): Promise<any[]> {
    return db()
      .select({
        id: userAgents.id,
        userId: userAgents.userId,
        agentId: userAgents.agentId,
        assignedAt: userAgents.assignedAt,
        user: users,
      })
      .from(userAgents)
      .innerJoin(users, eq(userAgents.userId, users.id))
      .where(eq(userAgents.agentId, agentId));
  }

  async bulkAssignAgentsToUser(userId: string, agentIds: string[], assignedBy?: string): Promise<void> {
    if (agentIds.length === 0) return;
    
    const assignments = agentIds.map(agentId => ({ userId, agentId, assignedBy }));
    await db()
      .insert(userAgents)
      .values(assignments)
      .onConflictDoNothing();
  }

  // Call log operations
  async getCallLogs(organizationId: string, limit = 20, offset = 0, agentId?: string): Promise<{ data: CallLog[]; total: number }> {
    let query = db()
      .select()
      .from(callLogs)
      .where(eq(callLogs.organizationId, organizationId))
      .orderBy(desc(callLogs.createdAt))
      .limit(limit)
      .offset(offset);

    if (agentId) {
      query = db()
        .select()
        .from(callLogs)
        .where(and(eq(callLogs.organizationId, organizationId), eq(callLogs.agentId, agentId)))
        .orderBy(desc(callLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    // Get total count for pagination
    const countQuery = agentId
      ? db()
          .select({ count: count() })
          .from(callLogs)
          .where(and(eq(callLogs.organizationId, organizationId), eq(callLogs.agentId, agentId)))
      : db()
          .select({ count: count() })
          .from(callLogs)
          .where(eq(callLogs.organizationId, organizationId));

    const [countResult] = await countQuery;
    const data = await query;

    return {
      data,
      total: countResult?.count || 0
    };
  }

  async getCallLog(id: string, organizationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.id, id), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  async getCallLogByConversationId(organizationId: string, conversationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.organizationId, organizationId), eq(callLogs.conversationId, conversationId)));
    return callLog;
  }

  async updateCallLog(id: string, updates: Partial<CallLog>): Promise<CallLog> {
    const [updatedCallLog] = await db()
      .update(callLogs)
      .set(updates)
      .where(eq(callLogs.id, id))
      .returning();
    return updatedCallLog;
  }

  async createCallLog(callLogData: InsertCallLog & { createdAt?: Date }): Promise<CallLog> {
    const [callLog] = await db().insert(callLogs).values(callLogData).returning();
    return callLog;
  }

  async updateCallLog(id: string, organizationId: string, updates: Partial<InsertCallLog>): Promise<CallLog> {
    const [callLog] = await db()
      .update(callLogs)
      .set(updates)
      .where(and(eq(callLogs.id, id), eq(callLogs.organizationId, organizationId)))
      .returning();
    return callLog;
  }

  async getCallLogByElevenLabsId(elevenLabsCallId: string, organizationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.elevenLabsCallId, elevenLabsCallId), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  async getCallLogByConversationId(organizationId: string, conversationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.conversationId, conversationId), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  // Analytics operations
  async getOrganizationStats(organizationId: string, agentId?: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    estimatedCost: number;
    activeAgents: number;
    lastSync?: Date;
  }> {
    // Build where conditions for call logs
    const callLogsConditions = agentId 
      ? and(eq(callLogs.organizationId, organizationId), eq(callLogs.agentId, agentId))
      : eq(callLogs.organizationId, organizationId);

    const [callStats] = await db()
      .select({
        totalCalls: count(callLogs.id),
        totalMinutes: sum(callLogs.duration),
        estimatedCost: sum(callLogs.cost),
        lastSync: max(callLogs.createdAt),
      })
      .from(callLogs)
      .where(callLogsConditions);

    // For agent stats, if a specific agent is selected, count just that one (if active)
    const agentConditions = agentId
      ? and(eq(agents.organizationId, organizationId), eq(agents.id, agentId), eq(agents.isActive, true))
      : and(eq(agents.organizationId, organizationId), eq(agents.isActive, true));

    const [agentStats] = await db()
      .select({
        activeAgents: count(agents.id),
      })
      .from(agents)
      .where(agentConditions);

    return {
      totalCalls: Number(callStats.totalCalls) || 0,
      totalMinutes: Math.round(Number(callStats.totalMinutes) / 60) || 0,
      estimatedCost: Number(callStats.estimatedCost) || 0,
      activeAgents: Number(agentStats.activeAgents) || 0,
      lastSync: callStats.lastSync || undefined,
    };
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db().select().from(users);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db()
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!updatedUser) {
      throw new Error("User not found");
    }
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await db().delete(users).where(eq(users.id, id));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db().select().from(organizations);
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const [updatedOrg] = await db()
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    if (!updatedOrg) {
      throw new Error("Organization not found");
    }
    return updatedOrg;
  }

  async deleteOrganization(id: string): Promise<void> {
    // First check if organization has users
    const orgUsers = await db().select().from(users).where(eq(users.organizationId, id));
    if (orgUsers.length > 0) {
      throw new Error("Cannot delete organization with existing users");
    }
    
    // Delete related data
    await db().delete(integrations).where(eq(integrations.organizationId, id));
    await db().delete(agents).where(eq(agents.organizationId, id));
    await db().delete(callLogs).where(eq(callLogs.organizationId, id));
    
    // Finally delete the organization
    await db().delete(organizations).where(eq(organizations.id, id));
  }

  async toggleUserStatus(id: string, status: 'active' | 'inactive' | 'pending'): Promise<User> {
    const [updatedUser] = await db()
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!updatedUser) {
      throw new Error("User not found");
    }
    return updatedUser;
  }

  async toggleOrganizationStatus(id: string, isActive: boolean): Promise<Organization> {
    const [updatedOrg] = await db()
      .update(organizations)
      .set({ 
        billingStatus: isActive ? 'active' : 'inactive', 
        updatedAt: new Date() 
      })
      .where(eq(organizations.id, id))
      .returning();
    if (!updatedOrg) {
      throw new Error("Organization not found");
    }
    return updatedOrg;
  }

  async getAdminBillingData(): Promise<{
    totalUsers: number;
    totalOrganizations: number;
    totalCalls: number;
    totalRevenue: number;
    organizationsData: Array<{
      id: string;
      name: string;
      userCount: number;
      totalCalls: number;
      totalMinutes: number;
      estimatedCost: number;
      billingPackage?: string;
      perCallRate?: number;
      perMinuteRate?: number;
      monthlyCredits?: number;
      usedCredits?: number;
    }>;
  }> {
    // Get total counts
    const [userCount] = await db().select({ count: count(users.id) }).from(users);
    const [orgCount] = await db().select({ count: count(organizations.id) }).from(organizations);
    const [callCount] = await db().select({ 
      count: count(callLogs.id),
      totalCost: sum(callLogs.cost) 
    }).from(callLogs);

    // Get organization-specific data
    const orgs = await db().select().from(organizations);
    const organizationsData = await Promise.all(
      orgs.map(async (org) => {
        const [userStats] = await db()
          .select({ count: count(users.id) })
          .from(users)
          .where(eq(users.organizationId, org.id));

        const [callStats] = await db()
          .select({
            totalCalls: count(callLogs.id),
            totalMinutes: sum(callLogs.duration),
            estimatedCost: sum(callLogs.cost),
          })
          .from(callLogs)
          .where(eq(callLogs.organizationId, org.id));

        return {
          id: org.id,
          name: org.name,
          userCount: Number(userStats.count) || 0,
          totalCalls: Number(callStats.totalCalls) || 0,
          totalMinutes: Math.round(Number(callStats.totalMinutes) / 60) || 0,
          estimatedCost: Number(callStats.estimatedCost) || 0,
          billingPackage: org.billingPackage || 'starter',
          perCallRate: Number(org.perCallRate) || 0.30,
          perMinuteRate: Number(org.perMinuteRate) || 0.30,
          monthlyCredits: org.monthlyCredits || 0,
          usedCredits: org.usedCredits || 0,
        };
      })
    );

    return {
      totalUsers: Number(userCount.count) || 0,
      totalOrganizations: Number(orgCount.count) || 0,
      totalCalls: Number(callCount.count) || 0,
      totalRevenue: Number(callCount.totalCost) || 0,
      organizationsData,
    };
  }

  // Billing operations
  async getBillingPackages(): Promise<BillingPackage[]> {
    return await db().select().from(billingPackages);
  }

  async getBillingPackage(id: string): Promise<BillingPackage | undefined> {
    const [pkg] = await db().select().from(billingPackages).where(eq(billingPackages.id, id));
    return pkg;
  }

  async createBillingPackage(pkg: Partial<BillingPackage>): Promise<BillingPackage> {
    const [newPkg] = await db().insert(billingPackages).values(pkg as any).returning();
    return newPkg;
  }

  async updateBillingPackage(id: string, updates: Partial<BillingPackage>): Promise<BillingPackage> {
    const [updatedPkg] = await db()
      .update(billingPackages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(billingPackages.id, id))
      .returning();
    if (!updatedPkg) {
      throw new Error("Billing package not found");
    }
    return updatedPkg;
  }

  async deleteBillingPackage(id: string): Promise<void> {
    await db().delete(billingPackages).where(eq(billingPackages.id, id));
  }

  // Payment operations
  async getPaymentHistory(organizationId: string): Promise<Payment[]> {
    return await db()
      .select()
      .from(payments)
      .where(eq(payments.organizationId, organizationId))
      .orderBy(desc(payments.createdAt));
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db()
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db().insert(payments).values(data).returning();
    return payment;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment> {
    const [updated] = await db()
      .update(payments)
      .set(data)
      .where(eq(payments.id, id))
      .returning();
    if (!updated) {
      throw new Error("Payment not found");
    }
    return updated;
  }

  // Agency Payment Configuration operations
  async getAgencyPaymentConfig(organizationId: string): Promise<AgencyPaymentConfig | undefined> {
    const [config] = await db()
      .select()
      .from(agencyPaymentConfig)
      .where(eq(agencyPaymentConfig.organizationId, organizationId));
    return config;
  }

  async createAgencyPaymentConfig(config: InsertAgencyPaymentConfig): Promise<AgencyPaymentConfig> {
    const [newConfig] = await db().insert(agencyPaymentConfig).values(config).returning();
    return newConfig;
  }

  async updateAgencyPaymentConfig(organizationId: string, updates: Partial<InsertAgencyPaymentConfig>): Promise<AgencyPaymentConfig> {
    const [updated] = await db()
      .update(agencyPaymentConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencyPaymentConfig.organizationId, organizationId))
      .returning();
    if (!updated) {
      throw new Error("Agency payment config not found");
    }
    return updated;
  }
  
  // Agency Pricing Plan operations
  async getAgencyPricingPlans(organizationId: string): Promise<AgencyPricingPlan[]> {
    return await db()
      .select()
      .from(agencyPricingPlans)
      .where(eq(agencyPricingPlans.organizationId, organizationId))
      .orderBy(agencyPricingPlans.displayOrder);
  }

  async getAgencyPricingPlan(id: string): Promise<AgencyPricingPlan | undefined> {
    const [plan] = await db()
      .select()
      .from(agencyPricingPlans)
      .where(eq(agencyPricingPlans.id, id));
    return plan;
  }

  async createAgencyPricingPlan(plan: InsertAgencyPricingPlan): Promise<AgencyPricingPlan> {
    const [newPlan] = await db().insert(agencyPricingPlans).values(plan).returning();
    return newPlan;
  }

  async updateAgencyPricingPlan(id: string, updates: Partial<InsertAgencyPricingPlan>): Promise<AgencyPricingPlan> {
    const [updated] = await db()
      .update(agencyPricingPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencyPricingPlans.id, id))
      .returning();
    if (!updated) {
      throw new Error("Agency pricing plan not found");
    }
    return updated;
  }

  async deleteAgencyPricingPlan(id: string): Promise<void> {
    await db().delete(agencyPricingPlans).where(eq(agencyPricingPlans.id, id));
  }
  
  // Agency Subscription operations
  async getAgencySubscriptions(agencyOrganizationId: string): Promise<AgencySubscription[]> {
    return await db()
      .select()
      .from(agencySubscriptions)
      .where(eq(agencySubscriptions.agencyOrganizationId, agencyOrganizationId))
      .orderBy(desc(agencySubscriptions.createdAt));
  }

  async getAgencySubscription(id: string): Promise<AgencySubscription | undefined> {
    const [subscription] = await db()
      .select()
      .from(agencySubscriptions)
      .where(eq(agencySubscriptions.id, id));
    return subscription;
  }

  async getUserSubscription(userId: string, agencyOrganizationId: string): Promise<AgencySubscription | undefined> {
    const [subscription] = await db()
      .select()
      .from(agencySubscriptions)
      .where(and(
        eq(agencySubscriptions.userId, userId),
        eq(agencySubscriptions.agencyOrganizationId, agencyOrganizationId),
        eq(agencySubscriptions.status, "active")
      ));
    return subscription;
  }

  async createAgencySubscription(subscription: InsertAgencySubscription): Promise<AgencySubscription> {
    const [newSubscription] = await db().insert(agencySubscriptions).values(subscription).returning();
    return newSubscription;
  }

  async updateAgencySubscription(id: string, updates: Partial<InsertAgencySubscription>): Promise<AgencySubscription> {
    const [updated] = await db()
      .update(agencySubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencySubscriptions.id, id))
      .returning();
    if (!updated) {
      throw new Error("Agency subscription not found");
    }
    return updated;
  }

  async cancelAgencySubscription(id: string): Promise<void> {
    await db()
      .update(agencySubscriptions)
      .set({ 
        status: "canceled" as const,
        canceledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(agencySubscriptions.id, id));
  }
  
  // Agency Transaction operations
  async getAgencyTransactions(agencyOrganizationId: string, limit?: number): Promise<AgencyTransaction[]> {
    let query = db()
      .select()
      .from(agencyTransactions)
      .where(eq(agencyTransactions.agencyOrganizationId, agencyOrganizationId))
      .orderBy(desc(agencyTransactions.createdAt));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return await query;
  }

  async getAgencyTransaction(id: string): Promise<AgencyTransaction | undefined> {
    const [transaction] = await db()
      .select()
      .from(agencyTransactions)
      .where(eq(agencyTransactions.id, id));
    return transaction;
  }

  async createAgencyTransaction(transaction: InsertAgencyTransaction): Promise<AgencyTransaction> {
    const [newTransaction] = await db().insert(agencyTransactions).values(transaction).returning();
    return newTransaction;
  }

  async updateAgencyTransaction(id: string, updates: Partial<InsertAgencyTransaction>): Promise<AgencyTransaction> {
    const [updated] = await db()
      .update(agencyTransactions)
      .set(updates)
      .where(eq(agencyTransactions.id, id))
      .returning();
    if (!updated) {
      throw new Error("Agency transaction not found");
    }
    return updated;
  }

  // Agency Payment Processor implementations
  async getAgencyPaymentProcessors(organizationId: string): Promise<AgencyPaymentProcessor[]> {
    const processors = await db()
      .select()
      .from(agencyPaymentProcessors)
      .where(eq(agencyPaymentProcessors.organizationId, organizationId));
    return processors;
  }
  
  async getAgencyPaymentProcessor(organizationId: string, provider: string): Promise<AgencyPaymentProcessor | undefined> {
    const [processor] = await db()
      .select()
      .from(agencyPaymentProcessors)
      .where(
        and(
          eq(agencyPaymentProcessors.organizationId, organizationId),
          eq(agencyPaymentProcessors.provider, provider)
        )
      );
    return processor;
  }
  
  async createAgencyPaymentProcessor(processor: InsertAgencyPaymentProcessor): Promise<AgencyPaymentProcessor> {
    const [newProcessor] = await db()
      .insert(agencyPaymentProcessors)
      .values(processor)
      .returning();
    return newProcessor;
  }
  
  async updateAgencyPaymentProcessor(id: string, updates: Partial<InsertAgencyPaymentProcessor>): Promise<AgencyPaymentProcessor> {
    const [updated] = await db()
      .update(agencyPaymentProcessors)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencyPaymentProcessors.id, id))
      .returning();
    return updated;
  }
  
  async deleteAgencyPaymentProcessor(organizationId: string, provider: string): Promise<void> {
    await db()
      .delete(agencyPaymentProcessors)
      .where(
        and(
          eq(agencyPaymentProcessors.organizationId, organizationId),
          eq(agencyPaymentProcessors.provider, provider)
        )
      );
  }
  
  // Agency Billing Plan implementations (new schema)
  async getAgencyBillingPlans(organizationId: string, includeInactive: boolean = false): Promise<AgencyBillingPlan[]> {
    let query = db()
      .select()
      .from(agencyBillingPlans)
      .where(eq(agencyBillingPlans.organizationId, organizationId));
    
    if (!includeInactive) {
      query = query.where(eq(agencyBillingPlans.isActive, true));
    }
    
    const plans = await query.orderBy(agencyBillingPlans.displayOrder);
    return plans;
  }
  
  async getAgencyBillingPlan(id: string): Promise<AgencyBillingPlan | undefined> {
    const [plan] = await db()
      .select()
      .from(agencyBillingPlans)
      .where(eq(agencyBillingPlans.id, id));
    return plan;
  }
  
  async createAgencyBillingPlan(plan: InsertAgencyBillingPlan): Promise<AgencyBillingPlan> {
    const [newPlan] = await db()
      .insert(agencyBillingPlans)
      .values(plan)
      .returning();
    return newPlan;
  }
  
  async updateAgencyBillingPlan(id: string, updates: Partial<InsertAgencyBillingPlan>): Promise<AgencyBillingPlan> {
    const [updated] = await db()
      .update(agencyBillingPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agencyBillingPlans.id, id))
      .returning();
    return updated;
  }
  
  async deleteAgencyBillingPlan(id: string): Promise<void> {
    await db()
      .delete(agencyBillingPlans)
      .where(eq(agencyBillingPlans.id, id));
  }
  
  // Customer Subscription implementations
  async getCustomerSubscriptions(agencyOrganizationId: string): Promise<CustomerSubscription[]> {
    const subscriptions = await db()
      .select()
      .from(customerSubscriptions)
      .where(eq(customerSubscriptions.agencyOrganizationId, agencyOrganizationId))
      .orderBy(desc(customerSubscriptions.createdAt));
    return subscriptions;
  }
  
  async getCustomerSubscription(id: string): Promise<CustomerSubscription | undefined> {
    const [subscription] = await db()
      .select()
      .from(customerSubscriptions)
      .where(eq(customerSubscriptions.id, id));
    return subscription;
  }
  
  async getCustomerSubscriptionByCustomer(customerOrganizationId: string): Promise<CustomerSubscription | undefined> {
    const [subscription] = await db()
      .select()
      .from(customerSubscriptions)
      .where(
        and(
          eq(customerSubscriptions.customerOrganizationId, customerOrganizationId),
          eq(customerSubscriptions.status, 'active')
        )
      );
    return subscription;
  }
  
  async createCustomerSubscription(subscription: InsertCustomerSubscription): Promise<CustomerSubscription> {
    const [newSubscription] = await db()
      .insert(customerSubscriptions)
      .values(subscription)
      .returning();
    return newSubscription;
  }
  
  async updateCustomerSubscription(id: string, updates: Partial<InsertCustomerSubscription>): Promise<CustomerSubscription> {
    const [updated] = await db()
      .update(customerSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customerSubscriptions.id, id))
      .returning();
    return updated;
  }
  
  async cancelCustomerSubscription(id: string): Promise<void> {
    await db()
      .update(customerSubscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerSubscriptions.id, id));
  }
  
  // Customer Payment Method implementations
  async getCustomerPaymentMethods(customerOrganizationId: string): Promise<CustomerPaymentMethod[]> {
    const methods = await db()
      .select()
      .from(customerPaymentMethods)
      .where(eq(customerPaymentMethods.customerOrganizationId, customerOrganizationId))
      .orderBy(desc(customerPaymentMethods.isDefault), desc(customerPaymentMethods.createdAt));
    return methods;
  }
  
  async getCustomerPaymentMethod(id: string): Promise<CustomerPaymentMethod | undefined> {
    const [method] = await db()
      .select()
      .from(customerPaymentMethods)
      .where(eq(customerPaymentMethods.id, id));
    return method;
  }
  
  async createCustomerPaymentMethod(method: InsertCustomerPaymentMethod): Promise<CustomerPaymentMethod> {
    const [newMethod] = await db()
      .insert(customerPaymentMethods)
      .values(method)
      .returning();
    return newMethod;
  }
  
  async updateCustomerPaymentMethod(id: string, updates: Partial<InsertCustomerPaymentMethod>): Promise<CustomerPaymentMethod> {
    const [updated] = await db()
      .update(customerPaymentMethods)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customerPaymentMethods.id, id))
      .returning();
    return updated;
  }
  
  async deleteCustomerPaymentMethod(id: string): Promise<void> {
    await db()
      .delete(customerPaymentMethods)
      .where(eq(customerPaymentMethods.id, id));
  }
  
  async setDefaultPaymentMethod(customerOrganizationId: string, methodId: string): Promise<void> {
    // First, unset all defaults for this customer
    await db()
      .update(customerPaymentMethods)
      .set({ isDefault: false })
      .where(eq(customerPaymentMethods.customerOrganizationId, customerOrganizationId));
    
    // Then set the new default
    await db()
      .update(customerPaymentMethods)
      .set({ isDefault: true })
      .where(eq(customerPaymentMethods.id, methodId));
  }

  // Phone number operations
  async getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]> {
    return await db()
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, organizationId))
      .orderBy(desc(phoneNumbers.createdAt));
  }

  async getPhoneNumber(id: string, organizationId: string): Promise<PhoneNumber | undefined> {
    const [phoneNumber] = await db()
      .select()
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)));
    return phoneNumber;
  }

  async createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber> {
    const [newPhoneNumber] = await db().insert(phoneNumbers).values(phoneNumber).returning();
    return newPhoneNumber;
  }

  async updatePhoneNumber(id: string, organizationId: string, updates: Partial<InsertPhoneNumber>): Promise<PhoneNumber> {
    const [updated] = await db()
      .update(phoneNumbers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)))
      .returning();
    if (!updated) {
      throw new Error("Phone number not found");
    }
    return updated;
  }

  async deletePhoneNumber(id: string, organizationId: string): Promise<void> {
    await db()
      .delete(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)));
  }

  // Batch call operations
  async getBatchCalls(organizationId: string): Promise<BatchCall[]> {
    return await db()
      .select()
      .from(batchCalls)
      .where(eq(batchCalls.organizationId, organizationId))
      .orderBy(desc(batchCalls.createdAt));
  }

  async getBatchCall(id: string, organizationId: string): Promise<BatchCall | undefined> {
    const [batchCall] = await db()
      .select()
      .from(batchCalls)
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)));
    return batchCall;
  }

  async createBatchCall(data: InsertBatchCall): Promise<BatchCall> {
    const [batchCall] = await db().insert(batchCalls).values(data).returning();
    return batchCall;
  }

  async updateBatchCall(id: string, organizationId: string, data: Partial<BatchCall>): Promise<BatchCall> {
    const [updated] = await db()
      .update(batchCalls)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)))
      .returning();
    if (!updated) {
      throw new Error("Batch call not found");
    }
    return updated;
  }

  async deleteBatchCall(id: string, organizationId: string): Promise<void> {
    await db()
      .delete(batchCalls)
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)));
  }

  // Batch call recipient operations
  async getBatchCallRecipients(batchCallId: string): Promise<BatchCallRecipient[]> {
    return await db()
      .select()
      .from(batchCallRecipients)
      .where(eq(batchCallRecipients.batchCallId, batchCallId))
      .orderBy(batchCallRecipients.createdAt);
  }

  async createBatchCallRecipients(recipients: InsertBatchCallRecipient[]): Promise<BatchCallRecipient[]> {
    const created = await db().insert(batchCallRecipients).values(recipients).returning();
    return created;
  }

  async updateBatchCallRecipient(id: string, data: Partial<BatchCallRecipient>): Promise<BatchCallRecipient> {
    const [updated] = await db()
      .update(batchCallRecipients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(batchCallRecipients.id, id))
      .returning();
    if (!updated) {
      throw new Error("Batch call recipient not found");
    }
    return updated;
  }

  // System template operations (admin only)
  async getSystemTemplates(): Promise<SystemTemplate[]> {
    return await db()
      .select()
      .from(systemTemplates)
      .where(eq(systemTemplates.isActive, true))
      .orderBy(systemTemplates.order);
  }

  async getSystemTemplate(id: string): Promise<SystemTemplate | undefined> {
    const [template] = await db()
      .select()
      .from(systemTemplates)
      .where(eq(systemTemplates.id, id));
    return template;
  }

  async createSystemTemplate(template: InsertSystemTemplate): Promise<SystemTemplate> {
    const [created] = await db().insert(systemTemplates).values(template).returning();
    return created;
  }

  async updateSystemTemplate(id: string, updates: Partial<InsertSystemTemplate>): Promise<SystemTemplate> {
    const [updated] = await db()
      .update(systemTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(systemTemplates.id, id))
      .returning();
    if (!updated) {
      throw new Error("System template not found");
    }
    return updated;
  }

  async deleteSystemTemplate(id: string): Promise<void> {
    await db().delete(systemTemplates).where(eq(systemTemplates.id, id));
  }

  // Quick Action Button operations
  async getQuickActionButtons(organizationId?: string): Promise<QuickActionButton[]> {
    if (organizationId) {
      // Get system buttons and user's organization buttons
      return await db()
        .select()
        .from(quickActionButtons)
        .where(
          and(
            eq(quickActionButtons.isActive, true),
            or(
              eq(quickActionButtons.isSystem, true),
              eq(quickActionButtons.organizationId, organizationId)
            )
          )
        )
        .orderBy(quickActionButtons.order);
    } else {
      // Get only system buttons
      return await db()
        .select()
        .from(quickActionButtons)
        .where(
          and(
            eq(quickActionButtons.isActive, true),
            eq(quickActionButtons.isSystem, true)
          )
        )
        .orderBy(quickActionButtons.order);
    }
  }

  async getQuickActionButton(id: string): Promise<QuickActionButton | undefined> {
    const [button] = await db()
      .select()
      .from(quickActionButtons)
      .where(eq(quickActionButtons.id, id));
    return button;
  }

  async createQuickActionButton(button: InsertQuickActionButton): Promise<QuickActionButton> {
    const [created] = await db().insert(quickActionButtons).values(button).returning();
    return created;
  }

  async updateQuickActionButton(id: string, updates: Partial<InsertQuickActionButton>): Promise<QuickActionButton> {
    const [updated] = await db()
      .update(quickActionButtons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quickActionButtons.id, id))
      .returning();
    if (!updated) {
      throw new Error("Quick action button not found");
    }
    return updated;
  }

  async deleteQuickActionButton(id: string): Promise<void> {
    await db().delete(quickActionButtons).where(eq(quickActionButtons.id, id));
  }

  // Admin task operations
  async createAdminTask(task: InsertAdminTask): Promise<AdminTask> {
    const [adminTask] = await db().insert(adminTasks).values(task).returning();
    return adminTask;
  }

  async getAdminTasks(status?: "pending" | "in_progress" | "completed" | "rejected"): Promise<AdminTask[]> {
    if (status) {
      return db().select().from(adminTasks).where(eq(adminTasks.status, status));
    }
    return db().select().from(adminTasks).orderBy(desc(adminTasks.createdAt));
  }

  async getAdminTask(id: string): Promise<AdminTask | undefined> {
    const [task] = await db().select().from(adminTasks).where(eq(adminTasks.id, id));
    return task;
  }

  async updateAdminTask(id: string, updates: Partial<AdminTask>): Promise<AdminTask> {
    const [task] = await db()
      .update(adminTasks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(adminTasks.id, id))
      .returning();
    return task;
  }

  async completeApprovalTask(taskId: string, adminId: string): Promise<void> {
    // Get the task
    const task = await this.getAdminTask(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Update the task status
    await this.updateAdminTask(taskId, {
      status: "completed",
      approvedBy: adminId,
      completedAt: new Date(),
    });

    // Update the related entity based on type
    if (task.relatedEntityType === "integration") {
      await this.updateIntegrationStatus(task.relatedEntityId, "ACTIVE");
    }
    // Add more entity types as needed (webhook, agent, etc.)
  }


  // Approval webhook operations
  async getApprovalWebhooks(): Promise<ApprovalWebhook[]> {
    return await db().select().from(approvalWebhooks).orderBy(desc(approvalWebhooks.createdAt));
  }

  async getApprovalWebhook(id: string): Promise<ApprovalWebhook | undefined> {
    const [webhook] = await db()
      .select()
      .from(approvalWebhooks)
      .where(eq(approvalWebhooks.id, id));
    return webhook;
  }

  async createApprovalWebhook(webhookData: InsertApprovalWebhook): Promise<ApprovalWebhook> {
    const [webhook] = await db()
      .insert(approvalWebhooks)
      .values(webhookData)
      .returning();
    return webhook;
  }

  async updateApprovalWebhook(id: string, updates: Partial<InsertApprovalWebhook>): Promise<ApprovalWebhook> {
    const [webhook] = await db()
      .update(approvalWebhooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(approvalWebhooks.id, id))
      .returning();
    if (!webhook) {
      throw new Error("Approval webhook not found");
    }
    return webhook;
  }

  async deleteApprovalWebhook(id: string): Promise<void> {
    await db()
      .delete(approvalWebhooks)
      .where(eq(approvalWebhooks.id, id));
  }

  // Multi-tier operations
  async getChildOrganizations(parentId: string): Promise<Organization[]> {
    return await db()
      .select()
      .from(organizations)
      .where(eq(organizations.parentOrganizationId, parentId))
      .orderBy(desc(organizations.createdAt));
  }

  async getAgencyCommissions(agencyOrganizationId: string): Promise<AgencyCommission[]> {
    return await db()
      .select()
      .from(agencyCommissions)
      .where(eq(agencyCommissions.agencyOrganizationId, agencyOrganizationId))
      .orderBy(desc(agencyCommissions.createdAt));
  }

  async createAgencyCommission(commission: InsertAgencyCommission): Promise<AgencyCommission> {
    const [result] = await db()
      .insert(agencyCommissions)
      .values(commission)
      .returning();
    return result;
  }

  async updateAgencyCommission(id: string, updates: Partial<AgencyCommission>): Promise<AgencyCommission> {
    const [result] = await db()
      .update(agencyCommissions)
      .set(updates)
      .where(eq(agencyCommissions.id, id))
      .returning();
    if (!result) {
      throw new Error("Agency commission not found");
    }
    return result;
  }

  // Credit transaction methods are implemented in the credit management section below

  async getAgencyInvitations(organizationId: string): Promise<AgencyInvitation[]> {
    return await db()
      .select()
      .from(agencyInvitations)
      .where(eq(agencyInvitations.inviterOrganizationId, organizationId))
      .orderBy(desc(agencyInvitations.createdAt));
  }

  async getAgencyInvitationByCode(code: string): Promise<AgencyInvitation | undefined> {
    const [invitation] = await db()
      .select()
      .from(agencyInvitations)
      .where(eq(agencyInvitations.invitationCode, code));
    return invitation;
  }

  async createAgencyInvitation(invitation: InsertAgencyInvitation): Promise<AgencyInvitation> {
    // Generate unique invitation code
    const invitationCode = `INV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    
    const [result] = await db()
      .insert(agencyInvitations)
      .values({
        ...invitation,
        invitationCode,
        expiresAt: invitation.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      })
      .returning();
    return result;
  }

  async updateAgencyInvitation(id: string, updates: Partial<AgencyInvitation>): Promise<AgencyInvitation> {
    const [result] = await db()
      .update(agencyInvitations)
      .set(updates)
      .where(eq(agencyInvitations.id, id))
      .returning();
    if (!result) {
      throw new Error("Agency invitation not found");
    }
    return result;
  }

  // Credit package operations
  async getCreditPackages(targetAudience?: "agency" | "end_customer"): Promise<CreditPackage[]> {
    let query = db().select().from(creditPackages).where(eq(creditPackages.isActive, true));
    
    if (targetAudience) {
      const result = await db()
        .select()
        .from(creditPackages)
        .where(and(
          eq(creditPackages.isActive, true),
          eq(creditPackages.targetAudience, targetAudience)
        ))
        .orderBy(creditPackages.sortOrder);
      return result;
    }
    
    const result = await db()
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.isActive, true))
      .orderBy(creditPackages.sortOrder);
    return result;
  }

  async getCreditPackage(id: string): Promise<CreditPackage | undefined> {
    const [result] = await db()
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.id, id));
    return result;
  }

  async createCreditPackage(creditPackage: InsertCreditPackage): Promise<CreditPackage> {
    const [result] = await db()
      .insert(creditPackages)
      .values(creditPackage)
      .returning();
    return result;
  }

  async updateCreditPackage(id: string, updates: Partial<InsertCreditPackage>): Promise<CreditPackage> {
    const [result] = await db()
      .update(creditPackages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(creditPackages.id, id))
      .returning();
    if (!result) {
      throw new Error("Credit package not found");
    }
    return result;
  }

  async deleteCreditPackage(id: string): Promise<void> {
    await db()
      .update(creditPackages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(creditPackages.id, id));
  }

  // Credit transaction operations
  async createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const [result] = await db()
      .insert(creditTransactions)
      .values(transaction)
      .returning();
    return result;
  }

  async getCreditTransactions(organizationId: string, limit: number = 100): Promise<CreditTransaction[]> {
    const result = await db()
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.organizationId, organizationId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
    return result;
  }

  async purchaseCredits(organizationId: string, packageId: string, paymentId: string): Promise<{ success: boolean; newBalance: number }> {
    // Get the credit package
    const creditPackage = await this.getCreditPackage(packageId);
    if (!creditPackage) {
      throw new Error("Credit package not found");
    }

    // Get the organization
    const org = await this.getOrganization(organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const totalCredits = creditPackage.credits + (creditPackage.bonusCredits || 0);
    const currentBalance = Number(org.creditBalance || 0);
    const newBalance = currentBalance + totalCredits;

    // Update organization credit balance
    await db()
      .update(organizations)
      .set({
        creditBalance: String(newBalance),
        billingStatus: "active",
        creditAlertStatus: "normal",
        lastPaymentDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    // Create credit transaction
    await this.createCreditTransaction({
      organizationId,
      type: "purchase",
      amount: creditPackage.price,
      creditAmount: totalCredits,
      balanceBefore: String(currentBalance),
      balanceAfter: String(newBalance),
      relatedPaymentId: paymentId,
      description: `Purchased ${creditPackage.name} package`,
    });

    return { success: true, newBalance };
  }

  async consumeCredits(organizationId: string, amount: number, callId?: string): Promise<{ success: boolean; remainingBalance: number }> {
    // Get the organization
    const org = await this.getOrganization(organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const currentBalance = Number(org.creditBalance || 0);
    const remainingBalance = currentBalance - amount;

    if (remainingBalance < 0) {
      // Update organization to paused status
      await db()
        .update(organizations)
        .set({
          creditBalance: "0",
          billingStatus: "paused",
          creditAlertStatus: "depleted",
          servicePausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId));

      return { success: false, remainingBalance: 0 };
    }

    // Update organization credit balance
    await db()
      .update(organizations)
      .set({
        creditBalance: String(remainingBalance),
        usedCredits: (org.usedCredits || 0) + amount,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    // Create credit transaction
    await this.createCreditTransaction({
      organizationId,
      type: "usage",
      amount: String(-amount),
      creditAmount: -amount,
      balanceBefore: String(currentBalance),
      balanceAfter: String(remainingBalance),
      relatedCallId: callId,
      description: `Call usage${callId ? ` for call ${callId}` : ""}`,
    });

    // Check if we need to create alerts
    await this.checkAndCreateCreditAlerts(organizationId);

    return { success: true, remainingBalance };
  }

  // Credit alert operations
  async checkAndCreateCreditAlerts(organizationId: string): Promise<void> {
    const org = await this.getOrganization(organizationId);
    if (!org) return;

    const currentBalance = Number(org.creditBalance || 0);
    const monthlyCredits = org.monthlyCredits || 0;
    const totalAvailable = currentBalance + monthlyCredits;
    
    if (totalAvailable === 0) return;

    const percentage = (currentBalance / totalAvailable) * 100;
    let alertType: "normal" | "warning_25" | "warning_10" | "critical_5" | "depleted" = "normal";
    let message = "";

    if (percentage <= 0) {
      alertType = "depleted";
      message = "Your credits have been depleted. Service is paused until you refill credits.";
    } else if (percentage <= 5) {
      alertType = "critical_5";
      message = `Critical: Only ${currentBalance} credits remaining (${percentage.toFixed(1)}%). Service will pause soon.`;
    } else if (percentage <= 10) {
      alertType = "warning_10";
      message = `Urgent: Only ${currentBalance} credits remaining (${percentage.toFixed(1)}%). Please refill soon.`;
    } else if (percentage <= 25) {
      alertType = "warning_25";
      message = `Warning: ${currentBalance} credits remaining (${percentage.toFixed(1)}%). Consider refilling.`;
    }

    // Update organization alert status
    if (alertType !== "normal" && alertType !== org.creditAlertStatus) {
      await db()
        .update(organizations)
        .set({
          creditAlertStatus: alertType,
          lastAlertSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId));

      // Create alert record
      await db()
        .insert(creditAlerts)
        .values({
          organizationId,
          alertType,
          creditPercentage: String(percentage),
          creditsRemaining: currentBalance,
          message,
        });
    }
  }

  async getCreditAlerts(organizationId: string, unacknowledged: boolean = false): Promise<CreditAlert[]> {
    if (unacknowledged) {
      const result = await db()
        .select()
        .from(creditAlerts)
        .where(and(
          eq(creditAlerts.organizationId, organizationId),
          isNull(creditAlerts.acknowledgedAt)
        ))
        .orderBy(desc(creditAlerts.createdAt));
      return result;
    }

    const result = await db()
      .select()
      .from(creditAlerts)
      .where(eq(creditAlerts.organizationId, organizationId))
      .orderBy(desc(creditAlerts.createdAt))
      .limit(100);
    return result;
  }

  async acknowledgeCreditAlert(alertId: string, userId: string): Promise<void> {
    await db()
      .update(creditAlerts)
      .set({
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      })
      .where(eq(creditAlerts.id, alertId));
  }

  // Whitelabel configuration operations
  async getWhitelabelConfig(organizationId: string): Promise<WhitelabelConfig | undefined> {
    const [config] = await db()
      .select()
      .from(whitelabelConfigs)
      .where(and(
        eq(whitelabelConfigs.organizationId, organizationId),
        eq(whitelabelConfigs.isActive, true)
      ));
    return config;
  }
  
  async getAllWhitelabelConfigs(): Promise<WhitelabelConfig[]> {
    const configs = await db()
      .select()
      .from(whitelabelConfigs)
      .where(eq(whitelabelConfigs.isActive, true))
      .limit(10); // Limit for safety
    return configs;
  }

  async createWhitelabelConfig(config: InsertWhitelabelConfig): Promise<WhitelabelConfig> {
    const [result] = await db()
      .insert(whitelabelConfigs)
      .values(config)
      .returning();
    return result;
  }

  async updateWhitelabelConfig(organizationId: string, config: Partial<InsertWhitelabelConfig>): Promise<WhitelabelConfig> {
    const [result] = await db()
      .update(whitelabelConfigs)
      .set({
        ...config,
        updatedAt: new Date(),
      })
      .where(eq(whitelabelConfigs.organizationId, organizationId))
      .returning();
    
    if (!result) {
      // If no config exists, create one
      return this.createWhitelabelConfig({ organizationId, ...config });
    }
    
    return result;
  }


  async acceptAgencyInvitation(code: string, userId: string): Promise<Organization> {
    // Get invitation
    const invitation = await this.getAgencyInvitationByCode(code);
    if (!invitation) {
      throw new Error("Invalid invitation code");
    }
    if (invitation.status !== "pending") {
      throw new Error("Invitation has already been used");
    }
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new Error("Invitation has expired");
    }

    // Get user
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create agency organization
    const [agencyOrg] = await db()
      .insert(organizations)
      .values({
        name: invitation.inviteeCompany || `${user.firstName || user.email}'s Agency`,
        parentOrganizationId: invitation.inviterOrganizationId,
        organizationType: "agency",
        commissionRate: invitation.commissionRate,
        creditBalance: invitation.initialCredits,
        billingPackage: "professional", // Default package for agencies
        maxAgents: 10,
        maxUsers: 50,
      })
      .returning();

    // Update user to belong to new organization
    await db()
      .update(users)
      .set({ organizationId: agencyOrg.id, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Update invitation status
    await db()
      .update(agencyInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        createdOrganizationId: agencyOrg.id,
      })
      .where(eq(agencyInvitations.id, invitation.id));

    // If initial credits provided, create transaction
    if (invitation.initialCredits && Number(invitation.initialCredits) > 0) {
      await this.createCreditTransaction({
        organizationId: agencyOrg.id,
        type: "transfer",
        amount: invitation.initialCredits,
        creditAmount: Math.round(Number(invitation.initialCredits) * 1000), // Convert to credits
        description: "Initial bonus credits from invitation",
      });
    }

    return agencyOrg;
  }

  // Unified Billing Plan operations
  async getUnifiedBillingPlans(organizationType?: string): Promise<UnifiedBillingPlan[]> {
    const conditions = [];
    if (organizationType) {
      conditions.push(eq(unifiedBillingPlans.organizationType, organizationType as any));
    }
    conditions.push(eq(unifiedBillingPlans.isActive, true));
    
    return await db()
      .select()
      .from(unifiedBillingPlans)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(unifiedBillingPlans.displayOrder);
  }

  async getUnifiedBillingPlan(id: string): Promise<UnifiedBillingPlan | undefined> {
    const [plan] = await db()
      .select()
      .from(unifiedBillingPlans)
      .where(eq(unifiedBillingPlans.id, id));
    return plan;
  }

  async createUnifiedBillingPlan(plan: InsertUnifiedBillingPlan): Promise<UnifiedBillingPlan> {
    const [created] = await db()
      .insert(unifiedBillingPlans)
      .values(plan)
      .returning();
    return created;
  }

  async updateUnifiedBillingPlan(id: string, updates: Partial<InsertUnifiedBillingPlan>): Promise<UnifiedBillingPlan> {
    const [updated] = await db()
      .update(unifiedBillingPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(unifiedBillingPlans.id, id))
      .returning();
    return updated;
  }

  async deleteUnifiedBillingPlan(id: string): Promise<void> {
    await db()
      .update(unifiedBillingPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(unifiedBillingPlans.id, id));
  }

  // Payment Split operations
  async getPaymentSplits(paymentId: string): Promise<PaymentSplit[]> {
    return await db()
      .select()
      .from(paymentSplits)
      .where(eq(paymentSplits.paymentId, paymentId));
  }

  async createPaymentSplit(split: InsertPaymentSplit): Promise<PaymentSplit> {
    const [created] = await db()
      .insert(paymentSplits)
      .values(split)
      .returning();
    return created;
  }

  async updatePaymentSplit(id: string, updates: Partial<InsertPaymentSplit>): Promise<PaymentSplit> {
    const [updated] = await db()
      .update(paymentSplits)
      .set(updates)
      .where(eq(paymentSplits.id, id))
      .returning();
    return updated;
  }

  // Unified Subscription operations
  async getUnifiedSubscriptions(organizationId: string): Promise<UnifiedSubscription[]> {
    return await db()
      .select()
      .from(unifiedSubscriptions)
      .where(eq(unifiedSubscriptions.organizationId, organizationId))
      .orderBy(desc(unifiedSubscriptions.createdAt));
  }

  async getUnifiedSubscription(id: string): Promise<UnifiedSubscription | undefined> {
    const [subscription] = await db()
      .select()
      .from(unifiedSubscriptions)
      .where(eq(unifiedSubscriptions.id, id));
    return subscription;
  }

  async createUnifiedSubscription(subscription: InsertUnifiedSubscription): Promise<UnifiedSubscription> {
    const [created] = await db()
      .insert(unifiedSubscriptions)
      .values(subscription)
      .returning();
    return created;
  }

  async updateUnifiedSubscription(id: string, updates: Partial<InsertUnifiedSubscription>): Promise<UnifiedSubscription> {
    const [updated] = await db()
      .update(unifiedSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(unifiedSubscriptions.id, id))
      .returning();
    return updated;
  }

  async cancelUnifiedSubscription(id: string): Promise<void> {
    await db()
      .update(unifiedSubscriptions)
      .set({ 
        status: 'canceled', 
        canceledAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(unifiedSubscriptions.id, id));
  }
}

export const storage = new DatabaseStorage();
