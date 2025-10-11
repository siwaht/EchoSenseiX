import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BillingPlan {
  id: string;
  name: string;
  displayName: string;
  monthlyPrice: number;
  features: string[];
  maxAgents: number;
  maxUsers: number;
  monthlyCredits: number;
}

export function UnifiedCheckout() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch available billing plans
  const { data: plans = [], isLoading } = useQuery<BillingPlan[]>({
    queryKey: ["/api/billing-plans"],
  });

  // Get current organization info
  const { data: orgInfo } = useQuery({
    queryKey: ["/api/organization"],
  });

  // Subscribe to plan mutation
  const subscribeMutation = useMutation({
    mutationFn: async (planId: string) => {
      return await apiRequest("POST", "/api/billing/subscribe", {
        planId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      toast({ 
        title: "Successfully subscribed!", 
        description: "Your plan has been updated." 
      });
      setIsProcessing(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Subscription failed", 
        description: error.message || "Please try again later.",
        variant: "destructive" 
      });
      setIsProcessing(false);
    },
  });

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      toast({ 
        title: "Please select a plan", 
        variant: "destructive" 
      });
      return;
    }

    setIsProcessing(true);
    subscribeMutation.mutate(selectedPlan);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold mb-2">Choose Your Plan</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Select the plan that best fits your needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`p-6 cursor-pointer transition-all ${
              selectedPlan === plan.id
                ? "ring-2 ring-primary border-primary"
                : "hover:shadow-lg"
            }`}
            onClick={() => setSelectedPlan(plan.id)}
            data-testid={`card-plan-${plan.id}`}
          >
            <div className="space-y-4">
              <div>
                <h4 className="text-xl font-semibold">{plan.displayName}</h4>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${plan.monthlyPrice}</span>
                  <span className="text-gray-600 dark:text-gray-400">/month</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Max Agents</span>
                  <span className="font-medium">{plan.maxAgents}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Max Users</span>
                  <span className="font-medium">{plan.maxUsers}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Monthly Credits</span>
                  <span className="font-medium">${plan.monthlyCredits}</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Features:</p>
                <ul className="space-y-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedPlan === plan.id && (
                <Badge className="w-full justify-center">
                  Selected
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-center pt-6">
        <Button
          size="lg"
          disabled={!selectedPlan || isProcessing}
          onClick={handleSubscribe}
          className="min-w-[200px]"
          data-testid="button-subscribe"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Subscribe Now
            </>
          )}
        </Button>
      </div>
    </div>
  );
}