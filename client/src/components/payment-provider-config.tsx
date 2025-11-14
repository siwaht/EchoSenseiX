import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CreditCard,
  Plus,
  Check,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Globe,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import {
  PAYMENT_PROVIDERS,
  PaymentProvider,
  PaymentProviderCategory,
  getProvidersByCategory,
  getPopularProviders,
  formatProviderName,
} from "../../../shared/payment-providers";

interface PaymentProviderConfigProps {
  organizationId: string;
}

export default function PaymentProviderConfig({ organizationId }: PaymentProviderConfigProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<PaymentProviderCategory | "all">("all");

  // Fetch configured payment processors
  const { data: processors, isLoading } = useQuery({
    queryKey: ["/api/agency/payment-processors", organizationId],
  });

  // Add/Update payment processor
  const addProcessorMutation = useMutation({
    mutationFn: async (data: {
      provider: PaymentProvider;
      credentials: Record<string, string>;
      isDefault?: boolean;
    }) => {
      return apiRequest("POST", "/api/agency/payment-processors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/payment-processors"] });
      toast({
        title: "Payment provider configured",
        description: "Your payment provider has been successfully configured.",
      });
      setShowConfigDialog(false);
      setCredentials({});
      setSelectedProvider(null);
    },
    onError: (error: any) => {
      toast({
        title: "Configuration failed",
        description: error.message || "Failed to configure payment provider",
        variant: "destructive",
      });
    },
  });

  // Remove payment processor
  const removeProcessorMutation = useMutation({
    mutationFn: async (provider: PaymentProvider) => {
      return apiRequest("DELETE", `/api/agency/payment-processors/${provider}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/payment-processors"] });
      toast({
        title: "Provider removed",
        description: "Payment provider has been removed.",
      });
    },
  });

  const handleProviderSelect = (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setShowConfigDialog(true);
    setCredentials({});
    setShowSecrets({});
  };

  const handleSaveProvider = () => {
    if (!selectedProvider) return;

    const metadata = PAYMENT_PROVIDERS[selectedProvider];
    const requiredFields = Object.entries(metadata.credentials)
      .filter(([_, config]) => config.required)
      .map(([key, _]) => key);

    const missingFields = requiredFields.filter((field) => !credentials[field]);

    if (missingFields.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    addProcessorMutation.mutate({
      provider: selectedProvider,
      credentials,
      isDefault: false,
    });
  };

  const getCategoryIcon = (category: PaymentProviderCategory) => {
    switch (category) {
      case "traditional_gateway":
        return <CreditCard className="w-4 h-4" />;
      case "regional_provider":
        return <Globe className="w-4 h-4" />;
      case "digital_wallet":
        return <Zap className="w-4 h-4" />;
      case "bnpl":
        return <TrendingUp className="w-4 h-4" />;
      case "cryptocurrency":
        return <Shield className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (category: PaymentProviderCategory) => {
    switch (category) {
      case "traditional_gateway":
        return "Payment Gateways";
      case "regional_provider":
        return "Regional Providers";
      case "digital_wallet":
        return "Digital Wallets";
      case "bnpl":
        return "Buy Now Pay Later";
      case "cryptocurrency":
        return "Cryptocurrency";
      default:
        return category;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "production":
        return <Badge className="bg-green-500">Production Ready</Badge>;
      case "beta":
        return <Badge className="bg-yellow-500">Beta</Badge>;
      case "coming_soon":
        return <Badge className="bg-gray-500">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  const getPopularityBadge = (popularity: string) => {
    if (popularity === "high") {
      return <Badge variant="outline">Popular</Badge>;
    }
    return null;
  };

  const configuredProviderIds = new Set(
    processors?.map((p: any) => p.provider) || []
  );

  const filteredProviders = Object.values(PAYMENT_PROVIDERS).filter((provider) => {
    if (selectedCategory === "all") return true;
    return provider.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Payment Providers</h2>
        <p className="text-muted-foreground">
          Configure multiple payment providers to give your customers more payment options
        </p>
      </div>

      {/* Category Filter */}
      <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="traditional_gateway">
            <CreditCard className="w-4 h-4 mr-2" />
            Gateways
          </TabsTrigger>
          <TabsTrigger value="regional_provider">
            <Globe className="w-4 h-4 mr-2" />
            Regional
          </TabsTrigger>
          <TabsTrigger value="digital_wallet">
            <Zap className="w-4 h-4 mr-2" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="bnpl">
            <TrendingUp className="w-4 h-4 mr-2" />
            BNPL
          </TabsTrigger>
          <TabsTrigger value="cryptocurrency">
            <Shield className="w-4 h-4 mr-2" />
            Crypto
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Configured Providers */}
      {processors && processors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Payment Providers</CardTitle>
            <CardDescription>
              Currently configured payment providers for your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processors.map((processor: any) => {
                const metadata = PAYMENT_PROVIDERS[processor.provider as PaymentProvider];
                if (!metadata) return null;

                return (
                  <div
                    key={processor.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(metadata.category)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{metadata.displayName}</span>
                          {processor.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                          {processor.status === "active" && (
                            <Badge className="bg-green-500">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          {processor.status === "pending_validation" && (
                            <Badge className="bg-yellow-500">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          {processor.status === "invalid" && (
                            <Badge variant="destructive">
                              <X className="w-3 h-3 mr-1" />
                              Invalid
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {metadata.description}
                        </p>
                        {processor.metadata?.mode && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Mode: {processor.metadata.mode}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeProcessorMutation.mutate(processor.provider)}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Providers */}
      <Card>
        <CardHeader>
          <CardTitle>Available Payment Providers</CardTitle>
          <CardDescription>
            Select a payment provider to configure for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProviders.map((provider) => {
              const isConfigured = configuredProviderIds.has(provider.id);

              return (
                <Card
                  key={provider.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isConfigured ? "opacity-60" : ""
                  }`}
                  onClick={() => !isConfigured && handleProviderSelect(provider.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(provider.category)}
                        <CardTitle className="text-lg">{provider.displayName}</CardTitle>
                      </div>
                      {isConfigured && (
                        <Badge className="bg-green-500">
                          <Check className="w-3 h-3" />
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {provider.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {getStatusBadge(provider.status)}
                        {getPopularityBadge(provider.popularity)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>
                          <strong>Regions:</strong>{" "}
                          {provider.primaryRegion || provider.regions[0]}
                        </p>
                        {provider.fees && (
                          <p>
                            <strong>Fees:</strong> {provider.fees.percentage}% +{" "}
                            {provider.fees.fixed} {provider.fees.currency?.toUpperCase()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configure {selectedProvider && PAYMENT_PROVIDERS[selectedProvider].displayName}
            </DialogTitle>
            <DialogDescription>
              {selectedProvider && PAYMENT_PROVIDERS[selectedProvider].description}
            </DialogDescription>
          </DialogHeader>

          {selectedProvider && (
            <div className="space-y-4">
              {/* Provider Info */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Documentation</AlertTitle>
                <AlertDescription>
                  <a
                    href={PAYMENT_PROVIDERS[selectedProvider].integration.apiDocumentation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View API Documentation →
                  </a>
                </AlertDescription>
              </Alert>

              {/* Credential Fields */}
              <div className="space-y-4">
                <h4 className="font-semibold">API Credentials</h4>
                {Object.entries(PAYMENT_PROVIDERS[selectedProvider].credentials).map(
                  ([key, config]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>
                        {config.label}
                        {config.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>

                      {config.type === "select" ? (
                        <Select
                          value={credentials[key] || ""}
                          onValueChange={(value) =>
                            setCredentials({ ...credentials, [key]: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${config.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {config.options?.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="relative">
                          <Input
                            id={key}
                            type={
                              config.type === "password" && !showSecrets[key]
                                ? "password"
                                : "text"
                            }
                            value={credentials[key] || ""}
                            onChange={(e) =>
                              setCredentials({ ...credentials, [key]: e.target.value })
                            }
                            placeholder={config.helpText}
                          />
                          {config.type === "password" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full"
                              onClick={() =>
                                setShowSecrets({
                                  ...showSecrets,
                                  [key]: !showSecrets[key],
                                })
                              }
                            >
                              {showSecrets[key] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}

                      {config.helpText && (
                        <p className="text-xs text-muted-foreground">{config.helpText}</p>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Provider Features */}
              <div>
                <h4 className="font-semibold mb-2">Capabilities</h4>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_PROVIDERS[selectedProvider].capabilities.map((capability) => (
                    <Badge key={capability} variant="outline">
                      {capability.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Supported Currencies */}
              <div>
                <h4 className="font-semibold mb-2">Supported Currencies</h4>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_PROVIDERS[selectedProvider].supportedCurrencies
                    .slice(0, 10)
                    .map((currency) => (
                      <Badge key={currency} variant="secondary">
                        {currency.toUpperCase()}
                      </Badge>
                    ))}
                  {PAYMENT_PROVIDERS[selectedProvider].supportedCurrencies.length > 10 && (
                    <Badge variant="secondary">
                      +{PAYMENT_PROVIDERS[selectedProvider].supportedCurrencies.length - 10}{" "}
                      more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProvider} disabled={addProcessorMutation.isPending}>
              {addProcessorMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
