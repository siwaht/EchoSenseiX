import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Shield, Eye, Users, Bot, Phone, Settings,
  Building2, Briefcase, Store, User
} from "lucide-react";

// Available permissions with clear descriptions
export const availablePermissions = [
  // Core Access - Basic viewing rights
  { id: "view_analytics", label: "View Dashboard & Analytics", category: "Core Access", description: "Access to dashboard metrics and analytics data", icon: Eye },
  { id: "view_call_history", label: "View Call History", category: "Core Access", description: "View call logs and conversation history", icon: Phone },

  // Agent Management - Managing AI agents
  { id: "manage_agents", label: "Manage Agents", category: "Agent Management", description: "Create, edit, and delete AI agents", icon: Bot },
  { id: "configure_tools", label: "Configure Agent Tools", category: "Agent Management", description: "Set up and modify agent tools and capabilities", icon: Settings },
  { id: "access_playground", label: "Test Agents", category: "Agent Management", description: "Access playground to test agent interactions", icon: Bot },
  { id: "advanced_agent_settings", label: "Advanced Agent Settings", category: "Agent Management", description: "Access to advanced agent configuration", icon: Settings },

  // Voice & Communications - Phone and voice features
  { id: "manage_voices", label: "Manage Voices", category: "Communications", description: "Configure voice settings and preferences", icon: Phone },
  { id: "manage_phone_numbers", label: "Manage Phone Numbers", category: "Communications", description: "Add and configure phone numbers", icon: Phone },
  { id: "make_outbound_calls", label: "Outbound Calling", category: "Communications", description: "Initiate and manage outbound call campaigns", icon: Phone },
  { id: "access_recordings", label: "Access Recordings", category: "Communications", description: "Listen to and download call recordings", icon: Phone },
  { id: "use_webrtc", label: "Use WebRTC Connection", category: "Communications", description: "Enable enhanced WebRTC connection in playground", icon: Phone },

  // Administration - System management
  { id: "manage_integrations", label: "Manage Integrations", category: "Administration", description: "Configure third-party integrations", icon: Settings },
  { id: "view_billing", label: "View Billing", category: "Administration", description: "Access billing and payment information", icon: Settings },
  { id: "manage_settings", label: "Manage Settings", category: "Administration", description: "Modify organization settings", icon: Settings },
  { id: "manage_users", label: "Manage Users", category: "Administration", description: "Add and manage user accounts", icon: Users },

  // Agency-specific permissions
  { id: "manage_customers", label: "Manage Customers", category: "Agency", description: "Create and manage customer organizations", icon: Store },
  { id: "view_commission_reports", label: "View Commission Reports", category: "Agency", description: "Access commission and revenue reports", icon: Building2 },
  { id: "create_billing_packages", label: "Create Billing Packages", category: "Agency", description: "Create custom billing packages for customers", icon: Briefcase },
  { id: "white_label_settings", label: "White Label Settings", category: "Agency", description: "Configure white-label branding", icon: Building2 },
];

// Organization type specific role templates
// Default permissions for all users
const defaultPermissions = [
  "manage_users",
  "manage_branding",
  "manage_voices",
  "manage_agents",
  "access_playground",
  "view_call_history",
  "manage_phone_numbers"
];

export const roleTemplatesByOrgType = {
  platform_owner: {
    owner: {
      label: "Platform Owner",
      description: "Complete system control and management",
      permissions: availablePermissions.map(p => p.id),
      icon: Shield,
      color: "destructive",
      isDefault: false
    },
    admin: {
      label: "Platform Admin",
      description: "System administration without financial access",
      permissions: availablePermissions.filter(p => p.id !== "view_billing").map(p => p.id),
      icon: Shield,
      color: "destructive",
      isDefault: false
    },
    support: {
      label: "Support Staff",
      description: "Customer support and troubleshooting",
      permissions: ["view_analytics", "view_call_history", "access_playground", "manage_agents", "configure_tools"],
      icon: User,
      color: "secondary",
      isDefault: true
    }
  },
  agency: {
    owner: {
      label: "Agency Owner",
      description: "Full agency control with financial access",
      permissions: [
        "view_analytics", "view_call_history", "manage_customers",
        "view_commission_reports", "create_billing_packages", "white_label_settings",
        "manage_agents", "manage_integrations", "view_billing", "manage_settings", "manage_users",
        "configure_tools", "manage_voices", "manage_phone_numbers", "make_outbound_calls"
      ],
      icon: Building2,
      color: "primary",
      isDefault: false
    },
    admin: {
      label: "Agency Admin",
      description: "Manage customers and agents",
      permissions: [
        "view_analytics", "view_call_history", "manage_customers", "manage_agents",
        "configure_tools", "access_playground", "manage_users", "manage_voices", "manage_phone_numbers"
      ],
      icon: Briefcase,
      color: "primary",
      isDefault: false
    },
    manager: {
      label: "Agency Manager",
      description: "Customer support and agent management",
      permissions: ["view_analytics", "view_call_history", "manage_customers", "access_playground", "manage_agents"],
      icon: Briefcase,
      color: "primary",
      isDefault: true
    },
    staff: {
      label: "Agency Staff",
      description: "Basic customer support",
      permissions: [...defaultPermissions, "view_analytics"],
      icon: User,
      color: "secondary",
      isDefault: false
    }
  },
  end_customer: {
    owner: {
      label: "Account Owner",
      description: "Full control of organization",
      permissions: availablePermissions.filter(p =>
        !["manage_customers", "view_commission_reports", "create_billing_packages", "white_label_settings"].includes(p.id)
      ).map(p => p.id),
      icon: Shield,
      color: "default",
      isDefault: false
    },
    admin: {
      label: "Admin",
      description: "Manage users and settings",
      permissions: [
        "view_analytics", "view_call_history", "manage_agents", "configure_tools",
        "access_playground", "manage_voices", "manage_phone_numbers", "manage_users", "manage_settings"
      ],
      icon: Shield,
      color: "default",
      isDefault: false
    },
    manager: {
      label: "Manager",
      description: "Manage agents and communications",
      permissions: [
        ...defaultPermissions,
        "view_analytics", "configure_tools", "make_outbound_calls"
      ],
      icon: Bot,
      color: "default",
      isDefault: true
    },
    user: {
      label: "User",
      description: "Standard user access",
      permissions: [...defaultPermissions, "view_analytics", "access_recordings"],
      icon: User,
      color: "secondary",
      isDefault: false
    },
    viewer: {
      label: "Viewer",
      description: "Read-only access",
      permissions: ["view_analytics", "view_call_history"],
      icon: Eye,
      color: "secondary",
      isDefault: false
    }
  }
};

// Legacy permission presets for backward compatibility
export const permissionPresets = {
  viewer: roleTemplatesByOrgType.end_customer.viewer,
  user: roleTemplatesByOrgType.end_customer.user,
  agent_manager: roleTemplatesByOrgType.end_customer.manager,
  communications: roleTemplatesByOrgType.end_customer.manager,
  agency_staff: roleTemplatesByOrgType.agency.staff,
  agency_owner: roleTemplatesByOrgType.agency.owner,
  customer_admin: roleTemplatesByOrgType.end_customer.admin,
  full_admin: roleTemplatesByOrgType.platform_owner.owner
};

interface PermissionTemplatesSelectorProps {
  selectedPermissions: string[];
  onPermissionsChange: (permissions: string[]) => void;
  userType?: "regular" | "agency" | "customer";
  organizationType?: "platform_owner" | "agency" | "end_customer";
  showCustomization?: boolean;
  selectedRole?: string;
  onRoleChange?: (role: string) => void;
}

export function PermissionTemplatesSelector({
  selectedPermissions,
  onPermissionsChange,
  userType = "regular",
  organizationType,
  showCustomization = true,
  selectedRole,
  onRoleChange
}: PermissionTemplatesSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(selectedRole || null);
  const [customMode, setCustomMode] = useState(false);

  // Get available role templates based on organization type
  const getAvailableTemplates = () => {
    // Use new organization type if provided, otherwise fall back to legacy userType
    if (organizationType) {
      return roleTemplatesByOrgType[organizationType] || {};
    }
    // Legacy support
    if (userType === "agency") {
      return roleTemplatesByOrgType.agency;
    } else if (userType === "customer") {
      return roleTemplatesByOrgType.end_customer;
    }
    return permissionPresets;
  };

  const templates = getAvailableTemplates() as Record<string, any>;

  const handlePresetSelect = (presetKey: string) => {
    setSelectedPreset(presetKey);
    setCustomMode(false);
    const template = templates[presetKey as keyof typeof templates] || permissionPresets[presetKey as keyof typeof permissionPresets];
    if (template) {
      onPermissionsChange(template.permissions);
      onRoleChange?.(presetKey);
    }
  };

  const handleCustomPermissionToggle = (permissionId: string) => {
    const newPermissions = selectedPermissions.includes(permissionId)
      ? selectedPermissions.filter(p => p !== permissionId)
      : [...selectedPermissions, permissionId];
    onPermissionsChange(newPermissions);
    setCustomMode(true);
    setSelectedPreset(null);
  };

  // Group permissions by category
  const permissionsByCategory = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category]!.push(perm);
    return acc;
  }, {} as Record<string, typeof availablePermissions>);

  return (
    <div className="space-y-6">
      {/* Preset Templates */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Permission Templates</Label>
        <RadioGroup value={selectedPreset || ""} onValueChange={handlePresetSelect}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(templates).map(([presetKey, preset]) => {
              const Icon = preset.icon;
              return (
                <Card
                  key={presetKey}
                  className={`cursor-pointer transition-colors ${selectedPreset === presetKey ? 'border-primary' : ''
                    }`}
                  onClick={() => handlePresetSelect(presetKey)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value={presetKey} id={presetKey} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-4 h-4" />
                          <Label htmlFor={presetKey} className="font-medium cursor-pointer">
                            {preset.label}
                          </Label>
                          <Badge variant={preset.color as any} className="text-xs">
                            {preset.permissions.length} permissions
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </RadioGroup>
      </div>

      {/* Custom Permissions */}
      {showCustomization && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-semibold">Custom Permissions</Label>
            {selectedPreset && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomMode(true);
                  setSelectedPreset(null);
                }}
              >
                Customize Template
              </Button>
            )}
          </div>

          {(customMode || !selectedPreset) && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-6">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="font-medium text-sm mb-3 text-muted-foreground">{category}</h4>
                      <div className="space-y-2">
                        {perms.map(perm => {
                          const Icon = perm.icon;
                          return (
                            <div key={perm.id} className="flex items-start gap-3">
                              <Checkbox
                                id={perm.id}
                                checked={selectedPermissions.includes(perm.id)}
                                onCheckedChange={() => handleCustomPermissionToggle(perm.id)}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-muted-foreground" />
                                  <Label
                                    htmlFor={perm.id}
                                    className="font-medium cursor-pointer"
                                  >
                                    {perm.label}
                                  </Label>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {perm.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Selected Permissions Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Selected Permissions Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPermissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedPermissions.map(permId => {
                const perm = availablePermissions.find(p => p.id === permId);
                return perm ? (
                  <Badge key={permId} variant="secondary" className="text-xs">
                    {perm.label}
                  </Badge>
                ) : null;
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No permissions selected</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}