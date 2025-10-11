import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/layout/app-shell";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { AgentProvider } from "@/contexts/agent-context";
import { WhitelabelProvider } from "@/contexts/whitelabel-context";

// Eagerly load critical pages
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

// Lazy load secondary pages
const Agents = lazy(() => import("@/pages/agents"));
const Voices = lazy(() => import("@/pages/voices"));
const History = lazy(() => import("@/pages/history"));
const Integrations = lazy(() => import("@/pages/integrations"));
const Billing = lazy(() => import("@/pages/billing"));
const Settings = lazy(() => import("@/pages/settings"));
const Admin = lazy(() => import("@/pages/admin-new"));
// Removed Checkout - using unified-checkout component instead
const Playground = lazy(() => import("@/pages/playground"));
const PhoneNumbers = lazy(() => import("@/pages/phone-numbers"));
const OutboundCalling = lazy(() => import("@/pages/outbound-calling"));
const Tools = lazy(() => import("@/pages/tools"));
const AgentSettings = lazy(() => import("@/pages/agent-settings"));
const AgentTesting = lazy(() => import("@/pages/agent-testing"));
const WhitelabelSettings = lazy(() => import("@/pages/whitelabel-settings"));
const AgencyUsers = lazy(() => import("@/pages/agency-users"));
const AgencyBillingSettings = lazy(() => import("@/pages/agency-billing-settings"));
// Removed AgencyCheckout - using unified-checkout component instead
const VoiceConfiguration = lazy(() => import("@/pages/voice-configuration"));

// Loading fallback component with elegant brand gradient ring
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
        <div 
          className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
          style={{
            borderTopColor: 'var(--primary)',
            borderRightColor: 'var(--primary)',
            filter: 'drop-shadow(0 0 8px color-mix(in hsl, var(--primary) 40%, transparent))'
          }}
        ></div>
      </div>
    </div>
  );
}

// Agency-specific routing wrapper
function AgencyRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while authentication is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
          <div 
            className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
            style={{
              borderTopColor: 'var(--primary)',
              borderRightColor: 'var(--primary)',
              filter: 'drop-shadow(0 0 12px color-mix(in hsl, var(--primary) 50%, transparent))'
            }}
          ></div>
        </div>
      </div>
    );
  }

  // Redirect to landing page if not authenticated
  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <AgentProvider>
      <AppShell>
        <Suspense fallback={<PageLoader />}>
          <Switch>
          <Route path="/agency/:subdomain" component={Dashboard} />
          <Route path="/agency/:subdomain/agents">
            <PermissionGuard><Agents /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/agents/:id">
            <PermissionGuard><AgentSettings /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/agent-testing" component={AgentTesting} />
          <Route path="/agency/:subdomain/voices">
            <PermissionGuard><Voices /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/voice-configuration">
            <PermissionGuard><VoiceConfiguration /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/phone-numbers">
            <PermissionGuard><PhoneNumbers /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/outbound-calling">
            <PermissionGuard><OutboundCalling /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/tools">
            <PermissionGuard><Tools /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/playground">
            <PermissionGuard><Playground /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/history">
            <PermissionGuard><History /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/integrations">
            <PermissionGuard><Integrations /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/billing">
            <PermissionGuard><Billing /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/settings" component={Settings} />
          <Route path="/agency/:subdomain/admin">
            <PermissionGuard permission="manage_users"><Admin /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/whitelabel-settings">
            <PermissionGuard><WhitelabelSettings /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/agency-users">
            <PermissionGuard><AgencyUsers /></PermissionGuard>
          </Route>
          <Route path="/agency/:subdomain/agency-billing-settings">
            <PermissionGuard><AgencyBillingSettings /></PermissionGuard>
          </Route>
        </Switch>
      </Suspense>
    </AppShell>
    </AgentProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const isAgencyPath = location.startsWith('/agency/');

  // For agency paths, use the agency router
  if (isAgencyPath) {
    return <AgencyRouter />;
  }

  // Show loading spinner while authentication is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
          <div 
            className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
            style={{
              borderTopColor: 'var(--primary)',
              borderRightColor: 'var(--primary)',
              filter: 'drop-shadow(0 0 12px color-mix(in hsl, var(--primary) 50%, transparent))'
            }}
          ></div>
        </div>
      </div>
    );
  }

  // Redirect to landing page if not authenticated
  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <AgentProvider>
      <AppShell>
        <Suspense fallback={<PageLoader />}>
          <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/agents">
            <PermissionGuard><Agents /></PermissionGuard>
          </Route>
          <Route path="/agents/:id">
            <PermissionGuard><AgentSettings /></PermissionGuard>
          </Route>
          <Route path="/agent-testing" component={AgentTesting} />
          <Route path="/voices">
            <PermissionGuard><Voices /></PermissionGuard>
          </Route>
          <Route path="/voice-configuration">
            <PermissionGuard><VoiceConfiguration /></PermissionGuard>
          </Route>
          <Route path="/phone-numbers">
            <PermissionGuard><PhoneNumbers /></PermissionGuard>
          </Route>
          <Route path="/outbound-calling">
            <PermissionGuard><OutboundCalling /></PermissionGuard>
          </Route>
          <Route path="/tools">
            <PermissionGuard><Tools /></PermissionGuard>
          </Route>
          <Route path="/playground">
            <PermissionGuard><Playground /></PermissionGuard>
          </Route>
          <Route path="/history">
            <PermissionGuard><History /></PermissionGuard>
          </Route>
          <Route path="/integrations">
            <PermissionGuard><Integrations /></PermissionGuard>
          </Route>
          <Route path="/billing">
            <PermissionGuard><Billing /></PermissionGuard>
          </Route>
          <Route path="/settings" component={Settings} />
          <Route path="/admin">
            <PermissionGuard permission="manage_users"><Admin /></PermissionGuard>
          </Route>
          <Route path="/whitelabel-settings">
            <PermissionGuard><WhitelabelSettings /></PermissionGuard>
          </Route>
          <Route path="/agency-users">
            <PermissionGuard><AgencyUsers /></PermissionGuard>
          </Route>
          <Route path="/agency-billing-settings">
            <PermissionGuard><AgencyBillingSettings /></PermissionGuard>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppShell>
    </AgentProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <WhitelabelProvider>
            <TooltipProvider>
              <Toaster />
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </TooltipProvider>
          </WhitelabelProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
