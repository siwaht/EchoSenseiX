import { useEffect } from 'react';

interface ResourceHintsProps {
  preconnect?: string[];
  prefetch?: string[];
  preload?: Array<{
    href: string;
    as: 'script' | 'style' | 'image' | 'font' | 'fetch';
    type?: string;
    crossOrigin?: 'anonymous' | 'use-credentials';
  }>;
  dns?: string[];
}

export function ResourceHints({
  preconnect = [],
  prefetch = [],
  preload = [],
  dns = [],
}: ResourceHintsProps) {
  // Add default critical resources
  const defaultPreconnect = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ].filter(Boolean);

  const defaultDns = [
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
  ];

  // Programmatically add resource hints
  useEffect(() => {
    const head = document.head;
    const hints: HTMLLinkElement[] = [];
    const metaTags: HTMLMetaElement[] = [];

    // Add meta tag for DNS prefetch control
    if (!document.querySelector('meta[http-equiv="x-dns-prefetch-control"]')) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'x-dns-prefetch-control';
      meta.content = 'on';
      head.appendChild(meta);
      metaTags.push(meta);
    }

    // Add preconnect hints
    [...defaultPreconnect, ...preconnect].forEach((url) => {
      if (!document.querySelector(`link[rel="preconnect"][href="${url}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = url;
        link.crossOrigin = 'anonymous';
        head.appendChild(link);
        hints.push(link);
      }
    });

    // Add DNS prefetch hints
    [...defaultDns, ...dns].forEach((url) => {
      if (!document.querySelector(`link[rel="dns-prefetch"][href="${url}"]`)) {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = url;
        head.appendChild(link);
        hints.push(link);
      }
    });

    // Add prefetch hints for next likely navigation
    prefetch.forEach((url) => {
      if (!document.querySelector(`link[rel="prefetch"][href="${url}"]`)) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        head.appendChild(link);
        hints.push(link);
      }
    });

    // Add preload hints for critical resources
    preload.forEach((resource) => {
      const selector = `link[rel="preload"][href="${resource.href}"]`;
      if (!document.querySelector(selector)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource.href;
        link.as = resource.as;
        if (resource.type) {
          link.type = resource.type;
        }
        if (resource.crossOrigin) {
          link.crossOrigin = resource.crossOrigin;
        }
        head.appendChild(link);
        hints.push(link);
      }
    });

    // Cleanup function
    return () => {
      hints.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
      metaTags.forEach((meta) => {
        if (meta.parentNode) {
          meta.parentNode.removeChild(meta);
        }
      });
    };
  }, [preconnect, prefetch, preload, dns]);

  return null;
}

// Hook to dynamically add resource hints based on user interaction
export function useResourceHints() {
  const prefetchResource = (url: string) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
      }, 1);
    }
  };

  const preloadResource = (
    href: string,
    as: 'script' | 'style' | 'image' | 'font' | 'fetch',
    type?: string
  ) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (type) {
      link.type = type;
    }
    document.head.appendChild(link);
  };

  const preconnectOrigin = (url: string) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  };

  // Prefetch on hover with debounce
  const prefetchOnHover = (url: string) => {
    let timeoutId: NodeJS.Timeout;

    return {
      onMouseEnter: () => {
        timeoutId = setTimeout(() => {
          prefetchResource(url);
        }, 100); // Wait 100ms to avoid prefetching on accidental hover
      },
      onMouseLeave: () => {
        clearTimeout(timeoutId);
      },
    };
  };

  // Prefetch visible links using Intersection Observer
  const prefetchVisibleLinks = (selector: string = 'a[href]') => {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLAnchorElement;
            const href = link.href;

            // Only prefetch internal links
            if (href && href.startsWith(window.location.origin)) {
              prefetchResource(href);
              observer.unobserve(link);
            }
          }
        });
      },
      {
        rootMargin: '0px 0px 50px 0px', // Start prefetching when link is 50px from viewport
      }
    );

    // Observe all links
    document.querySelectorAll(selector).forEach((link) => {
      observer.observe(link);
    });

    return () => {
      observer.disconnect();
    };
  };

  return {
    prefetchResource,
    preloadResource,
    preconnectOrigin,
    prefetchOnHover,
    prefetchVisibleLinks,
  };
}

// Component to prefetch routes based on user behavior
export function RoutePrefetcher({ routes }: { routes: string[] }) {
  const { prefetchVisibleLinks } = useResourceHints();

  useEffect(() => {
    // Prefetch routes when idle
    if (!('requestIdleCallback' in window)) return;

    const handle = requestIdleCallback(() => {
      routes.forEach((route) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        document.head.appendChild(link);
      });
    });

    return () => {
      if ('cancelIdleCallback' in window) {
        cancelIdleCallback(handle);
      }
    };
  }, [routes]);

  useEffect(() => {
    // Prefetch visible links
    const cleanup = prefetchVisibleLinks();
    return cleanup;
  }, []);

  return null;
}

export default ResourceHints;
