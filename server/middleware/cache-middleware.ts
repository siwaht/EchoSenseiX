import { Request, Response, NextFunction } from 'express';
import { cacheManagers, CacheManager } from '../cache/cache-manager';

interface CacheOptions {
  ttl?: number;           // Time to live in milliseconds
  key?: string | ((req: Request) => string);
  condition?: (req: Request) => boolean;
  invalidatePattern?: string;
  cacheManager?: CacheManager; // Add cacheManager to interface
}

// Default cache key generator
const defaultKeyGenerator = (req: Request): string => {
  const user = (req as any).user;
  const userId = user?.id || 'anonymous';
  const organizationId = user?.organizationId || 'global';
  
  // Include query params in cache key
  const queryString = Object.keys(req.query).length > 0 
    ? '?' + new URLSearchParams(req.query as any).toString()
    : '';
  
  return `api:${organizationId}:${userId}:${req.path}${queryString}`;
};

// Create cache middleware with improved caching strategies
export function createCacheMiddleware(options: CacheOptions = {}) {
  const {
    ttl = 5 * 60 * 1000,  // 5 minutes default (increased from 1)
    key,
    condition = () => true,
    invalidatePattern,
    cacheManager = cacheManagers.default() // Allow custom cache manager
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      // If it's a mutation, invalidate related cache
      if (invalidatePattern && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const pattern = invalidatePattern.replace('{org}', (req as any).user?.organizationId || '*');
        await cacheManager.invalidate(pattern);
      }
      return next();
    }

    // Check condition
    if (!condition(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = typeof key === 'function' 
      ? key(req) 
      : typeof key === 'string' 
        ? key 
        : defaultKeyGenerator(req);

    // Use stale-while-revalidate for better performance
    const useStaleWhileRevalidate = ttl > 60000; // Use for caches > 1 minute

    if (useStaleWhileRevalidate) {
      // Try stale-while-revalidate pattern
      try {
        const data = await cacheManager.getStaleWhileRevalidate(
          cacheKey,
          async () => {
            // This will be called if cache miss or background revalidation
            return new Promise((resolve, reject) => {
              const originalJson = res.json;
              res.json = function(data: any) {
                resolve(data);
                return originalJson.call(this, data);
              };
              // Continue with request handling
              next();
            });
          },
          { ttl }
        );
        
        // Only set headers if response hasn't been sent yet
        if (!res.headersSent) {
          res.setHeader('X-Cache', 'HIT-STALE');
          res.setHeader('X-Cache-TTL', ttl.toString());
          return res.json(data);
        }
        return;
      } catch (error) {
        // Fall through to normal handling
      }
    }

    // Try to get from cache (normal flow)
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      // Add cache hit header
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', ttl.toString());
      res.setHeader('Cache-Control', `private, max-age=${Math.floor(ttl / 1000)}`);
      return res.json(cached);
    }

    // Cache miss - capture response and cache it
    const originalJson = res.json;
    res.json = function(data: any) {
      // Add cache headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-TTL', ttl.toString());
      res.setHeader('Cache-Control', `private, max-age=${Math.floor(ttl / 1000)}`);
      
      // Cache successful responses only
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheManager.set(cacheKey, data, { ttl }).catch(() => {
          // Silent fail - caching is not critical
        });
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
}

// Pre-configured cache middleware with optimized TTLs
export const cacheMiddleware = {
  // Short cache for frequently changing data
  short: createCacheMiddleware({
    ttl: 60 * 1000,  // 1 minute (increased from 30s)
    cacheManager: cacheManagers.default()
  }),

  // Standard cache for normal API responses
  standard: createCacheMiddleware({
    ttl: 5 * 60 * 1000,  // 5 minutes (increased from 1)
    cacheManager: cacheManagers.default()
  }),

  // Long cache for rarely changing data
  long: createCacheMiddleware({
    ttl: 30 * 60 * 1000,  // 30 minutes (increased from 5)
    cacheManager: cacheManagers.static()
  }),

  // Very long cache for static data
  static: createCacheMiddleware({
    ttl: 2 * 60 * 60 * 1000,  // 2 hours (increased from 1)
    cacheManager: cacheManagers.static()
  }),

  // Organization-specific cache
  organization: createCacheMiddleware({
    ttl: 10 * 60 * 1000,  // 10 minutes (increased from 2)
    key: (req) => {
      const user = (req as any).user;
      return `org:${user?.organizationId}:${req.path}`;
    },
    cacheManager: cacheManagers.default()
  }),

  // User-specific cache
  user: createCacheMiddleware({
    ttl: 5 * 60 * 1000,  // 5 minutes (increased from 1)
    key: (req) => {
      const user = (req as any).user;
      return `user:${user?.id}:${req.path}`;
    },
    cacheManager: cacheManagers.user()
  }),

  // Analytics cache (longer TTL)
  analytics: createCacheMiddleware({
    ttl: 30 * 60 * 1000,  // 30 minutes (increased from 10)
    key: (req) => {
      const user = (req as any).user;
      const params = new URLSearchParams(req.query as any).toString();
      return `analytics:${user?.organizationId}:${params}`;
    },
    cacheManager: cacheManagers.analytics()
  }),

  // Agent list cache
  agents: createCacheMiddleware({
    ttl: 10 * 60 * 1000,  // 10 minutes (increased from 2)
    key: (req) => {
      const user = (req as any).user;
      return `agents:${user?.organizationId}:${user?.id}`;
    },
    invalidatePattern: 'agents:{org}:*',
    cacheManager: cacheManagers.agents()
  }),

  // Call logs cache
  callLogs: createCacheMiddleware({
    ttl: 5 * 60 * 1000,  // 5 minutes (increased from 1)
    key: (req) => {
      const user = (req as any).user;
      const params = new URLSearchParams(req.query as any).toString();
      return `call-logs:${user?.organizationId}:${params}`;
    },
    invalidatePattern: 'call-logs:{org}:*',
    cacheManager: cacheManagers.default()
  })
};

// Cache invalidation helper for all cache managers
export async function invalidateCache(pattern: string, organizationId?: string) {
  const finalPattern = pattern.replace('{org}', organizationId || '*');
  
  // Invalidate across all cache managers
  await Promise.all([
    cacheManagers.default().invalidate(finalPattern),
    cacheManagers.agents().invalidate(finalPattern),
    cacheManagers.analytics().invalidate(finalPattern),
    cacheManagers.user().invalidate(finalPattern),
    cacheManagers.static().invalidate(finalPattern)
  ]);
}

// Get aggregated cache statistics
export async function getCacheStats() {
  const stats = {
    default: cacheManagers.default().getStats(),
    agents: cacheManagers.agents().getStats(),
    analytics: cacheManagers.analytics().getStats(),
    user: cacheManagers.user().getStats(),
    static: cacheManagers.static().getStats(),
  };
  
  // Calculate total stats
  const total = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: '0.00%'
  };
  
  Object.values(stats).forEach(stat => {
    total.hits += stat.hits;
    total.misses += stat.misses;
    total.size += stat.size;
  });
  
  if (total.hits + total.misses > 0) {
    total.hitRate = `${(total.hits / (total.hits + total.misses) * 100).toFixed(2)}%`;
  }
  
  return { ...stats, total };
}

export default createCacheMiddleware;