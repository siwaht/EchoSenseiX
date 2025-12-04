import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun, Shield, TrendingUp, Users, Mic, Mail, Lock, ArrowRight } from "lucide-react";
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
          setSubdomain(parts[0] || null);
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
    onError: (_error: Error) => {
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
      {/* Sophisticated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px] z-10" />
        <div className={`absolute inset-0 z-0 ${theme === 'dark' ? 'mesh-bg' : 'mesh-bg-light'}`} />

        {/* Elegant Gradient Orbs */}
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-primary/30 to-purple-500/20 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tl from-pink-500/20 to-primary/25 rounded-full blur-[100px] animate-float-slow" style={{ animationDelay: '-4s' }} />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-gradient-to-br from-violet-500/15 to-transparent rounded-full blur-[80px] animate-pulse-glow" />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 z-5 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Premium Navigation */}
      <header className="relative z-20 border-b border-white/5 dark:border-white/10 glass" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-18 py-4">
            <div className="flex items-center space-x-3 group cursor-pointer">
              {whitelabelConfig?.logoUrl ? (
                <img
                  src={whitelabelConfig.logoUrl}
                  alt="Logo"
                  className="w-10 h-10 object-contain rounded-xl shadow-lg shadow-primary/10 group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="relative w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 group-hover:scale-105 transition-all duration-300">
                  <Mic className="w-5 h-5 text-white" />
                  <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              <span className="text-xl sm:text-2xl font-bold brand-gradient-text tracking-tight">
                {whitelabelConfig?.appName || "EchoSensei"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="button-theme-toggle"
                className="rounded-xl hover:bg-primary/10 transition-all duration-200"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="relative z-20 flex-1 flex flex-col justify-center items-center p-4 sm:p-8" aria-labelledby="login-heading">
        <div className="w-full max-w-md mx-auto animate-in-up" style={{ animationDelay: '0.1s' }}>
          <Card className="glass-card border-0 p-8 sm:p-10 shadow-2xl relative overflow-hidden group">
            {/* Elegant glow effect */}
            <div className="absolute -inset-[1px] bg-gradient-to-br from-primary/30 via-purple-500/20 to-pink-500/30 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-sm" />
            <div className="absolute inset-0 bg-card rounded-[inherit]" />

            <div className="relative z-10">
              <div className="text-center mb-10">
                {/* Animated logo container */}
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="absolute inset-0 brand-gradient rounded-2xl blur-xl opacity-30 animate-pulse-glow" />
                  <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 ring-1 ring-primary/20 shadow-xl shadow-primary/10">
                    {whitelabelConfig?.logoUrl ? (
                      <img
                        src={whitelabelConfig.logoUrl}
                        alt="Logo"
                        className="w-10 h-10 object-contain"
                      />
                    ) : (
                      <Mic className="w-8 h-8 text-primary" />
                    )}
                  </div>
                </div>
                <h1 id="login-heading" className="text-3xl font-bold tracking-tight mb-2">
                  Welcome Back
                </h1>
                <p className="text-muted-foreground text-sm">
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
                  <Label htmlFor="email" className="text-sm font-medium ml-1 text-muted-foreground">
                    Email Address
                  </Label>
                  <div className="relative group/input input-focus-glow rounded-xl">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-focus-within/input:text-primary group-focus-within/input:bg-primary/10 transition-all duration-300">
                      <Mail className="h-4 w-4" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      inputMode="email"
                      placeholder="name@example.com"
                      className="pl-14 h-12 bg-muted/30 border-border/50 hover:border-border focus:border-primary/50 focus:ring-0 transition-all duration-300 rounded-xl"
                      data-testid="input-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium ml-1 text-muted-foreground">
                    Password
                  </Label>
                  <div className="relative group/input input-focus-glow rounded-xl">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-focus-within/input:text-primary group-focus-within/input:bg-primary/10 transition-all duration-300">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pl-14 h-12 bg-muted/30 border-border/50 hover:border-border focus:border-primary/50 focus:ring-0 transition-all duration-300 rounded-xl"
                      data-testid="input-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 mt-6 brand-gradient text-white btn-premium rounded-xl font-semibold text-base"
                  size="lg"
                  data-testid="button-login"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <span className="flex items-center justify-center">
                      Sign In <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </Card>

          {/* Info Section */}
          <div className="mt-12 text-center animate-in-up" style={{ animationDelay: '0.3s' }}>
            {!whitelabelConfig?.removePlatformBranding && (
              <div className="mb-10">
                <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full glass border-0 mb-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-medium text-muted-foreground">Enterprise Grade AI Platform</span>
                </div>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed" data-testid="text-info-description">
                  Experience the next generation of voice AI monitoring with real-time analytics,
                  secure multi-tenant architecture, and seamless integrations.
                </p>
              </div>
            )}

            {/* Feature Cards - Elegant Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Shield, label: "Enterprise Security", sub: "Secure BYOK", gradient: "from-blue-500/10 to-cyan-500/10" },
                { icon: TrendingUp, label: "Live Analytics", sub: "Real-time Insights", gradient: "from-primary/10 to-purple-500/10" },
                { icon: Users, label: "Multi-tenant", sub: "Team Ready", gradient: "from-pink-500/10 to-rose-500/10" }
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className={`group relative p-5 rounded-2xl bg-gradient-to-br ${feature.gradient} backdrop-blur-sm border border-white/10 dark:border-white/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg overflow-hidden`}
                >
                  {/* Subtle shine effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                  </div>

                  <div className="relative z-10">
                    <div className="w-11 h-11 bg-background/80 dark:bg-background/50 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{feature.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{feature.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer subtle branding */}
      {!whitelabelConfig?.removePlatformBranding && (
        <footer className="relative z-20 py-4 text-center">
          <p className="text-xs text-muted-foreground/60">
            Powered by EchoSensei • Voice AI Infrastructure
          </p>
        </footer>
      )}
    </main>
  );
}