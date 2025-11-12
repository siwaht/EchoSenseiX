# User Management System (UMS) Specification
## Multi-Tiered Architecture with Centralized Billing

**Version:** 1.0
**Last Updated:** 2025-11-12
**Status:** Draft

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Role Definitions](#3-role-definitions)
4. [Data Models](#4-data-models)
5. [Permission System](#5-permission-system)
6. [Credit & Billing System](#6-credit--billing-system)
7. [API Endpoints](#7-api-endpoints)
8. [Security & Compliance](#8-security--compliance)
9. [User Flows](#9-user-flows)
10. [Implementation Phases](#10-implementation-phases)

---

## 1. System Overview

### 1.1 Purpose
The User Management System (UMS) provides a hierarchical multi-tenant platform that enables:
- **System Admins** to manage agencies (tenants) and platform-level configuration
- **Agency Managers** to manage their agency users and distribute credits
- **Agency Users** to consume platform services within their allocated permissions and credits

### 1.2 Key Features
- **Multi-Tier Hierarchy**: System Admin → Agency Manager → Agency User
- **Granular Permissions**: Role-based access control (RBAC) with customizable permissions
- **Centralized Billing**: Credit-based consumption model with agency-level allocation
- **Tenant Isolation**: Complete data separation between agencies
- **Audit Trail**: Comprehensive logging of all user actions and credit transactions

### 1.3 Core Principles
- **Scalability**: Support for unlimited agencies and users
- **Security**: Role-based access, data encryption, audit logs
- **Flexibility**: Customizable permissions and credit allocation strategies
- **Transparency**: Clear credit usage tracking at all levels

---

## 2. Architecture

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      PLATFORM LEVEL                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │              System Admins                         │     │
│  │  - Manage Agencies                                 │     │
│  │  - Allocate Credits                                │     │
│  │  - Configure Permissions                           │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
┌───────────────▼─────────────┐  ┌─────▼──────────────────────┐
│     AGENCY A (Tenant)       │  │   AGENCY B (Tenant)        │
│  ┌──────────────────────┐   │  │  ┌──────────────────────┐  │
│  │  Agency Managers     │   │  │  │  Agency Managers     │  │
│  │  - Manage Users      │   │  │  │  - Manage Users      │  │
│  │  - Assign Permissions│   │  │  │  - Assign Permissions│  │
│  │  - Track Credits     │   │  │  │  - Track Credits     │  │
│  └──────────────────────┘   │  │  └──────────────────────┘  │
│           │                  │  │           │                 │
│  ┌────────▼──────────┐       │  │  ┌────────▼──────────┐     │
│  │  Agency Users     │       │  │  │  Agency Users     │     │
│  │  - Consume Services│      │  │  │  - Consume Services│    │
│  │  - View Credits   │       │  │  │  - View Credits   │     │
│  └───────────────────┘       │  │  └───────────────────┘     │
└──────────────────────────────┘  └────────────────────────────┘
```

### 2.2 Technology Stack
- **Backend**: Node.js/Express with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **API**: RESTful API with OpenAPI/Swagger documentation
- **Caching**: Redis for session management and performance
- **Monitoring**: Comprehensive audit logging

---

## 3. Role Definitions

### 3.1 System Admin (Top-Level)

**Role Type**: Platform Administrator
**Hierarchy Level**: 0 (Highest)
**Organization Type**: `platform_owner`

#### Capabilities

##### Agency Management
- **Create Agency**: Provision new agency tenants with initial configuration
- **Edit Agency**: Modify agency details, limits, and settings
- **Deactivate Agency**: Suspend or permanently disable agency access
- **View All Agencies**: Access to complete agency list and analytics

##### User Management
- **Create System Admins**: Add additional platform administrators
- **Manage Admin Roles**: Assign/revoke admin permissions
- **Impersonate Users**: Access system as any user for support purposes (with audit trail)

##### Permission Control
- **Define Permission Templates**: Create reusable permission sets
- **Assign Global Permissions**: Set platform-wide permission policies
- **Override Agency Permissions**: Grant/restrict specific permissions per agency
- **Manage Permission Hierarchy**: Define which permissions can be delegated

##### Billing & Credits
- **Allocate Initial Credits**: Set starting credit balance for new agencies
- **Top-Up Credits**: Add credits to existing agencies
- **Configure Payment Systems**: Set up Stripe/PayPal integrations per agency
- **Set Credit Rates**: Define cost per service (e.g., $0.30 per call minute)
- **View Platform-Wide Usage**: Analytics across all agencies and users

##### System Configuration
- **Platform Settings**: Configure global system parameters
- **Feature Flags**: Enable/disable features for agencies
- **Billing Packages**: Create and manage subscription tiers
- **Service Limits**: Set rate limits and quotas

#### Restrictions
- Cannot directly manage Agency Users (must go through Agency Manager)
- All actions are logged for compliance
- Requires MFA for critical operations

---

### 3.2 Agency Manager (Mid-Level)

**Role Type**: Tenant Administrator
**Hierarchy Level**: 1
**Organization Type**: `agency`

#### Capabilities

##### User Management (Agency-Scoped)
- **Create Agency Users**: Add users to their agency
- **Edit User Profiles**: Modify user details and roles
- **Deactivate Users**: Suspend or remove user access
- **Assign User Roles**: Set predefined roles (Manager, User, Viewer, etc.)
- **Manage User Teams**: Create sub-groups within agency

##### Permission Control (Constrained)
- **Assign Permissions**: Grant permissions within agency's allowed scope
- **Create Role Templates**: Define custom roles for agency users
- **View Permission Reports**: See permission assignments across agency
- **Request Additional Permissions**: Submit requests to System Admin

**Permission Constraint Logic**:
```typescript
// Agency Users can only receive permissions that:
// 1. Agency Manager has been granted by System Admin
// 2. Agency Manager has explicitly assigned
userPermissions = intersection(
  agencyAllowedPermissions,
  managerGrantedPermissions
)
```

##### Credit Management
- **View Agency Balance**: See total allocated credits
- **Track User Consumption**: Monitor credit usage per user
- **Set User Limits**: Define individual user credit caps
- **View Credit History**: Access complete transaction log
- **Generate Usage Reports**: Export credit consumption data
- **Configure Alerts**: Set notifications for low credits

##### Agency Configuration
- **Customize Branding**: White-label settings (if enabled)
- **Configure Integrations**: Set up third-party services
- **Manage Agency Settings**: Update preferences and defaults

#### Restrictions
- Cannot view or manage users from other agencies
- Cannot modify their own allocated credit balance (read-only)
- Cannot grant permissions beyond their agency's scope
- Cannot access System Admin functions

---

### 3.3 Agency User (Base-Level)

**Role Type**: End User
**Hierarchy Level**: 2
**Organization Type**: `agency` (member)

#### Capabilities

##### Service Access
- **Use Platform Features**: Access services based on assigned permissions
- **View Personal Dashboard**: See individual statistics and usage
- **Manage Profile**: Update personal information
- **Configure Preferences**: Set user-specific settings

##### Credit Visibility
- **View Credit Consumption**: See personal credit usage
- **View Usage History**: Access individual transaction log
- **Check Remaining Balance**: See allocated credits (if user-level limits exist)
- **Receive Notifications**: Alerts for approaching limits

##### Collaboration
- **Work Within Teams**: Access shared resources (if permitted)
- **View Agency Resources**: See shared assets and templates
- **Submit Requests**: Request additional permissions from Agency Manager

#### Restrictions
- Cannot view other users' consumption data
- Cannot manage any users
- Cannot modify permissions
- Cannot view agency-wide credit balance
- Limited to assigned permissions only

---

## 4. Data Models

### 4.1 Core Entities

#### 4.1.1 Users Table
```typescript
interface User {
  id: string;                      // UUID
  email: string;                   // Unique, indexed
  password: string;                // Hashed (bcrypt)
  firstName: string;
  lastName: string;
  profileImageUrl?: string;

  // Organizational
  organizationId: string;          // FK to organizations
  role: UserRole;                  // 'system_admin' | 'agency' | 'user'
  roleTemplate?: string;           // Reference to role template

  // Status
  status: UserStatus;              // 'active' | 'inactive' | 'suspended'

  // Permissions
  permissions: string[];           // Array of permission codes

  // Metadata
  metadata: Record<string, any>;   // Custom attributes
  lastLoginAt: Date;
  invitedBy?: string;              // User ID who created this user

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

enum UserRole {
  SYSTEM_ADMIN = 'system_admin',
  AGENCY_MANAGER = 'agency',
  AGENCY_USER = 'user',
  VIEWER = 'viewer'
}

enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}
```

#### 4.1.2 Organizations Table
```typescript
interface Organization {
  id: string;                          // UUID
  name: string;

  // Type & Hierarchy
  organizationType: OrganizationType;  // 'platform_owner' | 'agency' | 'end_customer'
  parentOrganizationId?: string;       // FK to parent agency

  // Branding
  subdomain?: string;                  // e.g., 'acme' → acme.platform.com
  customDomain?: string;               // e.g., 'dashboard.acme.com'
  logo?: string;

  // Billing
  billingPackage: BillingPackage;      // 'starter' | 'professional' | 'enterprise'
  creditBalance: number;               // Decimal(10,2) - Current credits
  monthlyCredits: number;              // Allocated per month
  usedCredits: number;                 // Consumed credits
  perCallRate: number;                 // Cost per call
  perMinuteRate: number;               // Cost per minute
  commissionRate: number;              // Percentage for agencies

  // Payment Integration
  stripeCustomerId?: string;
  stripeConnectAccountId?: string;     // For agencies receiving payouts
  paymentProcessors: PaymentProcessor[]; // Configured payment methods

  // Status
  billingStatus: BillingStatus;        // 'active' | 'past_due' | 'suspended'
  creditAlertStatus: CreditAlertStatus; // 'normal' | 'warning' | 'critical'

  // Limits
  maxAgents: number;
  maxUsers: number;
  tierLimits: {
    maxMinutesPerMonth?: number;
    maxCallsPerMonth?: number;
    maxStorageGB?: number;
  };

  // Permissions
  agencyPermissions: string[];         // Permissions available to agency

  // Settings
  settings: {
    defaultUserRole?: string;
    autoProvisionResources?: boolean;
    customBranding?: {
      primaryColor?: string;
      logoUrl?: string;
    };
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  servicePausedAt?: Date;
}

enum OrganizationType {
  PLATFORM_OWNER = 'platform_owner',
  AGENCY = 'agency',
  END_CUSTOMER = 'end_customer'
}

enum BillingPackage {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom'
}

enum BillingStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAST_DUE = 'past_due',
  SUSPENDED = 'suspended'
}

enum CreditAlertStatus {
  NORMAL = 'normal',
  WARNING_25 = 'warning_25',      // 25% remaining
  WARNING_10 = 'warning_10',      // 10% remaining
  CRITICAL_5 = 'critical_5',      // 5% remaining
  DEPLETED = 'depleted'           // 0% remaining
}
```

#### 4.1.3 Permission Templates Table
```typescript
interface PermissionTemplate {
  id: string;
  name: string;
  description: string;

  // Permissions
  permissions: string[];              // Array of permission codes

  // Metadata
  isSystemDefault: boolean;           // Managed by platform
  organizationId?: string;            // Null for system templates

  // Constraints
  requiredPermissions?: string[];     // Prerequisites
  excludedPermissions?: string[];     // Mutually exclusive

  createdAt: Date;
  updatedAt: Date;
}
```

#### 4.1.4 Credit Transactions Table
```typescript
interface CreditTransaction {
  id: string;

  // Transaction Details
  type: TransactionType;              // 'allocation' | 'consumption' | 'refund'
  amount: number;                     // Decimal(10,4)
  balanceBefore: number;
  balanceAfter: number;

  // Parties
  organizationId: string;             // Agency that owns the credits
  userId?: string;                    // User who consumed (if applicable)
  performedBy: string;                // User who initiated

  // Context
  resource?: string;                  // What was consumed (e.g., 'call', 'message')
  resourceId?: string;                // Specific resource ID
  metadata: {
    callDuration?: number;
    serviceName?: string;
    rate?: number;
  };

  // Status
  status: TransactionStatus;          // 'completed' | 'pending' | 'failed'

  // Timestamps
  createdAt: Date;
}

enum TransactionType {
  ALLOCATION = 'allocation',          // Credits added by System Admin
  CONSUMPTION = 'consumption',        // Credits used by Agency User
  REFUND = 'refund',                  // Credits returned
  ADJUSTMENT = 'adjustment'           // Manual correction
}

enum TransactionStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  FAILED = 'failed',
  REVERSED = 'reversed'
}
```

#### 4.1.5 User Credit Limits Table
```typescript
interface UserCreditLimit {
  id: string;
  userId: string;                     // FK to users
  organizationId: string;             // FK to organizations

  // Limits
  dailyLimit?: number;                // Max credits per day
  weeklyLimit?: number;               // Max credits per week
  monthlyLimit?: number;              // Max credits per month
  totalLimit?: number;                // Lifetime limit

  // Current Usage
  dailyUsed: number;
  weeklyUsed: number;
  monthlyUsed: number;
  totalUsed: number;

  // Reset Tracking
  lastDailyReset: Date;
  lastWeeklyReset: Date;
  lastMonthlyReset: Date;

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

#### 4.1.6 Audit Logs Table
```typescript
interface AuditLog {
  id: string;

  // Actor
  userId: string;
  userEmail: string;
  userRole: UserRole;

  // Action
  action: string;                     // 'create_user', 'allocate_credits', etc.
  resource: string;                   // 'user', 'organization', 'credits'
  resourceId?: string;

  // Changes
  changesBefore?: Record<string, any>;
  changesAfter?: Record<string, any>;

  // Context
  organizationId?: string;
  ipAddress: string;
  userAgent: string;

  // Metadata
  metadata?: Record<string, any>;

  // Result
  status: 'success' | 'failure';
  errorMessage?: string;

  createdAt: Date;
}
```

### 4.2 Permission Codes

#### 4.2.1 System Admin Permissions
```typescript
const SYSTEM_ADMIN_PERMISSIONS = [
  // Agency Management
  'system:agencies:create',
  'system:agencies:read',
  'system:agencies:update',
  'system:agencies:delete',
  'system:agencies:suspend',

  // User Management
  'system:admins:create',
  'system:admins:manage',
  'system:users:impersonate',
  'system:users:view_all',

  // Credits & Billing
  'system:credits:allocate',
  'system:credits:adjust',
  'system:billing:configure',
  'system:billing:view_all',

  // Permissions
  'system:permissions:manage',
  'system:permissions:override',
  'system:roles:create',
  'system:roles:assign',

  // Platform Configuration
  'system:config:update',
  'system:features:toggle',
  'system:reports:view_all',
  'system:audit:view_all'
];
```

#### 4.2.2 Agency Manager Permissions
```typescript
const AGENCY_MANAGER_PERMISSIONS = [
  // User Management (Agency Scope)
  'agency:users:create',
  'agency:users:read',
  'agency:users:update',
  'agency:users:delete',
  'agency:users:suspend',

  // Role Management
  'agency:roles:create',
  'agency:roles:assign',
  'agency:roles:view',

  // Credit Management
  'agency:credits:view',
  'agency:credits:track_users',
  'agency:credits:set_limits',
  'agency:credits:view_history',
  'agency:credits:export',

  // Team Management
  'agency:teams:create',
  'agency:teams:manage',
  'agency:teams:view',

  // Configuration
  'agency:settings:update',
  'agency:branding:customize',
  'agency:integrations:manage',

  // Reports
  'agency:reports:view',
  'agency:reports:export',
  'agency:analytics:view'
];
```

#### 4.2.3 Agency User Permissions (Examples)
```typescript
const AGENCY_USER_PERMISSIONS = [
  // Profile
  'user:profile:read',
  'user:profile:update',

  // Credits
  'user:credits:view_own',
  'user:usage:view_own',

  // Services (examples - varies by platform)
  'service:agents:create',
  'service:agents:read',
  'service:agents:update',
  'service:calls:make',
  'service:calls:view_own',
  'service:analytics:view_own',

  // Collaboration
  'team:resources:view',
  'team:resources:use'
];
```

---

## 5. Permission System

### 5.1 Permission Hierarchy

```
System Admin Permissions
    │
    ├─ Can grant ──→ Agency Manager Permissions
    │                      │
    │                      ├─ Can grant ──→ Agency User Permissions
    │                      │
    │                      └─ Cannot exceed Agency's allowed permissions
    │
    └─ Can override any permission at any level
```

### 5.2 Permission Inheritance Rules

#### Rule 1: Downward Inheritance
- Agency Managers can only assign permissions they possess
- Agency Users inherit from their Agency Manager's grants
- Permissions cannot be elevated without System Admin approval

#### Rule 2: Constraint Enforcement
```typescript
function canAssignPermission(
  assignerRole: UserRole,
  assignerPermissions: string[],
  targetPermission: string,
  organizationPermissions: string[]
): boolean {
  // System Admins can assign any permission
  if (assignerRole === UserRole.SYSTEM_ADMIN) {
    return true;
  }

  // Agency Managers must have permission themselves
  if (assignerRole === UserRole.AGENCY_MANAGER) {
    return (
      assignerPermissions.includes(targetPermission) &&
      organizationPermissions.includes(targetPermission)
    );
  }

  // Agency Users cannot assign permissions
  return false;
}
```

#### Rule 3: Permission Templates
- System Admins create global templates
- Agency Managers create agency-specific templates
- Templates must respect hierarchy rules

### 5.3 Permission Check Flow

```typescript
async function checkPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  // 1. Fetch user
  const user = await storage.getUser(userId);
  if (!user || user.status !== 'active') {
    return false;
  }

  // 2. Check user-level permissions
  if (user.permissions.includes(permission)) {
    return true;
  }

  // 3. Check role template permissions
  if (user.roleTemplate) {
    const template = await storage.getRoleTemplate(user.roleTemplate);
    if (template?.permissions.includes(permission)) {
      return true;
    }
  }

  // 4. Check organization-level permissions
  const org = await storage.getOrganization(user.organizationId);
  if (org?.agencyPermissions.includes(permission)) {
    return true;
  }

  // 5. Check wildcard permissions
  const hasWildcard = user.permissions.some(p =>
    permission.startsWith(p.replace('*', ''))
  );

  return hasWildcard;
}
```

### 5.4 Permission Middleware

```typescript
// Express middleware for route protection
function requirePermission(permission: string): RequestHandler {
  return async (req: any, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPermission = await checkPermission(req.user.id, permission);

    if (!hasPermission) {
      await createAuditLog({
        userId: req.user.id,
        action: 'permission_denied',
        resource: permission,
        status: 'failure',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission
      });
    }

    next();
  };
}
```

---

## 6. Credit & Billing System

### 6.1 Credit Flow Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    System Admin                             │
│                                                             │
│  1. Allocates Initial Credits to Agency                    │
│     - One-time setup: 1000 credits                         │
│     - Monthly allocation: 500 credits                      │
│     - Top-up: +250 credits                                 │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│               Agency Credit Pool                            │
│                                                             │
│  Balance: 1,750 credits                                    │
│  Usage: 234 credits                                        │
│  Remaining: 1,516 credits                                  │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │  Credit Distribution by User                   │        │
│  │  • User A: 123 credits used (no limit)        │        │
│  │  • User B: 56 credits used (limit: 100)       │        │
│  │  • User C: 45 credits used (limit: 200)       │        │
│  │  • User D: 10 credits used (no limit)         │        │
│  └────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Credit Operations

#### 6.2.1 Allocation (System Admin → Agency)
```typescript
interface AllocateCreditParams {
  organizationId: string;
  amount: number;
  type: 'initial' | 'monthly' | 'topup' | 'bonus';
  notes?: string;
  performedBy: string;
}

async function allocateCredits(
  params: AllocateCreditParams
): Promise<CreditTransaction> {
  // 1. Validate System Admin permission
  const admin = await storage.getUser(params.performedBy);
  if (admin.role !== 'system_admin') {
    throw new Error('Only System Admins can allocate credits');
  }

  // 2. Get current organization balance
  const org = await storage.getOrganization(params.organizationId);
  const balanceBefore = org.creditBalance;
  const balanceAfter = balanceBefore + params.amount;

  // 3. Create transaction record
  const transaction = await storage.createCreditTransaction({
    type: 'allocation',
    amount: params.amount,
    balanceBefore,
    balanceAfter,
    organizationId: params.organizationId,
    performedBy: params.performedBy,
    status: 'completed',
    metadata: {
      allocationType: params.type,
      notes: params.notes
    }
  });

  // 4. Update organization balance
  await storage.updateOrganization(params.organizationId, {
    creditBalance: balanceAfter,
    billingStatus: balanceAfter > 0 ? 'active' : org.billingStatus
  });

  // 5. Log audit trail
  await createAuditLog({
    userId: params.performedBy,
    action: 'allocate_credits',
    resource: 'organization',
    resourceId: params.organizationId,
    changesAfter: { creditBalance: balanceAfter },
    status: 'success'
  });

  // 6. Send notification to Agency Manager
  await notifyAgencyManagers(params.organizationId, {
    type: 'credit_allocation',
    amount: params.amount,
    newBalance: balanceAfter
  });

  return transaction;
}
```

#### 6.2.2 Consumption (Agency User → Service)
```typescript
interface ConsumeCreditsParams {
  organizationId: string;
  userId: string;
  amount: number;
  resource: string;           // e.g., 'call', 'message'
  resourceId: string;         // e.g., call ID
  metadata?: Record<string, any>;
}

async function consumeCredits(
  params: ConsumeCreditsParams
): Promise<CreditTransaction> {
  // 1. Check agency balance
  const org = await storage.getOrganization(params.organizationId);
  if (org.creditBalance < params.amount) {
    throw new InsufficientCreditsError(
      `Insufficient credits. Required: ${params.amount}, Available: ${org.creditBalance}`
    );
  }

  // 2. Check user limits (if set)
  const userLimit = await storage.getUserCreditLimit(params.userId);
  if (userLimit) {
    await enforceUserLimits(userLimit, params.amount);
  }

  // 3. Create pending transaction
  const balanceBefore = org.creditBalance;
  const balanceAfter = balanceBefore - params.amount;

  const transaction = await storage.createCreditTransaction({
    type: 'consumption',
    amount: -params.amount,  // Negative for consumption
    balanceBefore,
    balanceAfter,
    organizationId: params.organizationId,
    userId: params.userId,
    performedBy: params.userId,
    resource: params.resource,
    resourceId: params.resourceId,
    metadata: params.metadata,
    status: 'completed'
  });

  // 4. Update balances atomically
  await db.transaction(async (tx) => {
    // Update organization balance
    await tx.update(organizations)
      .set({
        creditBalance: balanceAfter,
        usedCredits: org.usedCredits + params.amount
      })
      .where(eq(organizations.id, params.organizationId));

    // Update user limit tracking
    if (userLimit) {
      await tx.update(userCreditLimits)
        .set({
          dailyUsed: userLimit.dailyUsed + params.amount,
          weeklyUsed: userLimit.weeklyUsed + params.amount,
          monthlyUsed: userLimit.monthlyUsed + params.amount,
          totalUsed: userLimit.totalUsed + params.amount
        })
        .where(eq(userCreditLimits.userId, params.userId));
    }
  });

  // 5. Check for low balance alerts
  await checkCreditAlerts(params.organizationId, balanceAfter);

  return transaction;
}
```

#### 6.2.3 User Limit Enforcement
```typescript
async function enforceUserLimits(
  limit: UserCreditLimit,
  requestedAmount: number
): Promise<void> {
  const errors: string[] = [];

  // Check daily limit
  if (limit.dailyLimit &&
      limit.dailyUsed + requestedAmount > limit.dailyLimit) {
    errors.push(`Daily limit exceeded (${limit.dailyLimit} credits)`);
  }

  // Check weekly limit
  if (limit.weeklyLimit &&
      limit.weeklyUsed + requestedAmount > limit.weeklyLimit) {
    errors.push(`Weekly limit exceeded (${limit.weeklyLimit} credits)`);
  }

  // Check monthly limit
  if (limit.monthlyLimit &&
      limit.monthlyUsed + requestedAmount > limit.monthlyLimit) {
    errors.push(`Monthly limit exceeded (${limit.monthlyLimit} credits)`);
  }

  // Check total limit
  if (limit.totalLimit &&
      limit.totalUsed + requestedAmount > limit.totalLimit) {
    errors.push(`Total limit exceeded (${limit.totalLimit} credits)`);
  }

  if (errors.length > 0) {
    throw new UserLimitExceededError(errors.join(', '));
  }
}
```

### 6.3 Credit Alert System

```typescript
async function checkCreditAlerts(
  organizationId: string,
  currentBalance: number
): Promise<void> {
  const org = await storage.getOrganization(organizationId);
  const totalAllocated = org.monthlyCredits || org.creditBalance;
  const percentRemaining = (currentBalance / totalAllocated) * 100;

  let alertStatus: CreditAlertStatus = 'normal';
  let shouldNotify = false;

  if (percentRemaining <= 5) {
    alertStatus = 'critical_5';
    shouldNotify = true;
  } else if (percentRemaining <= 10) {
    alertStatus = 'warning_10';
    shouldNotify = true;
  } else if (percentRemaining <= 25) {
    alertStatus = 'warning_25';
    shouldNotify = true;
  }

  // Update alert status
  await storage.updateOrganization(organizationId, {
    creditAlertStatus: alertStatus,
    lastAlertSentAt: shouldNotify ? new Date() : org.lastAlertSentAt
  });

  // Send notifications
  if (shouldNotify) {
    await notifyAgencyManagers(organizationId, {
      type: 'low_credits',
      status: alertStatus,
      currentBalance,
      percentRemaining
    });

    // Also notify System Admins
    await notifySystemAdmins({
      type: 'agency_low_credits',
      organizationId,
      organizationName: org.name,
      status: alertStatus,
      currentBalance
    });
  }

  // Auto-suspend if depleted
  if (currentBalance <= 0) {
    await storage.updateOrganization(organizationId, {
      billingStatus: 'suspended',
      servicePausedAt: new Date()
    });

    await notifyAgencyManagers(organizationId, {
      type: 'service_suspended',
      reason: 'Credits depleted'
    });
  }
}
```

### 6.4 Credit Reporting

#### 6.4.1 Agency Manager Dashboard
```typescript
interface AgencyCreditReport {
  // Overall Balance
  totalAllocated: number;
  currentBalance: number;
  totalUsed: number;
  percentRemaining: number;

  // Time-based Usage
  todayUsage: number;
  weekUsage: number;
  monthUsage: number;

  // User Breakdown
  userConsumption: Array<{
    userId: string;
    userName: string;
    totalUsed: number;
    limit?: number;
    percentOfLimit?: number;
  }>;

  // Service Breakdown
  serviceConsumption: Array<{
    service: string;
    totalUsed: number;
    count: number;
    averagePerUse: number;
  }>;

  // Trends
  dailyTrend: Array<{
    date: Date;
    consumption: number;
  }>;

  // Projections
  projectedDepletionDate?: Date;
  projectedMonthlyUsage: number;
}
```

#### 6.4.2 Agency User View
```typescript
interface UserCreditReport {
  // Personal Usage
  totalUsed: number;
  todayUsage: number;
  weekUsage: number;
  monthUsage: number;

  // Limits (if set)
  dailyLimit?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  totalLimit?: number;

  // Remaining (if limits set)
  dailyRemaining?: number;
  weeklyRemaining?: number;
  monthlyRemaining?: number;
  totalRemaining?: number;

  // Recent Transactions
  recentTransactions: Array<{
    id: string;
    date: Date;
    amount: number;
    resource: string;
    description: string;
  }>;

  // Service Breakdown
  serviceUsage: Array<{
    service: string;
    count: number;
    totalCredits: number;
  }>;
}
```

---

## 7. API Endpoints

### 7.1 System Admin Endpoints

#### Agency Management
```typescript
// Create Agency
POST /api/system/agencies
Authorization: Bearer {token}
Permissions: system:agencies:create

Request Body:
{
  "name": "Acme Corp",
  "billingPackage": "professional",
  "initialCredits": 1000,
  "monthlyCredits": 500,
  "perCallRate": 0.30,
  "perMinuteRate": 0.30,
  "commissionRate": 30,
  "maxAgents": 10,
  "maxUsers": 50,
  "agencyPermissions": [
    "agency:users:create",
    "agency:users:manage",
    "agency:credits:view"
  ],
  "settings": {
    "defaultUserRole": "user",
    "autoProvisionResources": true
  }
}

Response:
{
  "id": "org_abc123",
  "name": "Acme Corp",
  "organizationType": "agency",
  "creditBalance": 1000,
  "billingStatus": "active",
  "createdAt": "2025-11-12T10:00:00Z"
}

// List All Agencies
GET /api/system/agencies
Permissions: system:agencies:read
Query: ?page=1&limit=50&status=active&search=acme

// Get Agency Details
GET /api/system/agencies/:agencyId
Permissions: system:agencies:read

// Update Agency
PATCH /api/system/agencies/:agencyId
Permissions: system:agencies:update

// Suspend Agency
POST /api/system/agencies/:agencyId/suspend
Permissions: system:agencies:suspend

// Delete Agency
DELETE /api/system/agencies/:agencyId
Permissions: system:agencies:delete
```

#### Credit Management
```typescript
// Allocate Credits
POST /api/system/agencies/:agencyId/credits/allocate
Permissions: system:credits:allocate

Request Body:
{
  "amount": 500,
  "type": "topup",
  "notes": "Monthly top-up for Q4"
}

// View Credit History
GET /api/system/agencies/:agencyId/credits/history
Permissions: system:billing:view_all

// View Platform-Wide Usage
GET /api/system/credits/usage
Permissions: system:reports:view_all
Query: ?startDate=2025-10-01&endDate=2025-10-31
```

#### Permission Management
```typescript
// Create Permission Template
POST /api/system/permissions/templates
Permissions: system:roles:create

Request Body:
{
  "name": "Agency Admin",
  "description": "Full agency management access",
  "permissions": [
    "agency:users:create",
    "agency:users:manage",
    "agency:credits:view",
    "agency:settings:update"
  ]
}

// Update Agency Permissions
PATCH /api/system/agencies/:agencyId/permissions
Permissions: system:permissions:override

Request Body:
{
  "permissions": ["agency:users:create", "agency:credits:view"]
}
```

### 7.2 Agency Manager Endpoints

#### User Management
```typescript
// Create Agency User
POST /api/agency/users
Permissions: agency:users:create

Request Body:
{
  "email": "john@acme.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user",
  "permissions": [
    "service:agents:create",
    "service:calls:make"
  ],
  "creditLimits": {
    "dailyLimit": 50,
    "monthlyLimit": 500
  }
}

// List Agency Users
GET /api/agency/users
Permissions: agency:users:read
Query: ?role=user&status=active&search=john

// Update User
PATCH /api/agency/users/:userId
Permissions: agency:users:update

// Suspend User
POST /api/agency/users/:userId/suspend
Permissions: agency:users:suspend

// Delete User
DELETE /api/agency/users/:userId
Permissions: agency:users:delete
```

#### Credit Management
```typescript
// View Agency Credits
GET /api/agency/credits
Permissions: agency:credits:view

Response:
{
  "totalAllocated": 1500,
  "currentBalance": 876,
  "totalUsed": 624,
  "percentRemaining": 58.4,
  "todayUsage": 23,
  "weekUsage": 145,
  "monthUsage": 624,
  "alertStatus": "normal"
}

// View User Consumption
GET /api/agency/credits/users
Permissions: agency:credits:track_users

Response:
{
  "users": [
    {
      "userId": "user_123",
      "name": "John Doe",
      "totalUsed": 234,
      "dailyLimit": 50,
      "dailyUsed": 12,
      "status": "active"
    }
  ]
}

// Set User Credit Limits
POST /api/agency/users/:userId/credit-limits
Permissions: agency:credits:set_limits

Request Body:
{
  "dailyLimit": 100,
  "weeklyLimit": 500,
  "monthlyLimit": 1500
}

// View Credit History
GET /api/agency/credits/history
Permissions: agency:credits:view_history
Query: ?startDate=2025-10-01&userId=user_123

// Export Usage Report
GET /api/agency/credits/export
Permissions: agency:credits:export
Query: ?format=csv&startDate=2025-10-01&endDate=2025-10-31
```

#### Role Management
```typescript
// Create Role Template
POST /api/agency/roles
Permissions: agency:roles:create

Request Body:
{
  "name": "Team Lead",
  "description": "Team lead with elevated permissions",
  "permissions": [
    "service:agents:create",
    "service:analytics:view",
    "team:resources:manage"
  ]
}

// Assign Role to User
POST /api/agency/users/:userId/role
Permissions: agency:roles:assign

Request Body:
{
  "roleTemplate": "role_teamlead_123"
}
```

### 7.3 Agency User Endpoints

```typescript
// View Personal Profile
GET /api/user/profile
Permissions: user:profile:read

// Update Profile
PATCH /api/user/profile
Permissions: user:profile:update

// View Personal Credit Usage
GET /api/user/credits
Permissions: user:credits:view_own

Response:
{
  "totalUsed": 156,
  "todayUsage": 8,
  "weekUsage": 45,
  "monthUsage": 156,
  "dailyLimit": 50,
  "dailyRemaining": 42,
  "recentTransactions": [
    {
      "id": "tx_123",
      "date": "2025-11-12T09:30:00Z",
      "amount": 3.2,
      "resource": "call",
      "description": "Phone call (6.4 minutes)"
    }
  ]
}

// View Usage History
GET /api/user/credits/history
Permissions: user:usage:view_own
Query: ?startDate=2025-10-01&limit=50
```

### 7.4 Authentication Endpoints

```typescript
// Login
POST /api/auth/login
Request Body:
{
  "email": "user@example.com",
  "password": "securepassword"
}

Response:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "role": "user",
    "organizationId": "org_abc"
  }
}

// Refresh Token
POST /api/auth/refresh
Request Body:
{
  "refreshToken": "eyJhbGc..."
}

// Logout
POST /api/auth/logout

// Change Password
POST /api/auth/password/change
Request Body:
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

---

## 8. Security & Compliance

### 8.1 Authentication

#### JWT Configuration
```typescript
const JWT_CONFIG = {
  accessToken: {
    expiresIn: '15m',
    algorithm: 'RS256'
  },
  refreshToken: {
    expiresIn: '7d',
    algorithm: 'RS256'
  }
};
```

#### Password Policy
- Minimum 12 characters
- Must include uppercase, lowercase, number, and special character
- Hashed using bcrypt (cost factor: 12)
- Password history: prevent reuse of last 5 passwords
- Password expiry: 90 days for System Admins

#### Multi-Factor Authentication (MFA)
- **Required for**: System Admins
- **Optional for**: Agency Managers and Users
- **Methods**: TOTP (Google Authenticator, Authy), SMS backup
- **Enforcement**: Configurable per agency

### 8.2 Authorization

#### Role-Based Access Control (RBAC)
- Permissions checked on every API request
- Cached in Redis for performance (5-minute TTL)
- Invalidated on permission changes
- Middleware: `requirePermission(permission: string)`

#### Data Isolation
- Organization ID filtering on all queries
- Prevents cross-tenant data access
- Enforced at database query level
- Validated in application middleware

### 8.3 Audit Logging

#### Logged Actions
- User authentication (login, logout, failed attempts)
- Permission changes
- Credit allocations and consumption
- User creation, modification, deletion
- Organization changes
- Role assignments
- Administrative actions

#### Log Retention
- **Audit Logs**: 7 years (compliance requirement)
- **Credit Transactions**: Indefinite
- **Activity Logs**: 90 days

#### Log Format
```typescript
{
  "timestamp": "2025-11-12T10:30:45.123Z",
  "level": "info",
  "userId": "user_123",
  "userEmail": "admin@example.com",
  "action": "allocate_credits",
  "resource": "organization",
  "resourceId": "org_abc",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "changes": {
    "before": { "creditBalance": 500 },
    "after": { "creditBalance": 1000 }
  },
  "status": "success"
}
```

### 8.4 Data Protection

#### Encryption
- **At Rest**: AES-256 encryption for sensitive data
- **In Transit**: TLS 1.3 for all API communications
- **Database**: Encrypted fields for API keys, payment info
- **Backups**: Encrypted with separate keys

#### Sensitive Data Handling
- API keys hashed before storage
- Payment tokens never stored (use payment processor tokens)
- Personal data minimization
- GDPR compliance: right to deletion, data portability

#### Rate Limiting
```typescript
const RATE_LIMITS = {
  authentication: {
    window: '15m',
    max: 5  // 5 login attempts per 15 minutes
  },
  api: {
    window: '1m',
    max: 100  // 100 requests per minute per user
  },
  creditConsumption: {
    window: '1s',
    max: 10  // Prevent abuse
  }
};
```

### 8.5 Compliance

#### GDPR Compliance
- User consent tracking
- Data processing agreements
- Right to access (export user data)
- Right to deletion (anonymize or delete)
- Data breach notification (72 hours)

#### SOC 2 Compliance
- Access controls
- Audit logging
- Encryption standards
- Change management
- Incident response

---

## 9. User Flows

### 9.1 System Admin Flow: Create Agency

```
1. System Admin logs in
   ↓
2. Navigate to "Agencies" → "Create New Agency"
   ↓
3. Fill in agency details:
   - Name: "Acme Corp"
   - Billing Package: "Professional"
   - Initial Credits: 1000
   - Monthly Credits: 500
   - Max Users: 50
   ↓
4. Select agency permissions template or customize
   ↓
5. Review and confirm
   ↓
6. System creates:
   - Organization record
   - Credit allocation transaction
   - Audit log entry
   ↓
7. System generates invitation for Agency Manager
   ↓
8. Email sent to Agency Manager with:
   - Invitation link
   - Initial credentials
   - Credit allocation details
   ↓
9. Success: Agency created and active
```

### 9.2 Agency Manager Flow: Create User

```
1. Agency Manager logs in
   ↓
2. Navigate to "Team" → "Add User"
   ↓
3. Fill in user details:
   - Email: john@acme.com
   - Name: John Doe
   - Role: "Team Member"
   ↓
4. Select permissions (constrained to agency's permissions):
   ☑ Create agents
   ☑ Make calls
   ☐ View analytics (not available to agency)
   ↓
5. Set credit limits (optional):
   - Daily: 50 credits
   - Monthly: 500 credits
   ↓
6. Review and send invitation
   ↓
7. System creates:
   - User record (status: pending)
   - User credit limit record
   - Invitation record
   - Audit log entry
   ↓
8. Email sent to user with invitation link
   ↓
9. User accepts invitation:
   - Sets password
   - Completes profile
   - Status: active
   ↓
10. User can now access platform
```

### 9.3 Agency User Flow: Service Consumption

```
1. Agency User logs in
   ↓
2. Navigate to service (e.g., "Make Call")
   ↓
3. Configure service parameters:
   - Phone number
   - Agent selection
   - Call settings
   ↓
4. Initiate service
   ↓
5. System checks:
   a. User has permission: "service:calls:make" ✓
   b. Agency has sufficient credits: 876 available ✓
   c. User within daily limit: 12/50 used ✓
   ↓
6. Service executes:
   - Call duration: 6.4 minutes
   - Cost: 6.4 × $0.30 = 1.92 credits
   ↓
7. System records:
   - Credit transaction (consumption)
   - Update agency balance: 876 → 874.08
   - Update user daily usage: 12 → 13.92
   - Update service log (call record)
   ↓
8. Real-time updates:
   - User dashboard: shows new balance
   - Agency Manager dashboard: reflects consumption
   ↓
9. If approaching limit:
   - User notification: "80% of daily limit used"
   - Agency Manager notification: "User approaching limit"
   ↓
10. Service completes successfully
```

### 9.4 Credit Depletion Flow

```
1. Agency User attempts to use service
   ↓
2. System checks agency credit balance: 2.5 credits remaining
   ↓
3. Service cost: 5 credits required
   ↓
4. Insufficient credits error:
   {
     "error": "Insufficient credits",
     "required": 5,
     "available": 2.5,
     "message": "Please contact your agency administrator"
   }
   ↓
5. User sees error message with support contact
   ↓
6. Agency Manager receives notification:
   - "Credits depleted"
   - Current balance: 2.5
   - Recommended action: Contact System Admin
   ↓
7. Agency Manager contacts System Admin
   ↓
8. System Admin reviews usage:
   - Monthly consumption: 1,247 credits
   - Allocated: 1,000 credits
   - Recommendation: Top-up or increase monthly allocation
   ↓
9. System Admin allocates credits:
   - Top-up: +500 credits
   - New balance: 502.5 credits
   ↓
10. Agency reactivated automatically:
    - Billing status: suspended → active
    - Users can resume service consumption
    ↓
11. Notifications sent:
    - Agency Manager: "Credits added, service restored"
    - Users: "Service access restored"
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Core infrastructure and basic user management

#### Tasks
- [ ] Database schema implementation
  - Users table with role hierarchy
  - Organizations table
  - Permission templates
  - Audit logs
- [ ] Authentication system
  - JWT implementation
  - Password hashing
  - Session management
- [ ] Basic RBAC middleware
  - Permission checking
  - Role enforcement
- [ ] System Admin portal (MVP)
  - Login/logout
  - Agency creation
  - User creation

#### Deliverables
- Working authentication
- System Admin can create agencies
- Basic permission system functional
- Database migrations

---

### Phase 2: Credit System (Weeks 3-4)
**Goal**: Credit allocation and tracking

#### Tasks
- [ ] Credit transaction system
  - Allocation workflow
  - Consumption tracking
  - Transaction logging
- [ ] Credit management APIs
  - Allocate credits endpoint
  - View balance endpoint
  - Transaction history endpoint
- [ ] Basic reporting
  - Agency credit dashboard
  - User consumption view
- [ ] Alert system (basic)
  - Low balance notifications
  - Email templates

#### Deliverables
- Credits can be allocated to agencies
- Credits consumed by services tracked
- Basic credit reporting
- Low balance alerts

---

### Phase 3: Agency Manager Features (Weeks 5-6)
**Goal**: Full agency management capabilities

#### Tasks
- [ ] Agency Manager portal
  - User management UI
  - Permission assignment UI
  - Credit tracking dashboard
- [ ] User limit system
  - Set user credit limits
  - Enforce limits on consumption
  - Reset schedules (daily/weekly/monthly)
- [ ] Role templates
  - Create custom roles
  - Assign roles to users
  - Permission inheritance
- [ ] Enhanced reporting
  - User consumption breakdown
  - Service usage analytics
  - Export functionality

#### Deliverables
- Agency Managers can fully manage users
- User-level credit limits enforced
- Custom roles and permissions
- Comprehensive reporting

---

### Phase 4: Advanced Features (Weeks 7-8)
**Goal**: Production-ready system with advanced capabilities

#### Tasks
- [ ] Advanced permission system
  - Wildcard permissions
  - Permission dependencies
  - Constraint validation
- [ ] Enhanced security
  - MFA implementation
  - Rate limiting
  - IP whitelisting
- [ ] Advanced credit features
  - Credit packages
  - Auto-renewal
  - Payment integration (Stripe)
- [ ] Comprehensive audit system
  - Detailed logging
  - Compliance reports
  - Data retention policies

#### Deliverables
- Production-ready security
- Payment integration
- Comprehensive audit trail
- SOC 2 compliance baseline

---

### Phase 5: Polish & Optimization (Weeks 9-10)
**Goal**: Performance, UX, and production readiness

#### Tasks
- [ ] Performance optimization
  - Query optimization
  - Caching strategy (Redis)
  - API response time optimization
- [ ] User experience improvements
  - Onboarding flows
  - In-app guidance
  - Error message refinement
- [ ] Testing & QA
  - Unit tests (80% coverage)
  - Integration tests
  - End-to-end tests
  - Load testing
- [ ] Documentation
  - API documentation (OpenAPI)
  - Admin guide
  - Agency Manager guide
  - Developer documentation

#### Deliverables
- Performance SLAs met (p95 < 200ms)
- Complete test coverage
- Production-ready documentation
- Launch readiness

---

## Appendices

### A. Error Codes

```typescript
enum ErrorCode {
  // Authentication
  AUTH_INVALID_CREDENTIALS = 'AUTH_001',
  AUTH_TOKEN_EXPIRED = 'AUTH_002',
  AUTH_TOKEN_INVALID = 'AUTH_003',
  AUTH_MFA_REQUIRED = 'AUTH_004',

  // Authorization
  AUTHZ_INSUFFICIENT_PERMISSIONS = 'AUTHZ_001',
  AUTHZ_ROLE_NOT_FOUND = 'AUTHZ_002',
  AUTHZ_PERMISSION_DENIED = 'AUTHZ_003',

  // Credits
  CREDIT_INSUFFICIENT_BALANCE = 'CREDIT_001',
  CREDIT_USER_LIMIT_EXCEEDED = 'CREDIT_002',
  CREDIT_INVALID_AMOUNT = 'CREDIT_003',
  CREDIT_ALLOCATION_FAILED = 'CREDIT_004',

  // Users
  USER_NOT_FOUND = 'USER_001',
  USER_ALREADY_EXISTS = 'USER_002',
  USER_SUSPENDED = 'USER_003',
  USER_INVALID_ROLE = 'USER_004',

  // Organizations
  ORG_NOT_FOUND = 'ORG_001',
  ORG_SUSPENDED = 'ORG_002',
  ORG_LIMIT_EXCEEDED = 'ORG_003'
}
```

### B. Configuration Examples

#### System Admin Configuration
```json
{
  "platformOwner": {
    "organizationId": "org_platform",
    "name": "EchoSenseiX Platform",
    "organizationType": "platform_owner",
    "creditBalance": 999999999,
    "settings": {
      "defaultBillingPackage": "starter",
      "defaultMonthlyCredits": 500,
      "creditAlertThresholds": {
        "warning": 25,
        "critical": 5
      },
      "sessionTimeout": 3600,
      "mfaRequired": true
    }
  }
}
```

#### Agency Configuration Template
```json
{
  "agency": {
    "name": "Acme Corp",
    "organizationType": "agency",
    "billingPackage": "professional",
    "creditBalance": 1000,
    "monthlyCredits": 500,
    "perCallRate": 0.30,
    "perMinuteRate": 0.30,
    "commissionRate": 30,
    "maxAgents": 10,
    "maxUsers": 50,
    "agencyPermissions": [
      "agency:users:create",
      "agency:users:manage",
      "agency:credits:view",
      "agency:settings:update",
      "service:agents:create",
      "service:calls:make"
    ],
    "settings": {
      "defaultUserRole": "user",
      "autoProvisionResources": true,
      "creditAlerts": true,
      "dailyReports": true
    }
  }
}
```

### C. Database Indexes

```sql
-- Performance-critical indexes

-- Users
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Organizations
CREATE INDEX idx_organizations_type ON organizations(organization_type);
CREATE INDEX idx_organizations_parent ON organizations(parent_organization_id);
CREATE INDEX idx_organizations_billing_status ON organizations(billing_status);

-- Credit Transactions
CREATE INDEX idx_credit_tx_organization ON credit_transactions(organization_id);
CREATE INDEX idx_credit_tx_user ON credit_transactions(user_id);
CREATE INDEX idx_credit_tx_created ON credit_transactions(created_at DESC);
CREATE INDEX idx_credit_tx_type ON credit_transactions(type);

-- User Credit Limits
CREATE INDEX idx_user_limits_user ON user_credit_limits(user_id);
CREATE INDEX idx_user_limits_org ON user_credit_limits(organization_id);

-- Audit Logs
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

### D. API Rate Limits

```typescript
const RATE_LIMITS_BY_ROLE = {
  system_admin: {
    requestsPerMinute: 1000,
    burstSize: 100
  },
  agency_manager: {
    requestsPerMinute: 500,
    burstSize: 50
  },
  agency_user: {
    requestsPerMinute: 100,
    burstSize: 20
  }
};
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-12 | System Architect | Initial specification |

---

**END OF SPECIFICATION**
