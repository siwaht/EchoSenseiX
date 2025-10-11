import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Map routes to required permissions
const routePermissions: Record<string, string> = {
  '/api/agents': 'manage_agents',
  '/api/voices': 'manage_voices',
  '/api/phone-numbers': 'manage_phone_numbers',
  '/api/outbound-calling': 'make_outbound_calls',
  '/api/tools': 'configure_tools',
  '/api/playground': 'access_playground',
  '/api/call-logs': 'view_call_history',
  '/api/integrations': 'manage_integrations',
  '/api/analytics': 'view_analytics',
  '/api/recordings': 'access_recordings',
  '/api/billing': 'view_billing',
  '/api/users': 'manage_users',
  '/api/settings': 'manage_settings',
  // Agency-specific routes
  '/api/agency/users': 'manage_agency_users',
  '/api/agency/billing': 'view_agency_billing',
  '/api/agency/payment-processors': 'manage_payment_methods',
};

// Check if user has required permission for the route
export const checkPermission = (requiredPermission?: string) => {
  return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    try {
      // Skip permission check if no user is logged in (handled by isAuthenticated)
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get user details with permissions
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Admin users have all permissions
      if (user.isAdmin) {
        return next();
      }

      // If no specific permission is required, allow access
      if (!requiredPermission) {
        return next();
      }

      // Check if user has the required permission
      const userPermissions = user.permissions || [];
      if (!userPermissions.includes(requiredPermission)) {
        return res.status(403).json({ 
          message: "Access denied", 
          error: `Missing required permission: ${requiredPermission}` 
        });
      }

      // Permission granted
      next();
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({ message: "Failed to check permissions" });
    }
  };
};

// Middleware to check route-based permissions
export const checkRoutePermission = async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  try {
    // Skip permission check if no user is logged in
    if (!req.user) {
      return next(); // Let isAuthenticated handle this
    }

    // Find the base route path
    const path = req.path.replace(/\/\d+.*$/, ''); // Remove ID and query params
    const baseRoute = Object.keys(routePermissions).find(route => path.startsWith(route));

    // If no permission is required for this route, allow access
    if (!baseRoute || !routePermissions[baseRoute]) {
      return next();
    }

    // Get user details with permissions
    const user = await storage.getUser(req.user.id);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Admin users have all permissions
    if (user.isAdmin) {
      return next();
    }

    const requiredPermission = routePermissions[baseRoute];
    const userPermissions = user.permissions || [];

    // Check if user has the required permission
    if (!userPermissions.includes(requiredPermission)) {
      console.log(`Access denied for user ${user.email} to ${path}. Missing permission: ${requiredPermission}`);
      return res.status(403).json({ 
        message: "Access denied", 
        error: `You don't have permission to access this resource` 
      });
    }

    // Permission granted
    next();
  } catch (error) {
    console.error("Error checking route permissions:", error);
    return res.status(500).json({ message: "Failed to check permissions" });
  }
};

// Check multiple permissions (user must have at least one)
export const checkAnyPermission = (permissions: string[]) => {
  return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Admin users have all permissions
      if (user.isAdmin) {
        return next();
      }

      const userPermissions = user.permissions || [];
      const hasPermission = permissions.some(permission => userPermissions.includes(permission));

      if (!hasPermission) {
        return res.status(403).json({ 
          message: "Access denied", 
          error: `Missing required permissions: ${permissions.join(' OR ')}` 
        });
      }

      next();
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({ message: "Failed to check permissions" });
    }
  };
};

// Check all permissions (user must have all)
export const checkAllPermissions = (permissions: string[]) => {
  return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Admin users have all permissions
      if (user.isAdmin) {
        return next();
      }

      const userPermissions = user.permissions || [];
      const hasAllPermissions = permissions.every(permission => userPermissions.includes(permission));

      if (!hasAllPermissions) {
        const missingPermissions = permissions.filter(p => !userPermissions.includes(p));
        return res.status(403).json({ 
          message: "Access denied", 
          error: `Missing required permissions: ${missingPermissions.join(', ')}` 
        });
      }

      next();
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({ message: "Failed to check permissions" });
    }
  };
};