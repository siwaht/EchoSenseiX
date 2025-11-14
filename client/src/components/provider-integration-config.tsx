import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  VOICE_AI_PROVIDERS,
  getProvidersByCategory,
  VoiceAIProviderMetadata,
  ProviderCategory,
} from "@shared/voice-ai-providers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Plus,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

interface ProviderIntegration {
  id: string;
  provider: string;
  providerCategory: string | null;
  credentials: Record<string, string>;
  config: Record<string, any> | null;
  status: string;
  lastTested: string | null;
  createdAt: string;
}

export default function ProviderIntegrationConfig() {
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] =
    useState<VoiceAIProviderMetadata | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [deleteProvider, setDeleteProvider] = useState<string | null>(null);

  // Fetch existing integrations
  const { data: integrations = [], refetch, isLoading, isError, error } = useQuery<ProviderIntegration[]>({
    queryKey: ["/api/integrations/all"],
    queryFn: async () => {
      try {
        // Try the multi-provider integrations endpoint first
        const response = await fetch("/api/integrations/all", {
          credentials: "include"
        });
        if (response.ok) {
          const data = await response.json();
          return Array.isArray(data) ? data : [];
        }
        // Fallback to empty array if endpoint doesn't exist yet
        return [];
      } catch (error) {
        console.warn("Integrations endpoint not available:", error);
        return [];
      }
    },
    retry: 1,
    staleTime: 30000,
  });

  // Save provider mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      provider,
      category,
      creds,
    }: {
      provider: string;
      category: ProviderCategory;
      creds: Record<string, string>;
    }) => {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          providerCategory: category,
          credentials: creds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save integration");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration Saved",
        description: `${selectedProvider?.displayName} has been configured successfully.`,
      });
      setIsConfigOpen(false);
      setSelectedProvider(null);
      setCredentials({});
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete provider mutation
  const deleteMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await fetch(`/api/integrations/${provider}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete integration");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration Deleted",
        description: "Provider integration has been removed.",
      });
      setDeleteProvider(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await fetch(`/api/integrations/${provider}/test`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Test failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection Test Passed",
        description: "Provider is responding correctly.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfigureProvider = (provider: VoiceAIProviderMetadata) => {
    setSelectedProvider(provider);
    setIsConfigOpen(true);

    // Pre-fill existing credentials if any
    const existing = integrations.find((i) => i.provider === provider.id);
    if (existing?.credentials) {
      setCredentials(existing.credentials);
    } else {
      // Initialize empty credentials
      const emptyCreds: Record<string, string> = {};
      provider.credentials.forEach((cred) => {
        emptyCreds[cred.key] = "";
      });
      setCredentials(emptyCreds);
    }
  };

  const handleSave = () => {
    if (!selectedProvider) return;

    // Validate required fields
    const missingRequired = selectedProvider.credentials
      .filter((cred) => cred.required && !credentials[cred.key])
      .map((cred) => cred.label);

    if (missingRequired.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingRequired.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      provider: selectedProvider.id,
      category: selectedProvider.category,
      creds: credentials,
    });
  };

  const isProviderConfigured = (providerId: string) => {
    return integrations.some((i) => i.provider === providerId);
  };

  const getProviderStatus = (providerId: string) => {
    const integration = integrations.find((i) => i.provider === providerId);
    return integration?.status || null;
  };

  const renderProviderCard = (provider: VoiceAIProviderMetadata) => {
    const isConfigured = isProviderConfigured(provider.id);
    const status = getProviderStatus(provider.id);

    return (
      <Card
        key={provider.id}
        className="p-3 sm:p-4 hover:shadow-lg transition-all duration-200 border-2"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                <h3 className="font-semibold text-base sm:text-lg truncate">{provider.displayName}</h3>
                {isConfigured && (
                  <Badge
                    variant={status === "ACTIVE" ? "default" : "destructive"}
                    className="text-xs flex-shrink-0"
                  >
                    {status === "ACTIVE" ? (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-1" />
                    )}
                    {status}
                  </Badge>
                )}
              </div>
              <Badge variant="outline" className="text-xs mb-2 inline-block">
                {provider.tier}
              </Badge>
              <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                {provider.description}
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {provider.subcategories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat.toUpperCase()}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Pricing:</strong> {provider.pricing.details}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={isConfigured ? "outline" : "default"}
              size="sm"
              onClick={() => handleConfigureProvider(provider)}
              className="flex-1 w-full sm:w-auto"
            >
              {isConfigured ? (
                <>
                  <Settings className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Reconfigure</span>
                  <span className="sm:hidden">Edit</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </>
              )}
            </Button>

            {isConfigured && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMutation.mutate(provider.id)}
                  disabled={testMutation.isPending}
                  className="flex-1 sm:flex-initial"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span className="hidden sm:inline">Test</span>
                      <span className="sm:hidden">Test</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteProvider(provider.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}

            {provider.docsUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(provider.docsUrl, "_blank")}
                className="sm:w-auto"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderCategoryTab = (category: ProviderCategory, label: string) => {
    const providers = getProvidersByCategory(category);

    return (
      <TabsContent value={category} className="space-y-4 mt-4">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => renderProviderCard(provider))}
        </div>
      </TabsContent>
    );
  };

  // Error state
  if (isError) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to Load Integrations</h3>
        <p className="text-muted-foreground mb-4">
          {error instanceof Error ? error.message : "An error occurred while loading your integrations."}
        </p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-full sm:w-64 bg-muted rounded animate-pulse" />
        <div className="h-4 w-full sm:w-96 bg-muted rounded animate-pulse" />
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-3 sm:p-4">
              <div className="space-y-3">
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">AI Provider Configuration</h2>
          <p className="text-muted-foreground">
            Configure your AI providers for LLM, TTS, STT, and telephony services.
            Mix and match providers per agent for optimal performance.
          </p>
        </div>

        <Tabs defaultValue="all-in-one" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1">
            <TabsTrigger value="all-in-one" className="text-xs sm:text-sm">All-in-One</TabsTrigger>
            <TabsTrigger value="llm" className="text-xs sm:text-sm">LLM</TabsTrigger>
            <TabsTrigger value="tts" className="text-xs sm:text-sm">TTS</TabsTrigger>
            <TabsTrigger value="stt" className="text-xs sm:text-sm">STT</TabsTrigger>
            <TabsTrigger value="vad" className="text-xs sm:text-sm">VAD</TabsTrigger>
            <TabsTrigger value="telephony" className="text-xs sm:text-sm">Phone</TabsTrigger>
          </TabsList>

          {renderCategoryTab("all-in-one", "All-in-One Platforms")}
          {renderCategoryTab("llm", "Language Models")}
          {renderCategoryTab("tts", "Text-to-Speech")}
          {renderCategoryTab("stt", "Speech-to-Text")}
          {renderCategoryTab("vad", "Turn Detection (VAD)")}
          {renderCategoryTab("telephony", "Telephony")}
        </Tabs>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configure {selectedProvider?.displayName}
            </DialogTitle>
            <DialogDescription>
              Enter your credentials for {selectedProvider?.displayName}. All
              credentials are encrypted and stored securely.
            </DialogDescription>
          </DialogHeader>

          {selectedProvider && (
            <div className="space-y-4">
              {selectedProvider.status === "beta" && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <strong>Beta Provider:</strong> This provider is in beta
                    and may have limited features or stability issues.
                  </div>
                </div>
              )}

              {selectedProvider.credentials.map((cred) => (
                <div key={cred.key} className="space-y-2">
                  <Label htmlFor={cred.key}>
                    {cred.label}
                    {cred.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id={cred.key}
                    type={cred.type === "password" ? "password" : "text"}
                    placeholder={cred.placeholder}
                    value={credentials[cred.key] || ""}
                    onChange={(e) =>
                      setCredentials({
                        ...credentials,
                        [cred.key]: e.target.value,
                      })
                    }
                    required={cred.required}
                  />
                  {cred.description && (
                    <p className="text-xs text-muted-foreground">
                      {cred.description}
                    </p>
                  )}
                </div>
              ))}

              <div className="p-3 bg-muted rounded-md space-y-2">
                <h4 className="font-semibold text-sm">Provider Information</h4>
                <div className="text-xs space-y-1">
                  <p>
                    <strong>Category:</strong> {selectedProvider.category}
                  </p>
                  <p>
                    <strong>Pricing:</strong> {selectedProvider.pricing.model} -{" "}
                    {selectedProvider.pricing.details}
                  </p>
                  {selectedProvider.supportedLanguages && (
                    <p>
                      <strong>Languages:</strong>{" "}
                      {selectedProvider.supportedLanguages.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfigOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteProvider}
        onOpenChange={() => setDeleteProvider(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the provider configuration and credentials. You
              will need to reconfigure it if you want to use this provider again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProvider && deleteMutation.mutate(deleteProvider)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
