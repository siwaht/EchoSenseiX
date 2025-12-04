import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Home } from "lucide-react";

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
}

// Map routes to required permissions
// Default pages (voices, agents, playground, history, phone-numbers) don't require explicit permissions
const routePermissions: Record<string, string> = {
  // Default accessible pages - no permission required
  // '/agents': 'manage_agents',
  // '/voices': 'manage_voices', 
  // '/phone-numbers': 'manage_phone_numbers',
  // '/playground': 'access_playground',
  // '/history': 'view_call_history',

  // Pages that still require permissions
  '/outbound-calling': 'make_outbound_calls',
  '/tools': 'configure_tools',
  '/integrations': 'manage_integrations',
  '/billing': 'view_billing',
};

export function PermissionGuard({ children, permission }: PermissionGuardProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  // Get the required permission from the current route
  const requiredPermission = permission || routePermissions[location];

  // Check if user has permission
  const hasPermission = () => {
    if (!user) return false;

    // Admin users have all permissions
    if ((user as any).isAdmin) return true;

    // Dashboard is always accessible
    if (location === '/' || !requiredPermission) return true;

    // Check user permissions
    const userPermissions = (user as any).permissions || [];
    return userPermissions.includes(requiredPermission);
  };

  // Show access denied message if user doesn't have permission
  if (!hasPermission()) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              This page requires "{requiredPermission}" permission.
              Please contact your administrator if you need access.
            </p>
            <Button onClick={() => setLocation("/")} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}