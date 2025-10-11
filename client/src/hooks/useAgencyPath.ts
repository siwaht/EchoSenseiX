import { useLocation } from "wouter";

export function useAgencyPath() {
  const [location] = useLocation();
  
  // Extract agency subdomain from path if present
  const match = location.match(/^\/agency\/([a-z0-9-]+)/);
  const agencySubdomain = match ? match[1] : null;
  const isAgencyView = !!agencySubdomain;
  
  // Helper function to build paths that preserve agency context
  const buildPath = (path: string) => {
    if (!isAgencyView) {
      return path;
    }
    
    // Remove leading slash from path if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // If it's the root path, return the agency root
    if (!cleanPath) {
      return `/agency/${agencySubdomain}`;
    }
    
    return `/agency/${agencySubdomain}/${cleanPath}`;
  };
  
  return {
    isAgencyView,
    agencySubdomain,
    buildPath,
  };
}