import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun, Shield, TrendingUp, Users, Mic, LogIn, Mail, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAgencyPath } from "@/hooks/useAgencyPath";

export default function Landing() {
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { agencySubdomain, buildPath } = useAgencyPath();
  const [subdomain, setSubdomain] = useState<string | null>(null);
  
  // Detect subdomain from URL path, query parameter, or hostname
  useEffect(() => {
    // First priority: agency path
    if (agencySubdomain) {
      setSubdomain(agencySubdomain);
    } else {
      // Check for subdomain in query parameter (development mode)
      const urlParams = new URLSearchParams(window.location.search);
      const querySubdomain = urlParams.get('subdomain');
      
      if (querySubdomain) {
        setSubdomain(querySubdomain);
      } else {
        // Check hostname for subdomain
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        
        // Check if we have a subdomain (not www, not localhost)
        if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
          setSubdomain(parts[0]);
        }
      }
    }
  }, [agencySubdomain]);
  
  // Fetch public whitelabel configuration based on subdomain
  const { data: whitelabelConfig } = useQuery<{
    appName?: string;
    companyName?: string;
    logoUrl?: string;
    faviconUrl?: string;
    removePlatformBranding?: boolean;
  }>({
    queryKey: subdomain 
      ? [`/api/whitelabel/subdomain/${subdomain}`]
      : ["/api/whitelabel/public"],
    retry: false,
    enabled: true,
  });
  
  
  // Apply whitelabel settings to document
  useEffect(() => {
    if (whitelabelConfig) {
      // Update document title
      if (whitelabelConfig.appName) {
        document.title = whitelabelConfig.appName;
      }
      
      // Update favicon
      if (whitelabelConfig.faviconUrl) {
        const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
        if (favicon) {
          favicon.href = whitelabelConfig.faviconUrl;
        } else {
          const newFavicon = document.createElement('link');
          newFavicon.rel = 'icon';
          newFavicon.href = whitelabelConfig.faviconUrl;
          document.head.appendChild(newFavicon);
        }
      }
    }
  }, [whitelabelConfig]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        throw new Error("Login failed");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Use buildPath to maintain agency context after login
      setLocation(buildPath("/"));
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <main className="min-h-screen bg-background flex flex-col" role="main">
      {/* Navigation */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              {whitelabelConfig?.logoUrl ? (
                <img 
                  src={whitelabelConfig.logoUrl} 
                  alt="Logo" 
                  className="w-8 h-8 object-contain rounded" 
                />
              ) : (
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Mic className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <span className="text-xl font-bold text-card-foreground">
                {whitelabelConfig?.appName || "VoiceAI Dashboard"}
              </span>
            </div>
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="button-theme-toggle"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Login Section */}
      <section className="flex-1 overflow-y-auto p-4" aria-labelledby="login-heading">
        <div className="w-full max-w-md mx-auto mt-8">
          <Card className="p-6 sm:p-8 bg-card/95 backdrop-blur-sm border-border shadow-2xl">
            <div className="text-center mb-6">
              {whitelabelConfig?.logoUrl ? (
                <img 
                  src={whitelabelConfig.logoUrl} 
                  alt="Logo" 
                  className="w-14 h-14 object-contain rounded-2xl mx-auto mb-3" 
                />
              ) : (
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Mic className="w-7 h-7 text-primary-foreground" />
                </div>
              )}
              <h1 id="login-heading" className="text-2xl font-bold text-card-foreground mb-1">Welcome Back</h1>
              <p className="text-sm text-muted-foreground">
                {whitelabelConfig?.companyName 
                  ? `Sign in to access ${whitelabelConfig.companyName}` 
                  : "Sign in to access your VoiceAI Dashboard"}
              </p>
            </div>

            <form 
              className="space-y-4"
              onSubmit={handleSubmit}
              aria-label="Login form"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10 h-11"
                    data-testid="input-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    className="pl-10 h-11"
                    data-testid="input-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit"
                className="w-full h-11 mt-6 bg-primary text-primary-foreground hover:bg-primary/90" 
                size="lg" 
                data-testid="button-login"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  "Signing in..."
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Info Section */}
          <div className="mt-6 text-center">
            {!whitelabelConfig?.removePlatformBranding && (
              <>
                <h3 className="text-lg font-semibold text-card-foreground mb-4">
                  What is {whitelabelConfig?.appName || "VoiceAI Dashboard"}?
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto" data-testid="text-info-description">
                  A comprehensive monitoring platform for voice AI agents with enterprise-grade security, 
                  real-time analytics, and multi-tenant support.
                </p>
              </>
            )}

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Secure BYOK</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Real-time Analytics</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Multi-tenant</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}