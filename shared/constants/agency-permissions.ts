export interface AgencyPermission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const AGENCY_PERMISSIONS: AgencyPermission[] = [
  // Whitelabel & Branding
  {
    id: "manage_branding",
    name: "Manage Branding",
    description: "Customize logo, colors, and app name",
    category: "Whitelabel Management",
  },
  {
    id: "manage_custom_domain",
    name: "Manage Custom Domain",
    description: "Configure custom domains and subdomains",
    category: "Whitelabel Management",
  },
  {
    id: "remove_platform_branding",
    name: "Remove Platform Branding",
    description: "Hide VoiceAI branding from the interface",
    category: "Whitelabel Management",
  },
  
  // User Management
  {
    id: "manage_agency_users",
    name: "Manage Agency Users",
    description: "Add, remove, and edit users in the organization",
    category: "User Management",
  },
  {
    id: "set_user_permissions",
    name: "Set User Permissions",
    description: "Assign permissions and roles to users",
    category: "User Management",
  },
  {
    id: "set_user_limits",
    name: "Set User Limits",
    description: "Configure user-specific resource limits",
    category: "User Management",
  },
  {
    id: "view_user_activity",
    name: "View User Activity",
    description: "Monitor user activity and usage",
    category: "User Management",
  },
  
  // Agent Management
  {
    id: "create_agents",
    name: "Create Agents",
    description: "Create new voice AI agents",
    category: "Agent Configuration",
  },
  {
    id: "configure_agent_limits",
    name: "Configure Agent Limits",
    description: "Set maximum agents per user",
    category: "Agent Configuration",
  },
  {
    id: "manage_agent_templates",
    name: "Manage Agent Templates",
    description: "Create and share agent templates",
    category: "Agent Configuration",
  },
  {
    id: "advanced_agent_settings",
    name: "Advanced Agent Settings",
    description: "Access advanced agent configuration options",
    category: "Agent Configuration",
  },
  
  // Communications
  {
    id: "manage_voices",
    name: "Manage Voices",
    description: "Configure voice settings and preferences",
    category: "Communications",
  },
  {
    id: "manage_phone_numbers",
    name: "Manage Phone Numbers",
    description: "Add and configure phone numbers",
    category: "Communications",
  },
  {
    id: "outbound_calling",
    name: "Outbound Calling",
    description: "Initiate and manage outbound call campaigns",
    category: "Communications",
  },
  {
    id: "access_recordings",
    name: "Access Recordings",
    description: "Listen to and download call recordings",
    category: "Communications",
  },
  {
    id: "use_webrtc_connection",
    name: "Use WebRTC Connection",
    description: "Enable enhanced WebRTC connection in playground",
    category: "Communications",
  },
  
  // Billing & Limits
  {
    id: "view_agency_billing",
    name: "View Agency Billing",
    description: "Access agency billing and usage information",
    category: "Billing & Limits",
  },
  {
    id: "manage_payment_methods",
    name: "Manage Payment Methods",
    description: "Add and update payment methods",
    category: "Billing & Limits",
  },
  {
    id: "configure_usage_limits",
    name: "Configure Usage Limits",
    description: "Set call minutes and storage limits",
    category: "Billing & Limits",
  },
  {
    id: "set_credit_packages",
    name: "Set Credit Packages",
    description: "Configure credit packages for customers",
    category: "Billing & Limits",
  },
  
  // Integrations & API
  {
    id: "enable_integrations",
    name: "Enable Integrations",
    description: "Choose which integrations to enable",
    category: "Integrations & API",
  },
  {
    id: "configure_webhooks",
    name: "Configure Webhooks",
    description: "Set up custom webhooks and callbacks",
    category: "Integrations & API",
  },
  {
    id: "api_access",
    name: "API Access",
    description: "Enable API access for the agency",
    category: "Integrations & API",
  },
  {
    id: "manage_api_keys",
    name: "Manage API Keys",
    description: "Create and manage API keys",
    category: "Integrations & API",
  },
  
  // Analytics & Reporting
  {
    id: "view_analytics",
    name: "View Analytics",
    description: "Access analytics and reporting dashboards",
    category: "Analytics & Reporting",
  },
  {
    id: "export_data",
    name: "Export Data",
    description: "Export call logs and analytics data",
    category: "Analytics & Reporting",
  },
  {
    id: "custom_reports",
    name: "Custom Reports",
    description: "Create and manage custom reports",
    category: "Analytics & Reporting",
  },
];

// Group permissions by category for UI display
export const AGENCY_PERMISSIONS_BY_CATEGORY = AGENCY_PERMISSIONS.reduce((acc, permission) => {
  if (!acc[permission.category]) {
    acc[permission.category] = [];
  }
  acc[permission.category].push(permission);
  return acc;
}, {} as Record<string, AgencyPermission[]>);

// Default permissions for different agency tiers
export const DEFAULT_AGENCY_PERMISSIONS = {
  starter: [
    "manage_branding",
    "manage_agency_users",
    "create_agents",
    "manage_voices",
    "manage_phone_numbers",
    "view_agency_billing",
    "view_analytics",
  ],
  professional: [
    "manage_branding",
    "manage_custom_domain",
    "manage_agency_users",
    "set_user_permissions",
    "set_user_limits",
    "create_agents",
    "configure_agent_limits",
    "manage_agent_templates",
    "manage_voices",
    "manage_phone_numbers",
    "outbound_calling",
    "access_recordings",
    "view_agency_billing",
    "manage_payment_methods",
    "configure_usage_limits",
    "enable_integrations",
    "configure_webhooks",
    "view_analytics",
    "export_data",
  ],
  enterprise: AGENCY_PERMISSIONS.map(p => p.id), // All permissions
  custom: [], // Custom configuration
};