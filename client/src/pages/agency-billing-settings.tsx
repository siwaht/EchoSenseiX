import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  ArrowLeft, Save, CreditCard, DollarSign, Settings, 
  AlertCircle, CheckCircle, Shield, Eye, EyeOff,
  Package, Plus, Edit, Trash2, ArrowUpDown, Copy
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface PaymentConfig {
  id: string;
  organizationId: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
  paypalWebhookId?: string;
  defaultGateway?: "stripe" | "paypal";
  currency?: string;
  taxRate?: string;
  isConfigured?: boolean;
  lastVerifiedAt?: Date;
}

interface PricingPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingInterval: "monthly" | "yearly" | "one-time";
  features: string[];
  callsLimit?: number;
  minutesLimit?: number;
  isActive: boolean;
  displayOrder: number;
}

export default function AgencyBillingSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showPaypalSecret, setShowPaypalSecret] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [newPlanFeature, setNewPlanFeature] = useState("");
  
  // Form state for payment config
  const [paymentConfig, setPaymentConfig] = useState<Partial<PaymentConfig>>({
    defaultGateway: "stripe",
    currency: "usd",
    taxRate: "0",
    isConfigured: false
  });
  
  // Form state for pricing plan
  const [planForm, setPlanForm] = useState<Partial<PricingPlan>>({
    name: "",
    description: "",
    price: 0,
    billingInterval: "monthly",
    features: [],
    isActive: true,
    displayOrder: 0
  });

  // Fetch payment configuration
  const { data: configData, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["/api/agency/payment-config"],
    enabled: user?.role === 'agency'
  });

  // Fetch pricing plans
  const { data: plansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ["/api/agency/pricing-plans", user?.organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/agency/pricing-plans?agencyDomain=${window.location.hostname.split('.')[0]}`);
      if (!response.ok) throw new Error("Failed to fetch pricing plans");
      return response.json();
    },
    enabled: user?.role === 'agency'
  });

  useEffect(() => {
    if (configData) {
      setPaymentConfig(configData);
    }
  }, [configData]);

  // Save payment configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (config: Partial<PaymentConfig>) => {
      const url = configData ? '/api/agency/payment-config' : '/api/agency/payment-config';
      const method = configData ? 'PATCH' : 'POST';
      const response = await apiRequest(method, url, config);
      if (!response.ok) throw new Error("Failed to save payment configuration");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Payment gateway settings have been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/payment-config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save payment configuration",
        variant: "destructive",
      });
    },
  });

  // Create/update pricing plan mutation
  const savePlanMutation = useMutation({
    mutationFn: async (plan: Partial<PricingPlan>) => {
      const url = plan.id 
        ? `/api/agency/pricing-plans/${plan.id}`
        : '/api/agency/pricing-plans';
      const method = plan.id ? 'PATCH' : 'POST';
      const response = await apiRequest(method, url, plan);
      if (!response.ok) throw new Error("Failed to save pricing plan");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Saved",
        description: editingPlan ? "Pricing plan updated successfully" : "New pricing plan created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/pricing-plans"] });
      setShowPlanDialog(false);
      resetPlanForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save pricing plan",
        variant: "destructive",
      });
    },
  });

  // Delete pricing plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest('DELETE', `/api/agency/pricing-plans/${planId}`);
      if (!response.ok) throw new Error("Failed to delete pricing plan");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Deleted",
        description: "Pricing plan has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/pricing-plans"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete pricing plan",
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    saveConfigMutation.mutate(paymentConfig);
  };

  const handleSavePlan = () => {
    if (!planForm.name || !planForm.price) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    savePlanMutation.mutate(planForm);
  };

  const handleEditPlan = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setPlanForm(plan);
    setShowPlanDialog(true);
  };

  const handleDeletePlan = (planId: string) => {
    if (confirm("Are you sure you want to delete this pricing plan?")) {
      deletePlanMutation.mutate(planId);
    }
  };

  const handleAddFeature = () => {
    if (newPlanFeature.trim()) {
      setPlanForm(prev => ({
        ...prev,
        features: [...(prev.features || []), newPlanFeature.trim()]
      }));
      setNewPlanFeature("");
    }
  };

  const handleRemoveFeature = (index: number) => {
    setPlanForm(prev => ({
      ...prev,
      features: prev.features?.filter((_, i) => i !== index) || []
    }));
  };

  const resetPlanForm = () => {
    setPlanForm({
      name: "",
      description: "",
      price: 0,
      billingInterval: "monthly",
      features: [],
      isActive: true,
      displayOrder: 0
    });
    setEditingPlan(null);
    setNewPlanFeature("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Value copied to clipboard",
    });
  };

  if (user?.role !== 'agency') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            Only agency owners can access billing settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoadingConfig || isLoadingPlans) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Agency Billing Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1" data-testid="text-page-description">
            Configure payment gateways and manage pricing plans for your clients
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setLocation("/agency-users")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Tabs defaultValue="payment" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="payment">Payment Gateways</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Plans</TabsTrigger>
        </TabsList>

        {/* Payment Gateways Tab */}
        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Gateway Configuration</CardTitle>
              <CardDescription>
                Configure Stripe and PayPal to accept payments from your clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stripe Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-semibold">Stripe</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Accept credit card payments with Stripe
                    </p>
                  </div>
                  <Switch
                    checked={!!paymentConfig.stripeSecretKey || false}
                    onCheckedChange={(checked) => 
                      setPaymentConfig(prev => ({ 
                        ...prev, 
                        stripeSecretKey: checked ? prev.stripeSecretKey || '' : undefined,
                        isConfigured: checked || !!prev.paypalClientId
                      }))
                    }
                    data-testid="switch-stripe"
                  />
                </div>
                
                {!!paymentConfig.stripeSecretKey && (
                  <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <div className="space-y-2">
                      <Label htmlFor="stripe-publishable">Publishable Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id="stripe-publishable"
                          placeholder="pk_live_..."
                          value={paymentConfig.stripePublishableKey || ""}
                          onChange={(e) => 
                            setPaymentConfig(prev => ({ ...prev, stripePublishableKey: e.target.value }))
                          }
                          data-testid="input-stripe-publishable"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(paymentConfig.stripePublishableKey || "")}
                          data-testid="button-copy-stripe-publishable"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="stripe-secret">Secret Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id="stripe-secret"
                          type={showStripeSecret ? "text" : "password"}
                          placeholder="sk_live_..."
                          value={paymentConfig.stripeSecretKey || ""}
                          onChange={(e) => 
                            setPaymentConfig(prev => ({ ...prev, stripeSecretKey: e.target.value }))
                          }
                          data-testid="input-stripe-secret"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowStripeSecret(!showStripeSecret)}
                          data-testid="button-toggle-stripe-secret"
                        >
                          {showStripeSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="stripe-webhook">Webhook Secret (Optional)</Label>
                      <Input
                        id="stripe-webhook"
                        type="password"
                        placeholder="whsec_..."
                        value={paymentConfig.stripeWebhookSecret || ""}
                        onChange={(e) => 
                          setPaymentConfig(prev => ({ ...prev, stripeWebhookSecret: e.target.value }))
                        }
                        data-testid="input-stripe-webhook"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PayPal Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-semibold">PayPal</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Accept PayPal and Venmo payments
                    </p>
                  </div>
                  <Switch
                    checked={!!paymentConfig.paypalClientId || false}
                    onCheckedChange={(checked) => 
                      setPaymentConfig(prev => ({ 
                        ...prev, 
                        paypalClientId: checked ? prev.paypalClientId || '' : undefined,
                        isConfigured: checked || !!prev.stripeSecretKey
                      }))
                    }
                    data-testid="switch-paypal"
                  />
                </div>
                
                {!!paymentConfig.paypalClientId && (
                  <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <div className="space-y-2">
                      <Label htmlFor="paypal-mode">Environment</Label>
                      <Select
                        value={paymentConfig.paypalClientId?.includes('sandbox') ? 'sandbox' : 'production'}
                        onValueChange={(value: "sandbox" | "production") => {
                          // Update the client ID prefix based on environment
                          const currentId = paymentConfig.paypalClientId || '';
                          const newId = value === 'sandbox' 
                            ? currentId.replace(/^live_/, 'sandbox_')
                            : currentId.replace(/^sandbox_/, 'live_');
                          setPaymentConfig(prev => ({ ...prev, paypalClientId: newId }));
                        }}
                      >
                        <SelectTrigger id="paypal-mode" data-testid="select-paypal-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                          <SelectItem value="production">Production (Live)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="paypal-client">Client ID</Label>
                      <div className="flex gap-2">
                        <Input
                          id="paypal-client"
                          placeholder="AYSq3Ry..."
                          value={paymentConfig.paypalClientId || ""}
                          onChange={(e) => 
                            setPaymentConfig(prev => ({ ...prev, paypalClientId: e.target.value }))
                          }
                          data-testid="input-paypal-client"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(paymentConfig.paypalClientId || "")}
                          data-testid="button-copy-paypal-client"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="paypal-secret">Client Secret</Label>
                      <div className="flex gap-2">
                        <Input
                          id="paypal-secret"
                          type={showPaypalSecret ? "text" : "password"}
                          placeholder="EJ43Kp..."
                          value={paymentConfig.paypalClientSecret || ""}
                          onChange={(e) => 
                            setPaymentConfig(prev => ({ ...prev, paypalClientSecret: e.target.value }))
                          }
                          data-testid="input-paypal-secret"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowPaypalSecret(!showPaypalSecret)}
                          data-testid="button-toggle-paypal-secret"
                        >
                          {showPaypalSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Default Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="default-method">Default Payment Method</Label>
                <Select
                  value={paymentConfig.defaultGateway}
                  onValueChange={(value: "stripe" | "paypal") => 
                    setPaymentConfig(prev => ({ ...prev, defaultGateway: value }))
                  }
                >
                  <SelectTrigger id="default-method" data-testid="select-default-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe" disabled={!paymentConfig.stripeSecretKey}>
                      Stripe
                    </SelectItem>
                    <SelectItem value="paypal" disabled={!paymentConfig.paypalClientId}>
                      PayPal
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveConfig}
                  disabled={saveConfigMutation.isPending}
                  data-testid="button-save-config"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Gateway Help */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Security Notice</AlertTitle>
            <AlertDescription>
              Your API keys are encrypted and stored securely. Never share your secret keys publicly.
              For Stripe, get your keys from the <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline">Stripe Dashboard</a>.
              For PayPal, get your credentials from the <a href="https://developer.paypal.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">PayPal Developer Dashboard</a>.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Pricing Plans Tab */}
        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pricing Plans</CardTitle>
                  <CardDescription>
                    Create and manage pricing plans for your clients
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => {
                    resetPlanForm();
                    setShowPlanDialog(true);
                  }}
                  data-testid="button-add-plan"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {plansData && plansData.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {plansData.map((plan: PricingPlan) => (
                    <Card key={plan.id} className="relative">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-2xl font-bold">
                                ${plan.price}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                /{plan.billingInterval === "yearly" ? "year" : plan.billingInterval === "monthly" ? "month" : "one-time"}
                              </span>
                            </div>
                          </div>
                          <Badge variant={plan.isActive ? "default" : "secondary"}>
                            {plan.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {plan.description && (
                          <CardDescription className="mt-2">
                            {plan.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {plan.callsLimit && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Calls limit: </span>
                            <span className="font-medium">{plan.callsLimit}</span>
                          </div>
                        )}
                        {plan.minutesLimit && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Minutes limit: </span>
                            <span className="font-medium">{plan.minutesLimit}</span>
                          </div>
                        )}
                        {plan.features && plan.features.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Features:</p>
                            <ul className="text-sm space-y-1">
                              {plan.features.slice(0, 3).map((feature, index) => (
                                <li key={index} className="flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                                </li>
                              ))}
                              {plan.features.length > 3 && (
                                <li className="text-gray-500 text-xs">
                                  +{plan.features.length - 3} more features
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPlan(plan)}
                            data-testid={`button-edit-plan-${plan.id}`}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePlan(plan.id)}
                            data-testid={`button-delete-plan-${plan.id}`}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No pricing plans yet. Create your first plan to start billing clients.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Edit Pricing Plan" : "Create New Pricing Plan"}
            </DialogTitle>
            <DialogDescription>
              Define the pricing and features for this plan
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan Name *</Label>
                <Input
                  id="plan-name"
                  placeholder="e.g., Professional"
                  value={planForm.name}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-plan-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plan-price">Price (USD) *</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="29.99"
                  value={planForm.price}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-plan-price"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                placeholder="Brief description of the plan"
                value={planForm.description}
                onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                data-testid="input-plan-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-interval">Billing Interval</Label>
                <Select
                  value={planForm.billingInterval}
                  onValueChange={(value: "monthly" | "yearly" | "one-time") => 
                    setPlanForm(prev => ({ ...prev, billingInterval: value }))
                  }
                >
                  <SelectTrigger id="plan-interval" data-testid="select-plan-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plan-order">Display Order</Label>
                <Input
                  id="plan-order"
                  type="number"
                  min="0"
                  value={planForm.displayOrder}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                  data-testid="input-plan-order"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-calls">Calls Limit (optional)</Label>
                <Input
                  id="plan-calls"
                  type="number"
                  min="0"
                  placeholder="1000"
                  value={planForm.callsLimit || ""}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, callsLimit: parseInt(e.target.value) || undefined }))}
                  data-testid="input-plan-calls"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plan-minutes">Minutes Limit (optional)</Label>
                <Input
                  id="plan-minutes"
                  type="number"
                  min="0"
                  placeholder="5000"
                  value={planForm.minutesLimit || ""}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, minutesLimit: parseInt(e.target.value) || undefined }))}
                  data-testid="input-plan-minutes"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Features</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a feature"
                  value={newPlanFeature}
                  onChange={(e) => setNewPlanFeature(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                  data-testid="input-plan-feature"
                />
                <Button 
                  type="button"
                  onClick={handleAddFeature}
                  data-testid="button-add-feature"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {planForm.features && planForm.features.length > 0 && (
                <ul className="space-y-1 mt-2">
                  {planForm.features.map((feature, index) => (
                    <li key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-sm">{feature}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFeature(index)}
                        data-testid={`button-remove-feature-${index}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="plan-active"
                checked={planForm.isActive}
                onCheckedChange={(checked) => setPlanForm(prev => ({ ...prev, isActive: checked }))}
                data-testid="switch-plan-active"
              />
              <Label htmlFor="plan-active">Plan is active</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPlanDialog(false);
                resetPlanForm();
              }}
              data-testid="button-cancel-plan"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSavePlan}
              disabled={savePlanMutation.isPending}
              data-testid="button-save-plan"
            >
              <Save className="h-4 w-4 mr-2" />
              {savePlanMutation.isPending ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}