import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, TrendingUp, Package, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Organization {
  billingPackage: string;
  monthlyCredits: number;
  usedCredits: number;
  creditBalance: string;
  perCallRate: string;
  perMinuteRate: string;
  billingStatus: string;
  creditResetDate: string;
}

export function UserPlanCard() {
  const [, setLocation] = useLocation();
  
  // Fetch organization data
  const { data: orgData } = useQuery<Organization>({
    queryKey: ["/api/organization/current"],
    queryFn: async () => {
      const response = await fetch("/api/organization/current", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch organization data");
      return response.json();
    },
  });

  if (!orgData) return null;

  const creditUsagePercent = orgData.monthlyCredits > 0 
    ? (orgData.usedCredits / orgData.monthlyCredits) * 100 
    : 0;

  const remainingCredits = Math.max(0, orgData.monthlyCredits - orgData.usedCredits);
  
  // Calculate days until reset
  const daysUntilReset = orgData.creditResetDate 
    ? Math.ceil((new Date(orgData.creditResetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 30;

  const getPlanColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'starter': return 'bg-blue-500';
      case 'professional': return 'bg-purple-500';
      case 'enterprise': return 'bg-orange-500';
      case 'agency': return 'bg-green-500';
      case 'custom': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 text-white">Active</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      default:
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Plan header with gradient background */}
      <div className={`absolute top-0 left-0 w-full h-1 ${getPlanColor(orgData.billingPackage)}`} />
      
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Your Plan</CardTitle>
          </div>
          {getStatusBadge(orgData.billingStatus)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Plan Name */}
        <div>
          <p className="text-sm text-muted-foreground">Current Plan</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold capitalize">{orgData.billingPackage}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/billing")}
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Upgrade
            </Button>
          </div>
        </div>

        {/* Credit Usage */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Credits Used</span>
            <span className="font-medium">
              {orgData.usedCredits.toLocaleString()} / {orgData.monthlyCredits.toLocaleString()}
            </span>
          </div>
          <Progress value={creditUsagePercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{remainingCredits.toLocaleString()} credits remaining</span>
            <span>Resets in {daysUntilReset} days</span>
          </div>
          
          {/* Warning if usage is high */}
          {creditUsagePercent > 80 && (
            <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
              <AlertCircle className="h-3 w-3" />
              <span>You've used {creditUsagePercent.toFixed(0)}% of your monthly credits</span>
            </div>
          )}
        </div>

        {/* Rates */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Per Call</p>
            <p className="text-sm font-medium">${parseFloat(orgData.perCallRate).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Per Minute</p>
            <p className="text-sm font-medium">${parseFloat(orgData.perMinuteRate).toFixed(2)}</p>
          </div>
        </div>

        {/* Prepaid Balance (if any) */}
        {parseFloat(orgData.creditBalance) > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Prepaid Balance</span>
            </div>
            <span className="text-sm font-medium">${parseFloat(orgData.creditBalance).toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}