import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs?: number;     // Time window in milliseconds
  max?: number;          // Max requests per window
  message?: string;      // Error message
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RequestCount {
  count: number;
  resetTime: number;
}

// Sliding window rate limit store for better accuracy
class RateLimitStore {
  private store: Map<string, RequestCount> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private maxEntries: number;

  constructor(maxEntries: number = 100000) {
    this.maxEntries = maxEntries;
    
    // Clean up expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000);
  }

  private cleanup() {
    const now = Date.now();
    let deleted = 0;
    
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime <= now) {
        this.store.delete(key);
        deleted++;
      }
    }
    
    // Emergency cleanup if store is too large
    if (this.store.size > this.maxEntries) {
      const entries = Array.from(this.store.entries())
        .sort((a, b) => a[1].resetTime - b[1].resetTime);
      
      const toDelete = entries.slice(0, Math.floor(this.maxEntries * 0.2));
      for (const [key] of toDelete) {
        this.store.delete(key);
        deleted++;
      }
    }
    
    if (deleted > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[RateLimit] Cleaned up ${deleted} expired entries, ${this.store.size} remaining`);
    }
  }

  increment(key: string, windowMs: number): { count: number; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime <= now) {
      // New window
      const resetTime = now + windowMs;
      this.store.set(key, {
        count: 1,
        resetTime
      });
      return { count: 1, remaining: 0, resetTime };
    }

    // Increment existing window
    entry.count++;
    return { count: entry.count, remaining: entry.resetTime - now, resetTime: entry.resetTime };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  getStats() {
    return {
      size: this.store.size,
      maxEntries: this.maxEntries
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global store instance - sized for concurrent users
const globalStore = new RateLimitStore(100000);

// Default key generator (by IP, user ID, and organization for multi-tenant)
const defaultKeyGenerator = (req: Request): string => {
  const user = (req as any).user;
  const userId = user?.id || 'anonymous';
  const orgId = user?.organizationId || 'default';
  // Use X-Forwarded-For for load balanced environments
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() 
    || req.ip 
    || req.socket.remoteAddress 
    || 'unknown';
  return `${orgId}:${userId}:${ip}`;
};

// Create rate limiter middleware
export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 60000,           // 1 minute default
    max = 100,                  // 100 requests per minute default
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    keyGenerator = defaultKeyGenerator
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const result = globalStore.increment(key, windowMs);
    const remaining = Math.max(0, max - result.count);

    // Set rate limit headers (RFC 6585 compliant)
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
    res.setHeader('RateLimit-Policy', `${max};w=${Math.ceil(windowMs / 1000)}`);

    // Check if limit exceeded
    if (result.count > max) {
      const retryAfter = Math.ceil(result.remaining / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({ 
        error: message,
        retryAfter,
        limit: max,
        windowMs
      });
      return;
    }

    // Optionally skip counting successful requests
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function(data: any) {
        if (res.statusCode < 400) {
          globalStore.reset(key);
        }
        return originalSend.call(this, data);
      };
    }

    next();
  };
}

// Pre-configured rate limiters for different endpoints (scaled for concurrent users)
export const rateLimiters = {
  // Strict limit for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,                    // 10 requests per 15 minutes (increased for legitimate retries)
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }),

  // Standard API rate limit (generous for dashboard usage)
  api: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 200,                   // 200 requests per minute (increased for dashboard polling)
    message: 'API rate limit exceeded, please slow down.'
  }),

  // Relaxed limit for read operations (dashboards need frequent reads)
  read: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 500,                   // 500 requests per minute
  }),

  // Moderate limit for write operations
  write: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 100,                   // 100 requests per minute
    message: 'Too many write operations, please slow down.'
  }),

  // Strict limit for expensive operations (external API calls)
  expensive: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 30,                    // 30 requests per minute
    message: 'This operation is resource-intensive. Please wait before trying again.'
  }),

  // Upload rate limit
  upload: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 20,                    // 20 uploads per minute
    message: 'Upload rate limit exceeded.'
  }),

  // Webhook rate limit (high volume expected)
  webhook: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 1000,                  // 1000 webhooks per minute per source
    message: 'Webhook rate limit exceeded.'
  })
};

// Get rate limiter stats for monitoring
export const getRateLimitStats = () => globalStore.getStats();

// Cleanup on process exit
process.on('exit', () => {
  globalStore.destroy();
});

export default createRateLimiter;