import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAgencyPath } from "@/hooks/useAgencyPath";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import {
  Mic,
  LayoutDashboard,
  Bot,
  History,
  Plug,
  CreditCard,
  Settings,
  Menu,
  Moon,
  Sun,
  LogOut,
  Shield,
  FlaskConical,
  Phone,
  PhoneOutgoing,
  Wrench,
  Users,
  Palette,
  Volume2,
  BookOpen,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard }, // Dashboard is always visible
  { name: "Agents", href: "/agents", icon: Bot }, // Visible to all users (backend filters agents)
  { name: "Voices", href: "/voices", icon: Mic, permission: "manage_voices" },
  { name: "Phone Numbers", href: "/phone-numbers", icon: Phone, permission: "manage_phone_numbers" },
  { name: "Outbound Calling", href: "/outbound-calling", icon: PhoneOutgoing, permission: "make_outbound_calls" },
  { name: "Tools", href: "/tools", icon: Wrench, permission: "configure_tools" },
  { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, permission: "manage_integrations" },
  { name: "Playground", href: "/playground", icon: FlaskConical }, // Allow users to test their assigned agents
  { name: "Call History", href: "/history", icon: History, permission: "view_call_history" },
  { name: "Integrations", href: "/integrations", icon: Plug, permission: "manage_integrations" },
  { name: "Billing", href: "/billing", icon: CreditCard, permission: "view_billing" },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { buildPath } = useAgencyPath();
  const [elevated, setElevated] = useState(false);

  // Get user permissions and role
  const typedUser = user as User | null;
  const userPermissions = typedUser?.permissions || [];
  const isAdmin = typedUser?.isAdmin || false;
  const userRole = typedUser?.role || 'user';

  // Fetch organization details to check if it's an agency
  const { data: organization } = useQuery<{ organizationType?: string; agencyPermissions?: string[] }>({
    queryKey: ["/api/organization/current"],
    enabled: !!user,
  });

  const isAgency = organization?.organizationType === "agency";
  const orgPermissions = organization?.agencyPermissions || [];

  // Fetch whitelabel configuration
  const { data: whitelabelConfig } = useQuery<{
    appName?: string;
    companyName?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    removePlatformBranding?: boolean;
  }>({
    queryKey: ["/api/whitelabel"],
    enabled: !!user,
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

      // Apply primary color to CSS variables and theme-color meta for brand consistency
      if (whitelabelConfig.primaryColor) {
        const root = document.documentElement;
        root.style.setProperty('--primary', whitelabelConfig.primaryColor);
        root.style.setProperty('--ring', whitelabelConfig.primaryColor);
        const themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
        if (themeMeta) {
          themeMeta.content = whitelabelConfig.primaryColor;
        }
      }
    }
  }, [whitelabelConfig]);

  // Header elevation on scroll
  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Filter navigation based on permissions
  const filteredNavigation = navigation.filter(item => {
    // Admin users can see everything
    if (isAdmin) return true;

    // Agency owners can see all agency features
    if (userRole === 'agency' && isAgency) return true;

    // Dashboard is always visible
    if (!item.permission) return true;

    // Check if user has the required permission OR organization has it
    return userPermissions.includes(item.permission) || orgPermissions.includes(item.permission);
  });

  const getPageTitle = () => {
    // Remove agency prefix from location if present
    const cleanLocation = location.replace(/^\/agency\/[a-z0-9-]+/, '');

    const currentNav = filteredNavigation.find(item => item.href === cleanLocation || item.href === '/' && cleanLocation === '');
    if (currentNav) return currentNav.name;

    // Check for dynamic agent settings route
    if (cleanLocation.startsWith("/agents/")) return "Agent Settings";

    // Check for admin route
    if (cleanLocation === "/admin") return "Admin";

    // Check for settings route
    if (cleanLocation === "/settings") return "Settings";

    // Check for checkout route
    if (cleanLocation === "/checkout") return "Checkout";

    // Check for voices route
    if (cleanLocation === "/voices") return "Voices";

    // Check for voice configuration route
    if (cleanLocation === "/voice-configuration") return "Voice Configuration";

    // Check for phone numbers route
    if (cleanLocation === "/phone-numbers") return "Phone Numbers";

    // Check for outbound calling route
    if (cleanLocation === "/outbound-calling") return "Outbound Calling";

    // Check for tools route
    if (cleanLocation === "/tools") return "Tools";

    // Check for conversations route
    if (cleanLocation === "/conversations") return "Conversations";

    // Check for whitelabel settings route
    if (cleanLocation === "/whitelabel-settings") return "Whitelabel Settings";

    // Check for agency users route
    if (cleanLocation === "/agency-users") return "User Management";

    // Default to "Page Not Found" for unknown routes
    return "Page Not Found";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 lg:w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50 transform transition-all duration-300 ease-in-out shadow-xl flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center h-16 px-4 lg:px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-2 lg:space-x-3">
            {whitelabelConfig?.logoUrl ? (
              <img
                src={whitelabelConfig.logoUrl}
                alt="Logo"
                className="w-8 h-8 object-contain rounded"
              />
            ) : (
              <div className="w-8 h-8 brand-gradient rounded-lg flex items-center justify-center shadow-lg">
                <Mic className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="text-base lg:text-lg font-bold brand-gradient-text truncate" data-testid="text-app-title">
              {whitelabelConfig?.appName || "EchoSensei"}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto mt-6 px-3 pb-6">
          <div className="space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const cleanLocation = location.replace(/^\/agency\/[a-z0-9-]+/, '');
              const isActive = cleanLocation === item.href || (item.href === '/' && cleanLocation === '');
              return (
                <Link
                  key={item.name}
                  href={buildPath(item.href)}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                    isActive
                      ? "text-white shadow-md"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-600 opacity-100" />
                  )}
                  <Icon className={cn("w-5 h-5 transition-transform duration-200 relative z-10", isActive && "scale-110")} />
                  <span className="relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-1">
              {user?.isAdmin && (
                <Link
                  href={buildPath("/admin")}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-250 group hover-lift-subtle",
                    location.replace(/^\/agency\/[a-z0-9-]+/, '') === "/admin"
                      ? "brand-gradient text-white shadow-lg ring-accent"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:shadow-md"
                  )}
                  data-testid="nav-admin"
                >
                  <Shield className={cn("w-5 h-5 transition-transform duration-250", location.replace(/^\/agency\/[a-z0-9-]+/, '') === "/admin" && "scale-110")} />
                  <span>Admin</span>
                </Link>
              )}
              {/* Show whitelabel settings to agency owners or users with manage_branding permission */}
              {isAgency && !isAdmin && (userRole === 'agency' || userPermissions.includes('manage_branding')) && (
                <Link
                  href={buildPath("/whitelabel-settings")}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-250 group hover-lift-subtle",
                    location.replace(/^\/agency\/[a-z0-9-]+/, '') === "/whitelabel-settings"
                      ? "brand-gradient text-white shadow-lg ring-accent"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:shadow-md"
                  )}
                  data-testid="nav-whitelabel"
                >
                  <Palette className={cn("w-5 h-5 transition-transform duration-250", location.replace(/^\/agency\/[a-z0-9-]+/, '') === "/whitelabel-settings" && "scale-110")} />
                  <span>Whitelabel</span>
                </Link>
              )}
              {/* Show user management to agency owners or users with manage_users permission */}
              {isAgency && !isAdmin && (userRole === 'agency' || userPermissions.includes('manage_users')) && (
                <Link
                  href={buildPath("/agency-users")}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-250 group hover-lift-subtle",
                    location.replace(/^\/agency\/[a-z0-9-]+/, '') === "/agency-users"
                      ? "brand-gradient text-white shadow-lg ring-accent"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:shadow-md"
                  )}
                  data-testid="nav-agency-users"
                >
                  <Users className={cn("w-5 h-5 transition-transform duration-250", location.replace(/^\/agency\/[a-z0-9-]+/, '') === "/agency-users" && "scale-110")} />
                  <span>User Management</span>
                </Link>
              )}
              {secondaryNavigation.map((item) => {
                const Icon = item.icon;
                const cleanLocation = location.replace(/^\/agency\/[a-z0-9-]+/, '');
                const isActive = cleanLocation === item.href;
                return (
                  <Link
                    key={item.name}
                    href={buildPath(item.href)}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-250 hover-lift-subtle",
                      isActive
                        ? "brand-gradient text-white shadow-lg ring-accent"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:shadow-md"
                    )}
                    data-testid={`nav-${item.name.toLowerCase()}`}
                  >
                    <Icon className={cn("w-5 h-5 transition-transform duration-250", isActive && "scale-110")} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className={cn(
          "bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between transition-all duration-300",
          elevated ? "header-elevated" : "shadow-sm"
        )}>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="button-toggle-sidebar"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="ml-4 lg:ml-0 text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate" data-testid="text-page-title">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
              className="hidden sm:flex"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 brand-gradient rounded-full flex items-center justify-center shadow-lg ring-2 ring-primary/20 transition-all duration-250 hover:ring-primary/40 hover:scale-105">
                <span className="text-white text-xs sm:text-sm font-medium" data-testid="text-user-initials">
                  {typedUser?.firstName?.[0]}{typedUser?.lastName?.[0]}
                </span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100" data-testid="text-user-name">
                  {typedUser?.firstName} {typedUser?.lastName}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400" data-testid="text-organization-name">
                  Organization
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  // Call logout endpoint then redirect to home page
                  try {
                    await fetch("/api/logout", {
                      method: "GET",
                      credentials: "same-origin"
                    });
                    // Clear the auth query cache to ensure fresh auth check
                    queryClient.removeQueries({ queryKey: ["/api/auth/user"] });
                    // Redirect to home page which will show the landing page
                    window.location.href = "/";
                  } catch (error) {
                    console.error("Logout error:", error);
                    // Even on error, redirect to home
                    window.location.href = "/";
                  }
                }}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 fade-in">
          {children}
        </main>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
