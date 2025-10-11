import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface WhitelabelConfig {
  id: string;
  organizationId: string;
  appName: string;
  companyName: string;
  removePlatformBranding: boolean;
  supportUrl?: string;
  documentationUrl?: string;
  logoUrl?: string;
  faviconUrl?: string;
  subdomain?: string;
}

interface WhitelabelContextValue {
  config: WhitelabelConfig | null;
  isAgencyView: boolean;
  agencySubdomain: string | null;
  isLoading: boolean;
}

const WhitelabelContext = createContext<WhitelabelContextValue | undefined>(undefined);

export function WhitelabelProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [agencySubdomain, setAgencySubdomain] = useState<string | null>(null);
  const [isAgencyView, setIsAgencyView] = useState(false);

  // Detect if we're on an agency path
  useEffect(() => {
    const pathMatch = location.match(/^\/agency\/([a-z0-9-]+)/);
    if (pathMatch) {
      setAgencySubdomain(pathMatch[1]);
      setIsAgencyView(true);
    } else {
      setAgencySubdomain(null);
      setIsAgencyView(false);
    }
  }, [location]);

  // Fetch whitelabel config if on agency path
  const { data: config, isLoading } = useQuery<WhitelabelConfig | null>({
    queryKey: ["/api/whitelabel/public", agencySubdomain],
    enabled: !!agencySubdomain,
    queryFn: async () => {
      const response = await fetch(`/api/whitelabel/public?subdomain=${agencySubdomain}`);
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    retry: false,
  });


  // Apply whitelabel styles
  useEffect(() => {
    if (config && isAgencyView) {
      // Set page title
      if (config.appName) {
        document.title = config.appName;
      }

      // Set favicon if provided
      if (config.faviconUrl) {
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement("link");
        link.type = "image/x-icon";
        link.rel = "shortcut icon";
        link.href = config.faviconUrl;
        document.getElementsByTagName("head")[0].appendChild(link);
      }
    }

    // Cleanup function to reset title when leaving agency view
    return () => {
      if (!isAgencyView) {
        document.title = "VoiceAI Dashboard";
      }
    };
  }, [config, isAgencyView]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ config: config || null, isAgencyView, agencySubdomain, isLoading }),
    [config, isAgencyView, agencySubdomain, isLoading]
  );

  return (
    <WhitelabelContext.Provider value={contextValue}>
      {children}
    </WhitelabelContext.Provider>
  );
}

export function useWhitelabel() {
  const context = useContext(WhitelabelContext);
  if (context === undefined) {
    throw new Error("useWhitelabel must be used within a WhitelabelProvider");
  }
  return context;
}