import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2, Users, Plus, ChevronRight, ChevronDown,
  CreditCard, Briefcase, Store,
  Eye, Edit, Trash2, Percent, Palette, Wand2,
  Power, Ban, AlertTriangle, X
} from "lucide-react";
import type { Organization, User } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { AGENCY_PERMISSIONS_BY_CATEGORY, DEFAULT_AGENCY_PERMISSIONS } from "@shared/constants/agency-permissions";

interface OrganizationWithDetails extends Organization {
  userCount?: number;
  customerCount?: number;
  totalRevenue?: number;
  children?: OrganizationWithDetails[];
  users?: User[];
  isActive?: boolean;
}

export function AgencyManagement() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [createType, setCreateType] = useState<"agency" | "customer">("agency");
  const [selectedOrgForView, setSelectedOrgForView] = useState<OrganizationWithDetails | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<OrganizationWithDetails | null>(null);
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);

  // New agency form state
  const [newAgency, setNewAgency] = useState({
    name: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    commissionRate: "30",
    creditBalance: "0",
    maxAgents: "5",
    maxUsers: "10",
    subdomain: "",
    customDomain: "",
    billingPackage: "starter",
    perCallRate: "0.30",
    perMinuteRate: "0.30",
    monthlyCredits: "0",
    whiteLabel: false,
    notes: "",
  });

  // Track selected permissions
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    DEFAULT_AGENCY_PERMISSIONS.starter
  );

  // Track agent assignments
  const [allAgents, setAllAgents] = useState<any[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  // Fetch organizations with hierarchy
  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
  });

  // Fetch all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Build hierarchical structure
  const buildHierarchy = (): OrganizationWithDetails[] => {
    const orgMap = new Map<string, OrganizationWithDetails>();

    // First pass: create all org objects with user counts
    organizations.forEach(org => {
      const orgUsers = users.filter(u => u.organizationId === org.id);
      const orgWithDetails: OrganizationWithDetails = {
        ...org,
        userCount: orgUsers.length,
        users: orgUsers,
        children: [],
        customerCount: 0,
        totalRevenue: 0,
      };
      orgMap.set(org.id, orgWithDetails);
    });

    // Second pass: build hierarchy
    const roots: OrganizationWithDetails[] = [];
    orgMap.forEach(org => {
      if (org.parentOrganizationId && orgMap.has(org.parentOrganizationId)) {
        const parent = orgMap.get(org.parentOrganizationId)!;
        parent.children = parent.children || [];
        parent.children.push(org);
        parent.customerCount = (parent.customerCount || 0) + 1;
      } else if (org.organizationType === 'agency' || !org.parentOrganizationId) {
        roots.push(org);
      }
    });

    // Sort by type (agencies first) then by name
    roots.sort((a, b) => {
      if (a.organizationType === 'agency' && b.organizationType !== 'agency') return -1;
      if (a.organizationType !== 'agency' && b.organizationType === 'agency') return 1;
      return a.name.localeCompare(b.name);
    });

    return roots;
  };

  const hierarchicalOrgs = buildHierarchy();

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/organizations/${orgId}`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete organization");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Organization Deleted",
        description: "The organization has been successfully deleted.",
      });
      setShowDeleteDialog(false);
      setOrgToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete organization",
        variant: "destructive",
      });
    },
  });

  // Toggle organization status mutation
  const toggleOrgStatusMutation = useMutation({
    mutationFn: async ({ orgId, isActive }: { orgId: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/organizations/${orgId}/status`, {
        isActive,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: variables.isActive ? "Organization Enabled" : "Organization Disabled",
        description: `The organization has been ${variables.isActive ? "enabled" : "disabled"}.`,
      });
    },
    onError: () => {
      toast({
        title: "Status Update Failed",
        description: "Failed to update organization status",
        variant: "destructive",
      });
    },
  });

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async ({ orgId, updates }: { orgId: string; updates: Partial<Organization> }) => {
      return await apiRequest("PATCH", `/api/admin/organizations/${orgId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Settings Updated",
        description: "Organization settings have been saved successfully.",
      });
      setShowSettingsDialog(false);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update organization settings",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Deleted",
        description: "The user has been successfully removed.",
      });
      // Refresh the organization details to update user count
      if (selectedOrgForView) {
        const updatedOrg = hierarchicalOrgs.find(org => org.id === selectedOrgForView.id);
        if (updatedOrg) {
          setSelectedOrgForView(updatedOrg);
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Create agency mutation
  const createAgencyMutation = useMutation({
    mutationFn: async (data: typeof newAgency & { permissions?: string[], parentOrganizationId?: string }) => {
      // Create the organization and admin user in one request
      return await apiRequest("POST", "/api/admin/users", {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        companyName: data.name,
        organizationType: createType === "agency" ? "agency" : "end_customer",
        commissionRate: createType === "agency" ? parseFloat(data.commissionRate) : undefined,
        creditBalance: createType === "agency" ? parseFloat(data.creditBalance) : undefined,
        billingPackage: createType === "agency" ? data.billingPackage : undefined,
        perCallRate: createType === "agency" ? parseFloat(data.perCallRate) : undefined,
        perMinuteRate: createType === "agency" ? parseFloat(data.perMinuteRate) : undefined,
        monthlyCredits: createType === "agency" ? parseInt(data.monthlyCredits) : undefined,
        maxAgents: parseInt(data.maxAgents),
        maxUsers: parseInt(data.maxUsers),
        subdomain: createType === "agency" ? data.subdomain : undefined,
        customDomain: createType === "agency" ? data.customDomain : undefined,
        permissions: createType === "agency" ? data.permissions : [],
        isAdmin: false, // Agency owners are not system admins
        role: createType === "agency" ? "agency" : "user",
        parentOrganizationId: data.parentOrganizationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
      toast({
        title: `${createType === "agency" ? "Agency" : "Customer"} created successfully`,
        description: `Login credentials have been set for the admin user.`
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Creation failed",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    },
  });

  const resetForm = () => {
    setNewAgency({
      name: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      commissionRate: "30",
      creditBalance: "0",
      maxAgents: "5",
      maxUsers: "10",
      subdomain: "",
      customDomain: "",
      billingPackage: "starter",
      perCallRate: "0.30",
      perMinuteRate: "0.30",
      monthlyCredits: "0",
      whiteLabel: false,
      notes: "",
    });
    setSelectedPermissions(DEFAULT_AGENCY_PERMISSIONS.starter);
    setSelectedAgency(null);
    setCreateType("agency");
  };

  const toggleExpanded = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const renderOrganization = (org: OrganizationWithDetails, level: number = 0) => {
    const isExpanded = expandedOrgs.has(org.id);
    const hasChildren = org.children && org.children.length > 0;
    const isAgency = org.organizationType === 'agency';

    return (
      <div key={org.id} className={`${level > 0 ? 'ml-8' : ''}`}>
        <Card className={`mb-3 ${isAgency ? 'border-primary/50 bg-primary/5' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Expand/Collapse button */}
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(org.id)}
                    className="p-1 h-auto flex-shrink-0 mt-1"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                )}
                {!hasChildren && <div className="w-6 flex-shrink-0" />}

                {/* Organization icon */}
                <div className="flex-shrink-0 mt-1">
                  {isAgency ? (
                    <Briefcase className="w-5 h-5 text-primary" />
                  ) : (
                    <Store className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {/* Organization details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="font-semibold truncate">{org.name}</span>
                    <Badge variant={isAgency ? "default" : "secondary"} className="text-xs">
                      {isAgency ? "Agency" : "Customer"}
                    </Badge>
                    {org.billingPackage && (
                      <Badge variant="outline" className="text-xs">
                        {org.billingPackage}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Users className="w-3 h-3 flex-shrink-0" />
                      <span>{org.userCount || 0} users</span>
                    </span>
                    {isAgency && (
                      <>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Store className="w-3 h-3 flex-shrink-0" />
                          <span>{org.customerCount || 0} customers</span>
                        </span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Percent className="w-3 h-3 flex-shrink-0" />
                          <span>{org.commissionRate || 30}% commission</span>
                        </span>
                      </>
                    )}
                    {org.creditBalance && Number(org.creditBalance) > 0 && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <CreditCard className="w-3 h-3 flex-shrink-0" />
                        <span>${org.creditBalance} credits</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAgency && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAgency(org.id);
                        setCreateType("customer");
                        setShowCreateDialog(true);
                      }}
                      className="whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Add Customer</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Whitelabel Settings"
                      onClick={() => setLocation("/whitelabel-settings")}
                      className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 hover:from-purple-500/20 hover:to-purple-600/20 border-purple-500/20"
                    >
                      <Palette className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">Whitelabel</span>
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  title="View Details"
                  onClick={() => {
                    setSelectedOrgForView(org);
                    setShowViewDialog(true);
                  }}
                >
                  <Eye className="w-4 h-4" />
                  <span className="sr-only">View</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Edit Settings"
                  onClick={() => {
                    setSelectedOrgForView(org);
                    setShowSettingsDialog(true);
                  }}
                >
                  <Edit className="w-4 h-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title={org.billingStatus === 'active' ? "Disable Organization" : "Enable Organization"}
                  onClick={() => {
                    toggleOrgStatusMutation.mutate({
                      orgId: org.id,
                      isActive: org.billingStatus !== 'active'
                    });
                  }}
                >
                  {org.billingStatus === 'active' ? (
                    <Ban className="w-4 h-4 text-orange-500" />
                  ) : (
                    <Power className="w-4 h-4 text-green-500" />
                  )}
                  <span className="sr-only">{org.billingStatus === 'active' ? "Disable" : "Enable"}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Delete Organization"
                  onClick={() => {
                    setOrgToDelete(org);
                    setShowDeleteDialog(true);
                  }}
                  className="hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </div>

            {/* Show users if expanded */}
            {isExpanded && org.users && org.users.length > 0 && (
              <div className="mt-4 pl-9 border-t pt-3">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Team Members</div>
                <div className="space-y-2">
                  {org.users.map(user => (
                    <div key={user.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span>{user.firstName} {user.lastName}</span>
                        <span className="text-muted-foreground">({user.email})</span>
                        {user.isAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                        {user.role === 'agency' && <Badge variant="outline" className="text-xs">Agency Owner</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Render children */}
        {isExpanded && hasChildren && (
          <div className="mt-2">
            {org.children!.map(child => renderOrganization(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="h-20 bg-muted animate-pulse rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Agency & Organization Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage agencies, their customers, and commission structures
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await apiRequest("POST", "/api/admin/create-test-agency", {});
                const data = await response.json();
                queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
                queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
                toast({
                  title: "Test Agency Created!",
                  description: (
                    <div className="space-y-2">
                      <p>Login credentials:</p>
                      <div className="bg-muted p-2 rounded text-sm font-mono">
                        Email: {data.owner.email}<br />
                        Password: {data.owner.password}
                      </div>
                      <p className="text-xs">Use these to test whitelabel features</p>
                    </div>
                  ),
                });
              } catch (error) {
                toast({
                  title: "Failed to create test agency",
                  variant: "destructive",
                });
              }
            }}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Create Test Agency
          </Button>
          <Button
            onClick={() => {
              setCreateType("agency");
              setSelectedAgency(null);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Agency
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Agencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.organizationType === 'agency').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.organizationType === 'end_customer').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Direct Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.organizationType === 'end_customer' && !o.parentOrganizationId).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Hierarchy */}
      <div className="space-y-2">
        {hierarchicalOrgs.map(org => renderOrganization(org))}

        {hierarchicalOrgs.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No organizations yet</p>
              <p className="text-sm">Create your first agency to get started with the partner program</p>
            </div>
          </Card>
        )}
      </div>

      {/* Create Agency/Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {createType === "agency" ? "Create New Agency" : "Create New Customer"}
            </DialogTitle>
            <DialogDescription>
              {createType === "agency"
                ? "Set up a new agency partner with their own customers and commission structure"
                : `Add a new customer ${selectedAgency ? "under the selected agency" : "as a direct customer"}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1 py-4">
            <div className="grid gap-4 pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">
                    {createType === "agency" ? "Agency Name" : "Company Name"}
                  </Label>
                  <Input
                    id="name"
                    value={newAgency.name}
                    onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
                    placeholder={createType === "agency" ? "Acme Partners" : "Customer Corp"}
                  />
                </div>
                {createType === "agency" && (
                  <div>
                    <Label htmlFor="commission">Commission Rate (%)</Label>
                    <Input
                      id="commission"
                      type="number"
                      value={newAgency.commissionRate}
                      onChange={(e) => setNewAgency({ ...newAgency, commissionRate: e.target.value })}
                      placeholder="30"
                      min="0"
                      max="100"
                    />
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Admin User Account</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={newAgency.firstName}
                      onChange={(e) => setNewAgency({ ...newAgency, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={newAgency.lastName}
                      onChange={(e) => setNewAgency({ ...newAgency, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newAgency.email}
                      onChange={(e) => setNewAgency({ ...newAgency, email: e.target.value })}
                      placeholder="admin@agency.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newAgency.password}
                      onChange={(e) => setNewAgency({ ...newAgency, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              {createType === "agency" && (
                <>
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Branding & Domain</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="whiteLabel">White Label Mode</Label>
                          <p className="text-sm text-muted-foreground">
                            Hide platform branding for this agency's customers
                          </p>
                        </div>
                        <Switch
                          id="whiteLabel"
                          checked={newAgency.whiteLabel}
                          onCheckedChange={(checked) => setNewAgency({ ...newAgency, whiteLabel: checked })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="subdomain">Subdomain</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="subdomain"
                              value={newAgency.subdomain}
                              onChange={(e) => setNewAgency({ ...newAgency, subdomain: e.target.value })}
                              placeholder="agency-name"
                            />
                            <span className="text-sm text-muted-foreground">.voiceai.com</span>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
                          <Input
                            id="customDomain"
                            value={newAgency.customDomain}
                            onChange={(e) => setNewAgency({ ...newAgency, customDomain: e.target.value })}
                            placeholder="dashboard.agency.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Billing & Pricing</h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="billingPackage">Billing Package</Label>
                          <Select
                            value={newAgency.billingPackage}
                            onValueChange={(value) => {
                              setNewAgency({ ...newAgency, billingPackage: value });
                              // Auto-update permissions based on package
                              if (value === 'starter') {
                                setSelectedPermissions(DEFAULT_AGENCY_PERMISSIONS.starter);
                              } else if (value === 'professional') {
                                setSelectedPermissions(DEFAULT_AGENCY_PERMISSIONS.professional);
                              } else if (value === 'enterprise') {
                                setSelectedPermissions(DEFAULT_AGENCY_PERMISSIONS.enterprise);
                              }
                              // Custom keeps current selection
                            }}
                          >
                            <SelectTrigger id="billingPackage">
                              <SelectValue placeholder="Select package" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="starter">Starter</SelectItem>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="enterprise">Enterprise</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="monthlyCredits">Monthly Credits</Label>
                          <Input
                            id="monthlyCredits"
                            type="number"
                            value={newAgency.monthlyCredits}
                            onChange={(e) => setNewAgency({ ...newAgency, monthlyCredits: e.target.value })}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor="perCallRate">Per Call Rate ($)</Label>
                          <Input
                            id="perCallRate"
                            type="number"
                            step="0.01"
                            value={newAgency.perCallRate}
                            onChange={(e) => setNewAgency({ ...newAgency, perCallRate: e.target.value })}
                            placeholder="0.30"
                            min="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor="perMinuteRate">Per Minute Rate ($)</Label>
                          <Input
                            id="perMinuteRate"
                            type="number"
                            step="0.01"
                            value={newAgency.perMinuteRate}
                            onChange={(e) => setNewAgency({ ...newAgency, perMinuteRate: e.target.value })}
                            placeholder="0.30"
                            min="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor="creditBalance">Initial Credit Balance ($)</Label>
                          <Input
                            id="creditBalance"
                            type="number"
                            value={newAgency.creditBalance}
                            onChange={(e) => setNewAgency({ ...newAgency, creditBalance: e.target.value })}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Resource Limits</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="maxAgents">Max Agents</Label>
                        <Input
                          id="maxAgents"
                          type="number"
                          value={newAgency.maxAgents}
                          onChange={(e) => setNewAgency({ ...newAgency, maxAgents: e.target.value })}
                          placeholder="5"
                          min="1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxUsers">Max Users</Label>
                        <Input
                          id="maxUsers"
                          type="number"
                          value={newAgency.maxUsers}
                          onChange={(e) => setNewAgency({ ...newAgency, maxUsers: e.target.value })}
                          placeholder="10"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Agency Permissions</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Permissions are auto-selected based on billing package. Choose Custom package to manually configure.
                    </p>
                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                      {Object.entries(AGENCY_PERMISSIONS_BY_CATEGORY).map(([category, permissions]) => (
                        <div key={category} className="space-y-2">
                          <h5 className="text-sm font-medium text-muted-foreground">{category}</h5>
                          <div className="space-y-2">
                            {permissions.map((permission) => (
                              <div key={permission.id} className="flex items-start space-x-2">
                                <Checkbox
                                  id={permission.id}
                                  checked={selectedPermissions.includes(permission.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedPermissions([...selectedPermissions, permission.id]);
                                    } else {
                                      setSelectedPermissions(selectedPermissions.filter(p => p !== permission.id));
                                    }
                                    // If user manually changes permissions, switch to custom package
                                    if (newAgency.billingPackage !== 'custom') {
                                      setNewAgency({ ...newAgency, billingPackage: 'custom' });
                                    }
                                  }}
                                  disabled={newAgency.billingPackage !== 'custom'}
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={permission.id}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {permission.name}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">{permission.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={newAgency.notes}
                  onChange={(e) => setNewAgency({ ...newAgency, notes: e.target.value })}
                  placeholder="Any additional notes or information..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createAgencyMutation.mutate({
                ...newAgency,
                permissions: selectedPermissions,
                parentOrganizationId: selectedAgency || undefined
              })}
              disabled={!newAgency.name || !newAgency.email || !newAgency.password}
            >
              Create {createType === "agency" ? "Agency" : "Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Organization Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              Organization Details: {selectedOrgForView?.name}
            </DialogTitle>
            <DialogDescription>
              View detailed information about this organization
            </DialogDescription>
          </DialogHeader>

          {selectedOrgForView && (
            <div className="flex-1 overflow-y-auto px-1 py-4">
              <div className="space-y-4 pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Organization Type</Label>
                    <p className="font-medium">
                      {selectedOrgForView.organizationType === 'agency' ? 'Agency' :
                        selectedOrgForView.organizationType === 'platform_owner' ? 'Platform Owner' : 'End Customer'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Billing Package</Label>
                    <p className="font-medium">{selectedOrgForView.billingPackage || 'Starter'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Total Users</Label>
                    <p className="font-medium">{selectedOrgForView.userCount || 0}</p>
                  </div>
                  {selectedOrgForView.organizationType === 'agency' && (
                    <>
                      <div>
                        <Label className="text-sm text-muted-foreground">Total Customers</Label>
                        <p className="font-medium">{selectedOrgForView.customerCount || 0}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Commission Rate</Label>
                        <p className="font-medium">{selectedOrgForView.commissionRate || 30}%</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Credit Balance</Label>
                        <p className="font-medium">${selectedOrgForView.creditBalance || 0}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-sm text-muted-foreground">Max Agents</Label>
                    <p className="font-medium">{selectedOrgForView.maxAgents || 5}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Max Users</Label>
                    <p className="font-medium">{selectedOrgForView.maxUsers || 10}</p>
                  </div>
                </div>

                {selectedOrgForView.users && selectedOrgForView.users.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Team Members ({selectedOrgForView.users.length})</h4>
                      {selectedOrgForView.users.length > 0 && (
                        <p className="text-xs text-muted-foreground">Remove all users before deleting organization</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {selectedOrgForView.users.map(user => (
                        <div key={user.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded group hover:bg-muted/70 transition-colors">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{user.firstName} {user.lastName}</span>
                            <span className="text-muted-foreground">({user.email})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {user.isAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                            {user.role === 'agency' && <Badge variant="outline" className="text-xs">Agency Owner</Badge>}
                            <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {user.status || 'active'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
                                  deleteUserMutation.mutate(user.id);
                                }
                              }}
                              disabled={deleteUserMutation.isPending}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={showSettingsDialog}
        onOpenChange={async (open) => {
          setShowSettingsDialog(open);
          if (!open) {
            setAdminPassword("");
            setEditingPermissions([]);
            setSelectedAgentIds([]);
          } else if (open && selectedOrgForView) {
            // Load current permissions for the agency
            if (selectedOrgForView.organizationType === 'agency') {
              setEditingPermissions(selectedOrgForView.agencyPermissions || []);
            }

            // Fetch all agents and current assignments
            try {
              const [agentsResponse, assignedResponse] = await Promise.all([
                apiRequest("GET", "/api/admin/agents"),
                apiRequest("GET", `/api/admin/organizations/${selectedOrgForView.id}/agents`)
              ]);

              const agentsData = await agentsResponse.json();
              const assignedIds = await assignedResponse.json();

              setAllAgents(agentsData || []);
              setSelectedAgentIds(assignedIds || []);
            } catch (error) {
              console.error("Error fetching agents:", error);
              setAllAgents([]);
              setSelectedAgentIds([]);
            }
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              Settings: {selectedOrgForView?.name}
            </DialogTitle>
            <DialogDescription>
              Configure organization settings and preferences
            </DialogDescription>
          </DialogHeader>

          {selectedOrgForView && (
            <div className="flex-1 overflow-y-auto px-1 py-4">
              <div className="space-y-4 pr-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input id="org-name" defaultValue={selectedOrgForView.name} />
                </div>

                {selectedOrgForView.organizationType === 'agency' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="commission-rate">Commission Rate (%)</Label>
                      <Input
                        id="commission-rate"
                        type="number"
                        defaultValue={selectedOrgForView.commissionRate || 30}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="credit-balance">Credit Balance ($)</Label>
                      <Input
                        id="credit-balance"
                        type="number"
                        defaultValue={selectedOrgForView.creditBalance || 0}
                        min="0"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="max-agents">Max Agents</Label>
                  <Input
                    id="max-agents"
                    type="number"
                    defaultValue={selectedOrgForView.maxAgents || 5}
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-users">Max Users</Label>
                  <Input
                    id="max-users"
                    type="number"
                    defaultValue={selectedOrgForView.maxUsers || 10}
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing-package">Billing Package</Label>
                  <Select defaultValue={selectedOrgForView.billingPackage || 'starter'}>
                    <SelectTrigger id="billing-package">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Permissions Section - Only for Agencies */}
                {selectedOrgForView.organizationType === 'agency' && (
                  <div className="col-span-full space-y-4 border-t pt-4">
                    <div>
                      <Label className="text-base font-semibold">Agency Permissions</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configure what features and capabilities this agency has access to
                      </p>
                    </div>

                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                      {Object.entries(AGENCY_PERMISSIONS_BY_CATEGORY).map(([category, permissions]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="font-medium text-sm text-muted-foreground">{category}</h4>
                          <div className="space-y-2">
                            {permissions.map((permission) => (
                              <div key={permission.id} className="flex items-start space-x-2">
                                <Checkbox
                                  id={`edit-perm-${permission.id}`}
                                  checked={editingPermissions.includes(permission.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setEditingPermissions([...editingPermissions, permission.id]);
                                    } else {
                                      setEditingPermissions(editingPermissions.filter(p => p !== permission.id));
                                    }
                                  }}
                                />
                                <div className="space-y-0.5">
                                  <Label
                                    htmlFor={`edit-perm-${permission.id}`}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {permission.name}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Select all permissions
                          const allPermissions = Object.values(AGENCY_PERMISSIONS_BY_CATEGORY)
                            .flat()
                            .map(p => p.id);
                          setEditingPermissions(allPermissions);
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPermissions([])}
                      >
                        Clear All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPermissions(DEFAULT_AGENCY_PERMISSIONS.professional)}
                      >
                        Use Professional Defaults
                      </Button>
                    </div>
                  </div>
                )}

                {/* Agent Assignment Section - Only for Agencies */}
                {selectedOrgForView.organizationType === 'agency' && (
                  <div className="col-span-full space-y-4 border-t pt-4">
                    <div>
                      <Label className="text-base font-semibold">Assigned Agents</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select which AI agents belong to this agency
                      </p>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {allAgents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No agents available</p>
                      ) : (
                        allAgents.map((agent) => (
                          <div key={agent.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={`agent-${agent.id}`}
                              checked={selectedAgentIds.includes(agent.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedAgentIds([...selectedAgentIds, agent.id]);
                                } else {
                                  setSelectedAgentIds(selectedAgentIds.filter(id => id !== agent.id));
                                }
                              }}
                            />
                            <div className="space-y-0.5 flex-1">
                              <Label
                                htmlFor={`agent-${agent.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {agent.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {agent.description || 'No description'}
                              </p>
                              {agent.organizationName && agent.organizationName !== selectedOrgForView.name && (
                                <p className="text-xs text-orange-600 dark:text-orange-400">
                                  Currently assigned to: {agent.organizationName}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Select all agents
                          setSelectedAgentIds(allAgents.map(a => a.id));
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedAgentIds([])}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                )}

                <div className="col-span-full space-y-2">
                  <Label htmlFor="admin-password">New Password (leave blank to keep current)</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Enter new password or leave blank"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Reset the admin user's password for this organization
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedOrgForView) return;

                // Get form values
                const nameInput = document.getElementById('org-name') as HTMLInputElement;
                const commissionInput = document.getElementById('commission-rate') as HTMLInputElement;
                const creditInput = document.getElementById('credit-balance') as HTMLInputElement;
                const maxAgentsInput = document.getElementById('max-agents') as HTMLInputElement;
                const maxUsersInput = document.getElementById('max-users') as HTMLInputElement;
                const billingSelect = document.querySelector('[id="billing-package"]') as HTMLElement;

                const updates: any = {
                  name: nameInput?.value,
                  maxAgents: parseInt(maxAgentsInput?.value || '5'),
                  maxUsers: parseInt(maxUsersInput?.value || '10'),
                  billingPackage: billingSelect?.getAttribute('data-value') || 'starter',
                };

                if (selectedOrgForView.organizationType === 'agency') {
                  updates.commissionRate = parseFloat(commissionInput?.value || '30');
                  updates.creditBalance = parseFloat(creditInput?.value || '0');
                  updates.agencyPermissions = editingPermissions;
                }

                // If password is provided, update it for the first user in the organization
                if (adminPassword) {
                  // Find the first user for this organization (typically the admin/owner)
                  const orgUsers = users.filter(u => u.organizationId === selectedOrgForView.id);
                  const primaryUser = orgUsers.find(u => u.role === 'agency' || u.isAdmin) || orgUsers[0];

                  if (primaryUser) {
                    try {
                      await apiRequest("PATCH", `/api/admin/users/${primaryUser.id}`, {
                        password: adminPassword
                      });
                      toast({
                        title: "Password Updated",
                        description: `Password has been reset for ${primaryUser.email}`,
                      });
                      setAdminPassword("");
                    } catch (error) {
                      toast({
                        title: "Password Update Failed",
                        description: "Failed to reset password",
                        variant: "destructive",
                      });
                      return;
                    }
                  } else {
                    toast({
                      title: "No User Found",
                      description: "No user found for this organization",
                      variant: "destructive",
                    });
                    return;
                  }
                }

                // Handle agent reassignments if this is an agency
                if (selectedOrgForView.organizationType === 'agency') {
                  try {
                    // Get current agent assignments for comparison
                    const currentAssignmentsResponse = await apiRequest("GET", `/api/admin/organizations/${selectedOrgForView.id}/agents`);
                    const currentAssignments = await currentAssignmentsResponse.json();

                    // Find agents to reassign (newly selected)
                    const agentsToAssign = selectedAgentIds.filter(id => !currentAssignments.includes(id));

                    // Reassign each agent to this organization
                    for (const agentId of agentsToAssign) {
                      await apiRequest("POST", `/api/admin/agents/${agentId}/reassign`, {
                        organizationId: selectedOrgForView.id
                      });
                    }

                    if (agentsToAssign.length > 0) {
                      toast({
                        title: "Agents Reassigned",
                        description: `${agentsToAssign.length} agent(s) have been assigned to ${selectedOrgForView.name}`,
                      });
                    }
                  } catch (error) {
                    console.error("Error reassigning agents:", error);
                    toast({
                      title: "Agent Assignment Failed",
                      description: "Failed to reassign some agents",
                      variant: "destructive",
                    });
                  }
                }

                updateOrgMutation.mutate({
                  orgId: selectedOrgForView.id,
                  updates
                });
              }}
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{orgToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          {orgToDelete && (
            <div className="space-y-4">
              {orgToDelete.userCount && orgToDelete.userCount > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                  <p className="text-sm text-destructive">
                    <strong>Warning:</strong> This organization has {orgToDelete.userCount} user(s).
                    You must remove all users before deleting the organization.
                  </p>
                </div>
              )}

              {orgToDelete.organizationType === 'agency' && orgToDelete.customerCount && orgToDelete.customerCount > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded p-3">
                  <p className="text-sm text-orange-700 dark:text-orange-400">
                    <strong>Note:</strong> This agency has {orgToDelete.customerCount} customer(s).
                    Consider reassigning them before deletion.
                  </p>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                This action cannot be undone. All data associated with this organization will be permanently deleted.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setOrgToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (orgToDelete) {
                  deleteOrgMutation.mutate(orgToDelete.id);
                }
              }}
              disabled={deleteOrgMutation.isPending || !!(orgToDelete?.userCount && orgToDelete.userCount > 0)}
            >
              {deleteOrgMutation.isPending ? "Deleting..." : "Delete Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}