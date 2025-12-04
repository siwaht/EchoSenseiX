import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  CreditCard,
  Check
} from "lucide-react";
import type { Organization } from "@shared/schema";

export default function AgencyBillingSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: organization } = useQuery<Organization>({
    queryKey: ["/api/organization"],
  });

  const { data: billingPackages = [] } = useQuery<any[]>({
    queryKey: ["/api/billing-packages"],
  });

  const updateBillingMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await apiRequest("POST", "/api/billing/update-subscription", { packageId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Updated",
        description: "Your billing plan has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      });
    },
  });

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentPackage = billingPackages.find(p => p.name === organization.billingPackage) || {
    displayName: 'Starter',
    monthlyPrice: 0,
    perCallRate: 0.30,
    perMinuteRate: 0.30
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/settings")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Billing Settings</h1>
          <p className="text-muted-foreground">Manage your agency subscription and billing</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Current Plan Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Plan</span>
              <Badge variant={organization.billingPackage === 'enterprise' ? 'default' : 'secondary'}>
                {currentPackage.displayName}
              </Badge>
            </CardTitle>
            <CardDescription>
              Your organization is currently on the {currentPackage.displayName} plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-muted-foreground mb-1">Monthly Fee</p>
                <p className="text-2xl font-bold">${currentPackage.monthlyPrice}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-muted-foreground mb-1">Per Call Rate</p>
                <p className="text-2xl font-bold">${currentPackage.perCallRate}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium text-muted-foreground mb-1">Per Minute Rate</p>
                <p className="text-2xl font-bold">${currentPackage.perMinuteRate}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>Next billing date: {new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Available Plans */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {billingPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`relative ${organization.billingPackage === pkg.name ? 'border-primary shadow-md' : ''}`}
              >
                {organization.billingPackage === pkg.name && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                    Current Plan
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{pkg.displayName}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${pkg.monthlyPrice}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>${pkg.perCallRate} per call</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>${pkg.perMinuteRate} per minute</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{pkg.maxAgents} Agents</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{pkg.maxUsers} Users</span>
                    </li>
                  </ul>

                  <Button
                    className="w-full"
                    variant={organization.billingPackage === pkg.name ? "outline" : "default"}
                    disabled={organization.billingPackage === pkg.name || updateBillingMutation.isPending}
                    onClick={() => updateBillingMutation.mutate(pkg.id)}
                  >
                    {organization.billingPackage === pkg.name ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>Manage your payment details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Visa ending in 4242</p>
                  <p className="text-sm text-muted-foreground">Expires 12/24</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Update</Button>
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>View your past invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">Invoice #{2024000 + i}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(new Date().setMonth(new Date().getMonth() - i)).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">$49.00</span>
                    <Button variant="ghost" size="sm">Download</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}