import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Get base domain from environment or use default for development
// const BASE_DOMAIN = process.env.BASE_DOMAIN || 'localhost:5000';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface SubdomainRequest extends Request {
  subdomain?: string;
  subdomainOrg?: any;
}

export async function subdomainMiddleware(req: SubdomainRequest, _res: Response, next: NextFunction) {
  // Get the full hostname
  const hostname = req.hostname || req.get('host')?.split(':')[0] || '';

  // In development, also check for subdomain query parameter for testing
  // e.g., ?subdomain=agency-name
  let possibleSubdomain: string | undefined;

  if (!IS_PRODUCTION && req.query.subdomain) {
    // Development mode: use query parameter if provided
    possibleSubdomain = req.query.subdomain as string;
  } else {
    // Extract subdomain from hostname
    // For development: subdomain.localhost:5000 or localhost:5000?subdomain=agency
    // For production: subdomain.your-domain.com or custom domain
    const parts = hostname.split('.');

    // Skip if no subdomain or if it's just localhost/main domain
    if (parts.length < 2 || parts[0] === 'www' || (parts[0] === 'localhost' && !req.query.subdomain)) {
      return next();
    }

    // Check if it's a subdomain pattern
    possibleSubdomain = parts[0];
  }

  // Store subdomain in request for later use
  req.subdomain = possibleSubdomain;

  try {
    // Try to find organization by subdomain
    if (possibleSubdomain) {
      const org = await storage.getOrganizationBySubdomain(possibleSubdomain);

      if (!org) {
        // Also check for custom domain
        const orgByDomain = await storage.getOrganizationByCustomDomain(hostname);
        if (orgByDomain) {
          req.subdomainOrg = orgByDomain;
        }
      } else {
        req.subdomainOrg = org;
      }
    }
  } catch (error) {
    console.error('Error loading organization by subdomain:', error);
  }

  next();
}

export function requireSubdomainOrg(req: SubdomainRequest, res: Response, next: NextFunction) {
  if (!req.subdomainOrg) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }
  next();
}