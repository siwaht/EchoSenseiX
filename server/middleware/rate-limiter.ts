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

// In-memory store (can be replaced with Redis for distributed systems)
class RateLimitStore {
  private store: Map<string, RequestCount> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (value.resetTime <= now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  increment(key: string, windowMs: number): number {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime <= now) {
      // New window
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return 1;
    }

    // Increment existing window
    entry.count++;
    return entry.count;
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global store instance
const globalStore = new RateLimitStore();

// Default key generator (by IP and user ID)
const defaultKeyGenerator = (req: Request): string => {
  const user = (req as any).user;
  const userId = user?.id || 'anonymous';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return `${userId}:${ip}`;
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
    const requestCount = globalStore.increment(key, windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - requestCount).toString());
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

    // Check if limit exceeded
    if (requestCount > max) {
      res.status(429).json({ 
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
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

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // Strict limit for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                     // 5 requests per 15 minutes
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }),

  // Standard API rate limit
  api: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 100,                   // 100 requests per minute
    message: 'API rate limit exceeded, please slow down.'
  }),

  // Relaxed limit for read operations
  read: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 200,                   // 200 requests per minute
  }),

  // Strict limit for write operations
  write: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 50,                    // 50 requests per minute
    message: 'Too many write operations, please slow down.'
  }),

  // Very strict limit for expensive operations
  expensive: createRateLimiter({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 10,                    // 10 requests per hour
    message: 'This operation is resource-intensive. Please wait before trying again.'
  }),

  // Upload rate limit
  upload: createRateLimiter({
    windowMs: 60 * 1000,        // 1 minute
    max: 10,                    // 10 uploads per minute
    message: 'Upload rate limit exceeded.'
  })
};

// Cleanup on process exit
process.on('exit', () => {
  globalStore.destroy();
});

export default createRateLimiter;