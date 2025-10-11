import { Request, Response, NextFunction } from 'express';
import { CacheManager } from '../cache/cache-manager';

// Initialize cache manager
const cacheManager = new CacheManager();

interface CacheOptions {
  ttl?: number;           // Time to live in milliseconds
  key?: string | ((req: Request) => string);
  condition?: (req: Request) => boolean;
  invalidatePattern?: string;
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

// Create cache middleware
export function createCacheMiddleware(options: CacheOptions = {}) {
  const {
    ttl = 60000,  // 1 minute default
    key,
    condition = () => true,
    invalidatePattern
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

    // Try to get from cache
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      // Add cache hit header
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', ttl.toString());
      return res.json(cached);
    }

    // Cache miss - capture response and cache it
    const originalJson = res.json;
    res.json = function(data: any) {
      // Add cache miss header
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-TTL', ttl.toString());
      
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

// Pre-configured cache middleware for common endpoints
export const cacheMiddleware = {
  // Short cache for frequently changing data
  short: createCacheMiddleware({
    ttl: 30 * 1000,  // 30 seconds
  }),

  // Standard cache for normal API responses
  standard: createCacheMiddleware({
    ttl: 60 * 1000,  // 1 minute
  }),

  // Long cache for rarely changing data
  long: createCacheMiddleware({
    ttl: 5 * 60 * 1000,  // 5 minutes
  }),

  // Very long cache for static data
  static: createCacheMiddleware({
    ttl: 60 * 60 * 1000,  // 1 hour
  }),

  // Organization-specific cache
  organization: createCacheMiddleware({
    ttl: 2 * 60 * 1000,  // 2 minutes
    key: (req) => {
      const user = (req as any).user;
      return `org:${user?.organizationId}:${req.path}`;
    }
  }),

  // User-specific cache
  user: createCacheMiddleware({
    ttl: 60 * 1000,  // 1 minute
    key: (req) => {
      const user = (req as any).user;
      return `user:${user?.id}:${req.path}`;
    }
  }),

  // Analytics cache (longer TTL)
  analytics: createCacheMiddleware({
    ttl: 10 * 60 * 1000,  // 10 minutes
    key: (req) => {
      const user = (req as any).user;
      const params = new URLSearchParams(req.query as any).toString();
      return `analytics:${user?.organizationId}:${params}`;
    }
  }),

  // Agent list cache
  agents: createCacheMiddleware({
    ttl: 2 * 60 * 1000,  // 2 minutes
    key: (req) => {
      const user = (req as any).user;
      return `agents:${user?.organizationId}:${user?.id}`;
    },
    invalidatePattern: 'agents:{org}:*'
  }),

  // Call logs cache
  callLogs: createCacheMiddleware({
    ttl: 60 * 1000,  // 1 minute
    key: (req) => {
      const user = (req as any).user;
      const params = new URLSearchParams(req.query as any).toString();
      return `call-logs:${user?.organizationId}:${params}`;
    },
    invalidatePattern: 'call-logs:{org}:*'
  })
};

// Cache invalidation helper
export async function invalidateCache(pattern: string, organizationId?: string) {
  const finalPattern = pattern.replace('{org}', organizationId || '*');
  await cacheManager.invalidate(finalPattern);
}

// Get cache statistics
export async function getCacheStats() {
  return cacheManager.getStats();
}

export default createCacheMiddleware;