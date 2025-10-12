import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Upload, Eye, Save, Check, Users, Copy, ExternalLink, ChevronDown, Info, Globe } from "lucide-react";
import { useLocation } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";


// Get base domain from environment or use default
const getBaseDomain = () => {
  // In development, use the current host
  if (import.meta.env.DEV) {
    return window.location.host;
  }
  // In production, use configured domain or fallback
  return import.meta.env.VITE_BASE_DOMAIN || window.location.host;
};

export default function WhitelabelSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseDomain = getBaseDomain();

  // Form state
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [appName, setAppName] = useState("EchoSensei");
  const [companyName, setCompanyName] = useState("");
  const [removeBranding, setRemoveBranding] = useState(false);
  const [subdomain, setSubdomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  // Load existing whitelabel settings
  const { data: whitelabelData, isLoading } = useQuery<any>({
    queryKey: ["/api/whitelabel"],
    enabled: true,
    retry: false,
  });

  // Load organization data
  const { data: orgData } = useQuery<any>({
    queryKey: ["/api/organization/current"],
    enabled: true,
  });

  useEffect(() => {
    if (whitelabelData) {
      setAppName(whitelabelData.appName || "EchoSensei");
      setCompanyName(whitelabelData.companyName || "");
      setLogoPreview(whitelabelData.logoUrl || "");
      setRemoveBranding(whitelabelData.removeBranding || false);
      setSupportUrl(whitelabelData.supportUrl || "");
      setDocumentationUrl(whitelabelData.documentationUrl || "");
    }
  }, [whitelabelData]);

  useEffect(() => {
    if (orgData) {
      setSubdomain(orgData.subdomain || "");
      setCustomDomain(orgData.customDomain || "");
    }
  }, [orgData]);

  // Check subdomain availability
  useEffect(() => {
    const checkAvailability = async () => {
      if (!subdomain || subdomain.length < 3) {
        setSubdomainAvailable(null);
        return;
      }

      setCheckingSubdomain(true);
      try {
        const response = await apiRequest("POST", "/api/subdomain/check", { 
          subdomain,
          excludeOrgId: orgData?.id 
        }) as any;
        setSubdomainAvailable(response.available);
      } catch (error) {
        setSubdomainAvailable(false);
      } finally {
        setCheckingSubdomain(false);
      }
    };

    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [subdomain, orgData?.id]);

  const handleSubdomainChange = (value: string) => {
    // Only allow lowercase letters, numbers, and hyphens
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(sanitized);
    setHasChanges(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let logoUrl = whitelabelData?.logoUrl || "";
      
      // Handle logo upload if there's a new logo
      if (logo) {
        const reader = new FileReader();
        const base64Logo = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(logo);
        });
        logoUrl = base64Logo as string;
      } else if (logoPreview === "" && whitelabelData?.logoUrl) {
        // If logo was removed, set to empty string
        logoUrl = "";
      }

      const data = {
        appName,
        companyName,
        removePlatformBranding: removeBranding,
        subdomain,
        customDomain,
        supportUrl,
        documentationUrl,
        logoUrl,
        faviconUrl: whitelabelData?.faviconUrl || ""
      };

      return apiRequest("POST", "/api/whitelabel", data);
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your whitelabel settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whitelabel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/current"] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save whitelabel settings",
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    setLogoPreview("");
    setHasChanges(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    if (subdomainAvailable === false) {
      toast({
        title: "Invalid Subdomain",
        description: "Please choose an available subdomain",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => setLocation("/settings")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">White Label Settings</h1>
          <p className="text-muted-foreground mt-2">
            Customize your platform's branding and appearance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Branding */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Branding</CardTitle>
                <CardDescription>
                  Configure your agency's brand identity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logo Upload */}
                <div>
                  <Label htmlFor="logo">Agency Logo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-16 w-auto object-contain" />
                    ) : (
                      <div className="h-16 w-16 border-2 border-dashed rounded flex items-center justify-center">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {logoPreview ? "Change Logo" : "Upload Logo"}
                      </Button>
                      {logoPreview && (
                        <Button
                          variant="outline"
                          onClick={handleRemoveLogo}
                        >
                          Remove Logo
                        </Button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>

                {/* App Name */}
                <div>
                  <Label htmlFor="appName">Application Name</Label>
                  <Input
                    id="appName"
                    value={appName}
                    onChange={(e) => {
                      setAppName(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="EchoSensei"
                    className="mt-2"
                  />
                </div>

                {/* Company Name */}
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Your Agency Name"
                    className="mt-2"
                  />
                </div>

                {/* Remove Branding */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="removeBranding">Remove Platform Branding</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide "Powered by EchoSensei" from your dashboard
                    </p>
                  </div>
                  <Switch
                    id="removeBranding"
                    checked={removeBranding}
                    onCheckedChange={(checked) => {
                      setRemoveBranding(checked);
                      setHasChanges(true);
                    }}
                  />
                </div>
              </CardContent>
            </Card>


            {/* Custom Domain Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Domain</CardTitle>
                <CardDescription>
                  Set up your agency's unique identifier and custom domain for branded access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subdomain">Agency Identifier</Label>
                  <div className="flex gap-2 mt-2">
                    <div className="relative flex-1">
                      <Input
                        id="subdomain"
                        value={subdomain}
                        onChange={(e) => handleSubdomainChange(e.target.value)}
                        placeholder="agency-name"
                        className={`pr-10 ${
                          subdomainAvailable === false ? 'border-red-500' : 
                          subdomainAvailable === true ? 'border-green-500' : ''
                        }`}
                      />
                      {checkingSubdomain && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                      )}
                      {!checkingSubdomain && subdomainAvailable === true && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                      {!checkingSubdomain && subdomainAvailable === false && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500">
                          Taken
                        </span>
                      )}
                    </div>
                  </div>
                  {subdomain && (
                    <div className="mt-3 p-3 bg-muted rounded-md space-y-2">
                      <p className="text-sm font-medium">Your Agency Access URL:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-background px-2 py-1 rounded flex-1">
                          {window.location.origin}/agency/{subdomain}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/agency/${subdomain}`);
                            toast({
                              title: "URL Copied",
                              description: "Agency URL has been copied to clipboard",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/agency/${subdomain}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Share this URL with your clients to access your branded dashboard
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="customDomain" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Custom Domain (Optional)
                  </Label>
                  <Input
                    id="customDomain"
                    type="url"
                    value={customDomain}
                    onChange={(e) => {
                      setCustomDomain(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="dashboard.youragency.com"
                    className="mt-2"
                  />
                  
                  {/* Expandable Setup Instructions */}
                  <Collapsible className="mt-3">
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-between text-sm font-normal px-3 py-2 h-auto hover:bg-muted"
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          How to connect your domain
                        </span>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                      </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="mt-2">
                      <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
                        {/* Quick Overview */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Connect your domain in 3 simple steps:</p>
                          <div className="pl-4 space-y-3 text-sm">
                            <div className="flex gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">1</span>
                              <div>
                                <p className="font-medium">Go to your domain provider</p>
                                <p className="text-xs text-muted-foreground">Access your DNS settings at GoDaddy, Namecheap, Cloudflare, etc.</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">2</span>
                              <div>
                                <p className="font-medium">Add a CNAME record</p>
                                <div className="mt-2 p-2 bg-background rounded border">
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Type:</span>
                                      <p className="font-mono font-medium">CNAME</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Name/Host:</span>
                                      <p className="font-mono font-medium">@ or www</p>
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">Points to/Value:</span>
                                      <div className="flex items-center gap-2 mt-1">
                                        <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1 break-all">
                                          {subdomain || 'your-subdomain'}.{baseDomain}
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          type="button"
                                          onClick={() => {
                                            const target = `${subdomain || 'your-subdomain'}.${baseDomain}`;
                                            navigator.clipboard.writeText(target);
                                            toast({
                                              title: "Copied!",
                                              description: "CNAME target copied to clipboard",
                                            });
                                          }}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">TTL:</span>
                                      <p className="font-mono font-medium">3600 or Auto</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">3</span>
                              <div>
                                <p className="font-medium">Save and wait</p>
                                <p className="text-xs text-muted-foreground">Changes typically take 5-30 minutes to propagate</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Provider-specific help */}
                        <div className="border-t pt-3">
                          <p className="text-xs font-medium mb-2">Need help? Quick links to popular providers:</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              type="button"
                              onClick={() => window.open('https://www.godaddy.com/help/add-a-cname-record-19236', '_blank')}
                            >
                              GoDaddy Guide →
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              type="button"
                              onClick={() => window.open('https://www.namecheap.com/support/knowledgebase/article.aspx/9646', '_blank')}
                            >
                              Namecheap Guide →
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              type="button"
                              onClick={() => window.open('https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/', '_blank')}
                            >
                              Cloudflare Guide →
                            </Button>
                          </div>
                        </div>
                        
                        {/* Additional info */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-3 text-xs">
                          <p className="font-medium mb-1">💡 Pro tip:</p>
                          <p className="text-muted-foreground">
                            If you're using Cloudflare, make sure the proxy (orange cloud) is turned OFF for this record to work properly.
                          </p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>

            {/* User Management Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage your organization's users and permissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Control who has access to your white-labeled platform and what they can do.
                </p>
                <Button 
                  className="w-full"
                  onClick={() => setLocation("/agency-users")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </CardContent>
            </Card>

            {/* Support Links */}
            <Card>
              <CardHeader>
                <CardTitle>Support Links (Optional)</CardTitle>
                <CardDescription>
                  Direct customers to your support resources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="supportUrl">Support URL</Label>
                  <Input
                    id="supportUrl"
                    type="url"
                    value={supportUrl}
                    onChange={(e) => {
                      setSupportUrl(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="https://support.youragency.com"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="documentationUrl">Documentation URL</Label>
                  <Input
                    id="documentationUrl"
                    type="url"
                    value={documentationUrl}
                    onChange={(e) => {
                      setDocumentationUrl(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="https://docs.youragency.com"
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          {/* Live Preview */}
          <div className="lg:sticky lg:top-6">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Preview
                </CardTitle>
                <CardDescription>
                  See your branding in action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login Page</TabsTrigger>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login" className="mt-4">
                    <div className="border rounded-lg p-6 bg-white">
                      {/* Login Preview */}
                      <div className="text-center mb-6">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-12 mx-auto mb-4" />
                        ) : (
                          <div className="h-12 w-12 rounded mx-auto mb-4 bg-primary flex items-center justify-center">
                            <Upload className="h-6 w-6 text-white" />
                          </div>
                        )}
                        <h2 className="text-2xl font-bold">{appName || "EchoSensei"}</h2>
                        <p className="text-sm mt-2 text-gray-600">
                          {companyName ? `Welcome to ${companyName}` : "Sign in to your account"}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="h-10 rounded bg-gray-100" />
                        <div className="h-10 rounded bg-gray-100" />
                        <button 
                          className="w-full h-10 rounded text-white font-medium bg-primary"
                        >
                          Sign In
                        </button>
                      </div>
                      {!removeBranding && (
                        <p className="text-xs text-center mt-6 text-gray-500">
                          Powered by EchoSensei Platform
                        </p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="dashboard" className="mt-4">
                    <div className="border rounded-lg overflow-hidden">
                      {/* Dashboard Header Preview */}
                      <div 
                        className="h-14 flex items-center px-4 text-white bg-primary"
                      >
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-8 mr-3 brightness-0 invert" />
                        ) : (
                          <div className="h-8 w-24 bg-white/20 rounded mr-3" />
                        )}
                        <span className="font-semibold">{appName || "EchoSensei"}</span>
                      </div>
                      {/* Dashboard Content Preview */}
                      <div className="p-4 bg-white">
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="h-20 rounded bg-primary/10" />
                          <div className="h-20 rounded bg-primary/10" />
                          <div className="h-20 rounded bg-primary/10" />
                        </div>
                        <div className="h-32 rounded bg-gray-100" />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}