import { useState, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users, Building2, DollarSign, Phone, Edit, Trash2, Plus, Shield,
  Activity, TrendingUp, CreditCard, Settings,
  Eye, Wallet, Briefcase
} from "lucide-react";
import type { User, Organization, BillingPackage } from "@shared/schema";

// Lazy load admin components to reduce initial bundle size
const UserManagementPage = lazy(() => import("./user-management").then(module => ({ default: module.UserManagementPage })));
const PaymentAnalytics = lazy(() => import("@/components/admin/payment-analytics").then(module => ({ default: module.PaymentAnalytics })));
const PaymentHistory = lazy(() => import("@/components/admin/payment-history").then(module => ({ default: module.PaymentHistory })));
const AgencyManagement = lazy(() => import("@/components/admin/agency-management").then(module => ({ default: module.AgencyManagement })));
const AgencyPermissions = lazy(() => import("@/components/admin/agency-permissions").then(module => ({ default: module.AgencyPermissions })));

// Loading component for lazy-loaded sections
function AdminSectionLoader() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
    </div>
  );
}

interface BillingData {
  totalUsers: number;
  totalOrganizations: number;
  totalCalls: number;
  totalRevenue: number;
  organizationsData: Array<{
    id: string;
    name: string;
    userCount: number;
    agentCount: number;
    totalCalls: number;
    totalMinutes: number;
    estimatedCost: number;
    billingPackage?: string;
    perCallRate?: number;
    perMinuteRate?: number;
    monthlyCredits?: number;
    usedCredits?: number;
  }>;
}

export default function AdminDashboard() {
  const { toast } = useToast();

  // State management
  // const [, setEditingUser] = useState<User | null>(null);
  // const [, setDeletingUser] = useState<User | null>(null);
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [, setEditingPackage] = useState<BillingPackage | null>(null);
  const [, setDeletingPackage] = useState<BillingPackage | null>(null);
  // const [, setConnectingStripe] = useState(false);
  // const [, setConnectingPayPal] = useState(false);
  // const [, setStripeKeys] = useState({ publishableKey: '', secretKey: '' });
  // const [, setPaypalKeys] = useState({ clientId: '', clientSecret: '' });
  const [newPackage, setNewPackage] = useState({
    id: "",
    name: "",
    displayName: "",
    perCallRate: "0.30",
    perMinuteRate: "0.30",
    monthlyCredits: "0",
    maxAgents: "5",
    maxUsers: "10",
    monthlyPrice: "0",
    features: [] as string[],
    availableToType: "end_customer" as "agency" | "end_customer",
    baseCost: "0",
    marginPercentage: "30",
  });
  const [editingOrg, setEditingOrg] = useState<{
    id: string;
    name: string;
    billingPackage: string;
    perCallRate: string;
    perMinuteRate: string;
    monthlyCredits: string;
    maxAgents: string;
    maxUsers: string;
    customRateEnabled: boolean;
    userCount?: number;
    totalCalls?: number;
    usedCredits?: number;
    estimatedCost?: number;
  } | null>(null);
  const [managingPermissionsOrg, setManagingPermissionsOrg] = useState<{
    id: string;
    name: string;
    organizationType?: string;
    billingPackage?: string;
  } | null>(null);
  // const [creatingUser, setCreatingUser] = useState(false);
  /* const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    companyName: "",
    isAdmin: false,
    userType: "regular" as "regular" | "agency",
    commissionRate: "30",
  }); */

  // Queries
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
  });

  const { data: billingData } = useQuery<BillingData>({
    queryKey: ["/api/admin/billing"],
  });

  const { data: billingPackages = [] } = useQuery<BillingPackage[]>({
    queryKey: ["/api/admin/billing-packages"],
  });

  // Fetch payment transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payments"],
  });

  // Create user mutation
  /* const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      return await apiRequest("POST", "/api/admin/users", {
        ...userData,
        organizationType: userData.userType === "agency" ? "agency" : "end_customer",
        commissionRate: userData.userType === "agency" ? parseFloat(userData.commissionRate) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "User created successfully" });
      setCreatingUser(false);
      setNewUser({
        email: "",
        firstName: "",
        lastName: "",
        password: "",
        companyName: "",
        isAdmin: false,
        userType: "regular",
        commissionRate: "30",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create user",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    },
  }); */

  // Update user mutation
  /* const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<User> }) => {
      return await apiRequest("PATCH", `/api/admin/users/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
      setEditingUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  }); */

  // Delete user mutation
  /* const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
      toast({ title: "User deleted successfully" });
      setDeletingUser(null);
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  }); */

  // Create billing package mutation
  const createPackageMutation = useMutation({
    mutationFn: async (packageData: typeof newPackage) => {
      return await apiRequest("POST", "/api/admin/billing-packages", {
        ...packageData,
        perCallRate: parseFloat(packageData.perCallRate) || 0,
        perMinuteRate: parseFloat(packageData.perMinuteRate) || 0,
        monthlyCredits: parseInt(packageData.monthlyCredits) || 0,
        maxAgents: parseInt(packageData.maxAgents) || 0,
        maxUsers: parseInt(packageData.maxUsers) || 0,
        monthlyPrice: parseFloat(packageData.monthlyPrice) || 0,
        features: packageData.features || [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-packages"] });
      toast({ title: "Billing package created successfully" });
      setCreatingPackage(false);
      setNewPackage({
        id: "",
        name: "",
        displayName: "",
        perCallRate: "0.30",
        perMinuteRate: "0.30",
        monthlyCredits: "0",
        maxAgents: "5",
        maxUsers: "10",
        monthlyPrice: "0",
        features: [],
        availableToType: "end_customer" as "agency" | "end_customer",
        baseCost: "0",
        marginPercentage: "30",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create billing package",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    },
  });

  // Update billing package mutation
  // const updatePackageMutation = useMutation({
  //   mutationFn: async (data: { id: string; updates: Partial<BillingPackage> }) => {
  //     return await apiRequest("PATCH", `/api/admin/billing-packages/${data.id}`, data.updates);
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-packages"] });
  //     toast({ title: "Billing package updated successfully" });
  //     setEditingPackage(null);
  //   },
  //   onError: () => {
  //     toast({ title: "Failed to update billing package", variant: "destructive" });
  //   },
  // });

  // Delete billing package mutation
  // const deletePackageMutation = useMutation({
  //   mutationFn: async (packageId: string) => {
  //     return await apiRequest("DELETE", `/api/admin/billing-packages/${packageId}`);
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["/api/admin/billing-packages"] });
  //     toast({ title: "Billing package deleted successfully" });
  //     setDeletingPackage(null);
  //   },
  //   onError: () => {
  //     toast({ title: "Failed to delete billing package", variant: "destructive" });
  //   },
  // });

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Organization> }) => {
      return await apiRequest("PATCH", `/api/admin/organizations/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
      toast({ title: "Organization billing updated successfully" });
      setEditingOrg(null);
    },
    onError: () => {
      toast({ title: "Failed to update organization", variant: "destructive" });
    },
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage users, organizations, and billing</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 border-blue-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 flex-shrink-0">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Total Users</p>
              <p className="text-2xl font-bold truncate">{billingData?.totalUsers || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-500/20 dark:to-green-600/20 border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20 flex-shrink-0">
              <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Organizations</p>
              <p className="text-2xl font-bold truncate">{billingData?.totalOrganizations || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-500/20 dark:to-purple-600/20 border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 flex-shrink-0">
              <Phone className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Total Calls</p>
              <p className="text-2xl font-bold truncate">{billingData?.totalCalls || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 dark:from-amber-500/20 dark:to-amber-600/20 border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 flex-shrink-0">
              <DollarSign className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Total Revenue</p>
              <p className="text-2xl font-bold truncate">${billingData?.totalRevenue?.toFixed(2) || "0.00"}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="agencies" className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 h-auto gap-2">
          <TabsTrigger value="agencies" className="flex items-center justify-center gap-1 px-3 py-2">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline text-xs lg:text-sm">Agencies</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center justify-center gap-1 px-3 py-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline text-xs lg:text-sm">Users</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center justify-center gap-1 px-3 py-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline text-xs lg:text-sm">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex items-center justify-center gap-1 px-3 py-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline text-xs lg:text-sm">Orgs</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center justify-center gap-1 px-3 py-2">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline text-xs lg:text-sm">Payments</span>
          </TabsTrigger>
        </TabsList>

        {/* Agencies Tab */}
        <TabsContent value="agencies" className="space-y-4">
          <Suspense fallback={<AdminSectionLoader />}>
            <AgencyManagement />
          </Suspense>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Suspense fallback={<AdminSectionLoader />}>
            <UserManagementPage />
          </Suspense>
        </TabsContent>

        {/* Billing & Packages Tab */}
        <TabsContent value="billing" className="space-y-4 sm:space-y-6">
          <Card className="p-3 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Organization Billing Settings</h2>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">Organization</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Package</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Per Call</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Per Min</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Credits</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Used</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billingData?.organizationsData.map((org) => {
                    return (
                      <tr key={org.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <span className="font-medium text-sm truncate block max-w-[150px]">{org.name}</span>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className="text-xs">{org.billingPackage || 'Starter'}</Badge>
                        </td>
                        <td className="py-3 px-2 text-sm">${org.perCallRate || '0.30'}</td>
                        <td className="py-3 px-2 text-sm">${org.perMinuteRate || '0.30'}</td>
                        <td className="py-3 px-2 text-sm">{org.monthlyCredits || 0}</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{org.usedCredits || 0}</span>
                            {org.monthlyCredits && org.monthlyCredits > 0 && (
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden hidden lg:block">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${Math.min(100, ((org.usedCredits || 0) / org.monthlyCredits) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const orgDetails = organizations.find(o => o.id === org.id);
                              setEditingOrg({
                                id: org.id,
                                name: org.name,
                                billingPackage: String(org.billingPackage || 'starter'),
                                perCallRate: String(org.perCallRate || '0.30'),
                                perMinuteRate: String(org.perMinuteRate || '0.30'),
                                monthlyCredits: String(org.monthlyCredits || 0),
                                maxAgents: String(orgDetails?.maxAgents || 5),
                                maxUsers: String(orgDetails?.maxUsers || 10),
                                customRateEnabled: orgDetails?.customRateEnabled || false,
                                userCount: org.userCount,
                                totalCalls: org.totalCalls,
                                usedCredits: org.usedCredits || 0,
                                estimatedCost: org.estimatedCost,
                              });
                            }}
                            data-testid={`button-edit-billing-${org.id}`}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Billing Packages</h2>
              <Button onClick={() => setCreatingPackage(true)} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Package</span>
                <span className="sm:hidden">Add Package</span>
              </Button>
            </div>

            {billingPackages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No billing packages defined yet.</p>
                <p className="text-sm mt-2">Create your first billing package to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {billingPackages.map((pkg) => (
                  <Card key={pkg.id} className="p-4 border-2 relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPackage(pkg)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 h-8 w-8 p-0"
                        onClick={() => setDeletingPackage(pkg)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-base">{pkg.displayName}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold">${pkg.monthlyPrice}/mo</p>
                        {pkg.availableToType === 'agency' && (
                          <Badge variant="secondary" className="text-xs">Agency Only</Badge>
                        )}
                      </div>
                      <ul className="space-y-1 text-xs">
                        <li className="truncate">• ${pkg.perCallRate} per call</li>
                        <li className="truncate">• ${pkg.perMinuteRate} per minute</li>
                        <li className="truncate">• {pkg.maxAgents} agents max</li>
                        <li className="truncate">• {pkg.maxUsers} users max</li>
                        {Number(pkg.monthlyCredits) > 0 && (
                          <li className="truncate">• {pkg.monthlyCredits} monthly credits</li>
                        )}
                        {pkg.marginPercentage && Number(pkg.marginPercentage) > 0 && (
                          <li className="truncate text-muted-foreground">• {pkg.marginPercentage}% agency margin</li>
                        )}
                      </ul>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Organizations</p>
                  <p className="text-2xl font-bold">{organizations.length}</p>
                </div>
                <Building2 className="w-8 h-8 text-primary/20" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{billingData?.totalUsers || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500/20" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-bold">{billingData?.totalCalls || 0}</p>
                </div>
                <Phone className="w-8 h-8 text-green-500/20" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Platform Revenue</p>
                  <p className="text-2xl font-bold text-green-600">${billingData?.totalRevenue?.toFixed(2) || "0.00"}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500/20" />
              </div>
            </Card>
          </div>

          {/* Organizations List */}
          <Card className="p-3 sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">All Organizations</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage and monitor all organizations on the platform
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium">Organization</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Type</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Users</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Agents</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Calls</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Package</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Revenue</th>
                    <th className="text-left py-3 px-2 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => {
                    const orgBilling = billingData?.organizationsData.find(o => o.id === org.id);
                    const userCount = users.filter(u => u.organizationId === org.id).length;

                    return (
                      <tr key={org.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-sm">{org.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Created: {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-col gap-1">
                            {org.organizationType === 'agency' ? (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs w-fit">Agency</Badge>
                            ) : org.organizationType === 'platform_owner' ? (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs w-fit">Platform</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs w-fit">Regular</Badge>
                            )}
                            {org.organizationType === 'agency' && org.commissionRate && (
                              <span className="text-xs text-muted-foreground">{org.commissionRate}% commission</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{userCount}</span>
                            <span className="text-xs text-muted-foreground">/ {org.maxUsers}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{orgBilling?.agentCount || 0}</span>
                            <span className="text-xs text-muted-foreground">/ {org.maxAgents}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm">{orgBilling?.totalCalls || 0}</span>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className="text-xs">
                            {org.billingPackage || 'Starter'}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-sm font-medium text-green-600">
                            ${orgBilling?.estimatedCost?.toFixed(2) || '0.00'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="View Details"
                              onClick={() => {
                                const orgBilling = billingData?.organizationsData.find(o => o.id === org.id);
                                toast({
                                  title: org.name,
                                  description: `Users: ${users.filter(u => u.organizationId === org.id).length}/${org.maxUsers} • Agents: ${orgBilling?.agentCount || 0}/${org.maxAgents} • Calls: ${orgBilling?.totalCalls || 0} • Revenue: $${orgBilling?.estimatedCost?.toFixed(2) || '0.00'}`
                                });
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            {org.organizationType === 'agency' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Manage Permissions"
                                onClick={() => {
                                  setManagingPermissionsOrg({
                                    id: org.id,
                                    name: org.name,
                                    organizationType: org.organizationType || 'end_customer',
                                    billingPackage: org.billingPackage || 'starter'
                                  });
                                }}
                              >
                                <Shield className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Edit Organization"
                              onClick={() => {
                                const orgBilling = billingData?.organizationsData.find(o => o.id === org.id);
                                setEditingOrg({
                                  id: org.id,
                                  name: org.name,
                                  billingPackage: org.billingPackage || 'starter',
                                  perCallRate: String(org.perCallRate || 0.30),
                                  perMinuteRate: String(org.perMinuteRate || 0.30),
                                  monthlyCredits: String(org.monthlyCredits || 0),
                                  maxAgents: String(org.maxAgents || 5),
                                  maxUsers: String(org.maxUsers || 10),
                                  customRateEnabled: false,
                                  userCount: users.filter(u => u.organizationId === org.id).length,
                                  totalCalls: orgBilling?.totalCalls || 0,
                                  usedCredits: orgBilling?.usedCredits || 0,
                                  estimatedCost: orgBilling?.estimatedCost || 0,
                                });
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {organizations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No organizations found</p>
                  <p className="text-sm mt-1">Organizations will appear here once created</p>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-base font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top Organizations by Revenue
              </h3>
              <div className="space-y-2">
                {billingData?.organizationsData
                  .sort((a, b) => b.estimatedCost - a.estimatedCost)
                  .slice(0, 5)
                  .map((org, index) => (
                    <div key={org.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                        <span className="text-sm truncate max-w-[150px]">{org.name}</span>
                      </div>
                      <span className="text-sm font-medium text-green-600">${org.estimatedCost.toFixed(2)}</span>
                    </div>
                  ))}
                {(!billingData?.organizationsData || billingData.organizationsData.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No revenue data available</p>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-base font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Most Active Organizations
              </h3>
              <div className="space-y-2">
                {billingData?.organizationsData
                  .sort((a, b) => b.totalCalls - a.totalCalls)
                  .slice(0, 5)
                  .map((org, index) => (
                    <div key={org.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                        <span className="text-sm truncate max-w-[150px]">{org.name}</span>
                      </div>
                      <span className="text-sm font-medium">{org.totalCalls} calls</span>
                    </div>
                  ))}
                {(!billingData?.organizationsData || billingData.organizationsData.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No activity data available</p>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Payment Management Tab */}
        <TabsContent value="payments" className="space-y-6">
          {/* Payment Analytics */}
          <Suspense fallback={<AdminSectionLoader />}>
            <PaymentAnalytics
              transactions={transactions}
              organizations={organizations}
              billingData={billingData}
            />
          </Suspense>

          {/* Payment History */}
          <Suspense fallback={<AdminSectionLoader />}>
            <PaymentHistory
              transactions={transactions}
              organizations={organizations}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] })}
              isLoading={transactionsLoading}
            />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={creatingPackage} onOpenChange={setCreatingPackage}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Billing Package</DialogTitle>
            <DialogDescription>
              Create a new billing package for organizations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pkg-name">Internal Name</Label>
                <Input
                  id="pkg-name"
                  value={newPackage.name}
                  onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                  placeholder="e.g. starter_plan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-display">Display Name</Label>
                <Input
                  id="pkg-display"
                  value={newPackage.displayName}
                  onChange={(e) => setNewPackage({ ...newPackage, displayName: e.target.value })}
                  placeholder="e.g. Starter Plan"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pkg-price">Monthly Price ($)</Label>
                <Input
                  id="pkg-price"
                  type="number"
                  value={newPackage.monthlyPrice}
                  onChange={(e) => setNewPackage({ ...newPackage, monthlyPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-call-rate">Per Call ($)</Label>
                <Input
                  id="pkg-call-rate"
                  type="number"
                  step="0.01"
                  value={newPackage.perCallRate}
                  onChange={(e) => setNewPackage({ ...newPackage, perCallRate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-min-rate">Per Minute ($)</Label>
                <Input
                  id="pkg-min-rate"
                  type="number"
                  step="0.01"
                  value={newPackage.perMinuteRate}
                  onChange={(e) => setNewPackage({ ...newPackage, perMinuteRate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pkg-credits">Monthly Credits</Label>
                <Input
                  id="pkg-credits"
                  type="number"
                  value={newPackage.monthlyCredits}
                  onChange={(e) => setNewPackage({ ...newPackage, monthlyCredits: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-agents">Max Agents</Label>
                <Input
                  id="pkg-agents"
                  type="number"
                  value={newPackage.maxAgents}
                  onChange={(e) => setNewPackage({ ...newPackage, maxAgents: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-users">Max Users</Label>
                <Input
                  id="pkg-users"
                  type="number"
                  value={newPackage.maxUsers}
                  onChange={(e) => setNewPackage({ ...newPackage, maxUsers: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-type">Available To</Label>
              <Select
                value={newPackage.availableToType}
                onValueChange={(value: "agency" | "end_customer") =>
                  setNewPackage({ ...newPackage, availableToType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="end_customer">End Customers</SelectItem>
                  <SelectItem value="agency">Agencies Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingPackage(false)}>Cancel</Button>
            <Button
              onClick={() => createPackageMutation.mutate(newPackage)}
              disabled={createPackageMutation.isPending}
            >
              {createPackageMutation.isPending ? "Creating..." : "Create Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Organization: {editingOrg?.name}</DialogTitle>
            <DialogDescription>
              Modify billing settings and limits for this organization.
            </DialogDescription>
          </DialogHeader>
          {editingOrg && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="org-package">Billing Package</Label>
                <Select
                  value={editingOrg.billingPackage}
                  onValueChange={(value) => {
                    const pkg = billingPackages.find(p => p.name === value);
                    if (pkg) {
                      setEditingOrg({
                        ...editingOrg,
                        billingPackage: value,
                        perCallRate: String(pkg.perCallRate),
                        perMinuteRate: String(pkg.perMinuteRate),
                        monthlyCredits: String(pkg.monthlyCredits),
                        maxAgents: String(pkg.maxAgents),
                        maxUsers: String(pkg.maxUsers),
                      });
                    } else {
                      setEditingOrg({ ...editingOrg, billingPackage: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    {billingPackages.map(pkg => (
                      <SelectItem key={pkg.id} value={pkg.name}>{pkg.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="custom-rates"
                  checked={editingOrg.customRateEnabled}
                  onCheckedChange={(checked) => setEditingOrg({ ...editingOrg, customRateEnabled: checked })}
                />
                <Label htmlFor="custom-rates">Enable Custom Rates & Limits</Label>
              </div>

              {editingOrg.customRateEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-call-rate">Per Call Rate ($)</Label>
                      <Input
                        id="org-call-rate"
                        type="number"
                        step="0.01"
                        value={editingOrg.perCallRate}
                        onChange={(e) => setEditingOrg({ ...editingOrg, perCallRate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-min-rate">Per Minute Rate ($)</Label>
                      <Input
                        id="org-min-rate"
                        type="number"
                        step="0.01"
                        value={editingOrg.perMinuteRate}
                        onChange={(e) => setEditingOrg({ ...editingOrg, perMinuteRate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-credits">Monthly Credits</Label>
                      <Input
                        id="org-credits"
                        type="number"
                        value={editingOrg.monthlyCredits}
                        onChange={(e) => setEditingOrg({ ...editingOrg, monthlyCredits: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-agents">Max Agents</Label>
                      <Input
                        id="org-agents"
                        type="number"
                        value={editingOrg.maxAgents}
                        onChange={(e) => setEditingOrg({ ...editingOrg, maxAgents: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-users">Max Users</Label>
                      <Input
                        id="org-users"
                        type="number"
                        value={editingOrg.maxUsers}
                        onChange={(e) => setEditingOrg({ ...editingOrg, maxUsers: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editingOrg) return;
                updateOrgMutation.mutate({
                  id: editingOrg.id,
                  updates: {
                    billingPackage: editingOrg.billingPackage as any,
                    perCallRate: editingOrg.perCallRate,
                    perMinuteRate: editingOrg.perMinuteRate,
                    monthlyCredits: parseInt(editingOrg.monthlyCredits),
                    maxAgents: parseInt(editingOrg.maxAgents),
                    maxUsers: parseInt(editingOrg.maxUsers),
                    customRateEnabled: editingOrg.customRateEnabled,
                  }
                });
              }}
              disabled={updateOrgMutation.isPending}
            >
              {updateOrgMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agency Permissions Dialog */}
      <Dialog open={!!managingPermissionsOrg} onOpenChange={(open) => !open && setManagingPermissionsOrg(null)}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Agency Permissions: {managingPermissionsOrg?.name}</DialogTitle>
            <DialogDescription>
              Manage permissions and access levels for this agency.
            </DialogDescription>
          </DialogHeader>
          {managingPermissionsOrg && (
            <Suspense fallback={<AdminSectionLoader />}>
              <AgencyPermissions
                organizationId={managingPermissionsOrg.id}
                organizationName={managingPermissionsOrg.name}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}