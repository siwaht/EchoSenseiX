import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun, Shield, TrendingUp, Users, Mic, LogIn, Mail, Lock, ArrowRight, Sparkles } from "lucide-react";
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
    <main className="min-h-screen relative overflow-hidden flex flex-col" role="main">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] z-10" />
        <div className={`absolute inset-0 z-0 ${theme === 'dark' ? 'mesh-bg' : 'mesh-bg-light'} opacity-60`} />

        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-3s' }} />
      </div>

      {/* Navigation */}
      <header className="relative z-20 border-b border-white/10 bg-white/5 backdrop-blur-md" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4 group cursor-pointer">
              {whitelabelConfig?.logoUrl ? (
                <img
                  src={whitelabelConfig.logoUrl}
                  alt="Logo"
                  className="w-10 h-10 object-contain rounded-xl shadow-lg group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-primary/25 group-hover:scale-105 transition-all duration-300">
                  <Mic className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 tracking-tight">
                {whitelabelConfig?.appName || "EchoSensei"}
              </span>
            </div>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="button-theme-toggle"
                className="rounded-full hover:bg-white/10 transition-colors"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="relative z-20 flex-1 flex flex-col justify-center items-center p-4 sm:p-8" aria-labelledby="login-heading">
        <div className="w-full max-w-md mx-auto animate-in" style={{ animationDelay: '0.1s' }}>
          <Card className="glass-card border-0 p-8 sm:p-10 shadow-2xl ring-1 ring-white/20 relative overflow-hidden group">
            {/* Card Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-purple-500/20 to-primary/20 rounded-[inherit] blur opacity-20 group-hover:opacity-40 transition duration-500" />

            <div className="relative z-10">
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-6 ring-1 ring-primary/20 shadow-lg shadow-primary/5">
                  {whitelabelConfig?.logoUrl ? (
                    <img
                      src={whitelabelConfig.logoUrl}
                      alt="Logo"
                      className="w-12 h-12 object-contain"
                    />
                  ) : (
                    <Mic className="w-8 h-8 text-primary" />
                  )}
                </div>
                <h1 id="login-heading" className="text-3xl font-bold tracking-tight mb-3">
                  Welcome Back
                </h1>
                <p className="text-muted-foreground">
                  {whitelabelConfig?.companyName
                    ? `Sign in to ${whitelabelConfig.companyName}`
                    : "Sign in to your dashboard"}
                </p>
              </div>

              <form
                className="space-y-5"
                onSubmit={handleSubmit}
                aria-label="Login form"
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium ml-1">
                    Email Address
                  </Label>
                  <div className="relative group/input">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-background/50 text-muted-foreground group-focus-within/input:text-primary group-focus-within/input:bg-primary/10 transition-all duration-300">
                      <Mail className="h-4 w-4" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      inputMode="email"
                      placeholder="name@example.com"
                      className="pl-12 h-12 bg-background/30 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 rounded-xl"
                      data-testid="input-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium ml-1">
                    Password
                  </Label>
                  <div className="relative group/input">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-background/50 text-muted-foreground group-focus-within/input:text-primary group-focus-within/input:bg-primary/10 transition-all duration-300">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pl-12 h-12 bg-background/30 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 rounded-xl"
                      data-testid="input-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 mt-6 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 rounded-xl font-medium text-base"
                  size="lg"
                  data-testid="button-login"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <span className="flex items-center justify-center">
                      Sign In <ArrowRight className="ml-2 w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </Card>

          {/* Info Section */}
          <div className="mt-12 text-center animate-in" style={{ animationDelay: '0.2s' }}>
            {!whitelabelConfig?.removePlatformBranding && (
              <div className="mb-10">
                <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Enterprise Grade AI Platform</span>
                </div>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed" data-testid="text-info-description">
                  Experience the next generation of voice AI monitoring with real-time analytics and secure multi-tenant architecture.
                </p>
              </div>
            )}

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { icon: Shield, label: "Secure BYOK", sub: "Enterprise Security" },
                { icon: TrendingUp, label: "Real-time Analytics", sub: "Live Insights" },
                { icon: Users, label: "Multi-tenant", sub: "Organization Ready" }
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="group p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{feature.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{feature.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}