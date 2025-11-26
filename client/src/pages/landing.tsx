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
    if (agencySubdomain) {
      setSubdomain(agencySubdomain);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const querySubdomain = urlParams.get('subdomain');
      if (querySubdomain) {
        setSubdomain(querySubdomain);
      } else {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
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
      if (whitelabelConfig.appName) {
        document.title = whitelabelConfig.appName;
      }
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
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col" role="main">
      {/* Navigation */}
      <header className="bg-card/90 backdrop-blur-md border-b border-border/50 shadow-sm" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              {whitelabelConfig?.logoUrl ? (
                <img
                  src={whitelabelConfig.logoUrl}
                  alt="Logo"
                  className="w-9 h-9 object-contain rounded-lg shadow-sm"
                />
              ) : (
                <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                  <Mic className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {whitelabelConfig?.appName || "EchoSensei"}
              </span>
            </div>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="button-theme-toggle"
                className="hover:bg-primary/10 transition-colors"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Login Section */}
      <section className="flex-1 overflow-y-auto p-4" aria-labelledby="login-heading">
        <div className="w-full max-w-md mx-auto mt-12">
          <Card className="p-6 sm:p-8 bg-card/95 backdrop-blur-md border-border/50 shadow-2xl hover:shadow-3xl transition-shadow duration-300">
            <div className="text-center mb-8">
              {whitelabelConfig?.logoUrl ? (
                <img
                  src={whitelabelConfig.logoUrl}
                  alt="Logo"
                  className="w-16 h-16 object-contain rounded-2xl mx-auto mb-4 shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Mic className="w-8 h-8 text-primary-foreground" />
                </div>
              )}
              <h1 id="login-heading" className="text-3xl font-bold text-card-foreground mb-2">Welcome Back</h1>
              <p className="text-sm text-muted-foreground">
                {whitelabelConfig?.companyName
                  ? `Sign in to access ${whitelabelConfig.companyName}`
                  : "Sign in to access your EchoSensei"}
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit}
              aria-label="Login form"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-card-foreground">
                  Email
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="Enter your email"
                    className="pl-10 h-12 text-base border-border/50 focus:border-primary/50 transition-all"
                    data-testid="input-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-card-foreground">
                  Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="pl-10 h-12 text-base border-border/50 focus:border-primary/50 transition-all"
                    data-testid="input-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 mt-8 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                size="lg"
                data-testid="button-login"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
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
          <div className="mt-8 text-center">
            {!whitelabelConfig?.removePlatformBranding && (
              <>
                <h3 className="text-lg font-semibold text-card-foreground mb-3">
                  What is {whitelabelConfig?.appName || "EchoSensei"}?
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed" data-testid="text-info-description">
                  A comprehensive monitoring platform for voice AI agents with enterprise-grade security,
                  real-time analytics, and multi-tenant support.
                </p>
              </>
            )}

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-card-foreground">Secure BYOK</p>
                <p className="text-xs text-muted-foreground mt-1">Bring your own keys</p>
              </div>
              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-card-foreground">Real-time Analytics</p>
                <p className="text-xs text-muted-foreground mt-1">Live insights & metrics</p>
              </div>
              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-card-foreground">Multi-tenant</p>
                <p className="text-xs text-muted-foreground mt-1">Agencies & organizations</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}