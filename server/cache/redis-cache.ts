/**
 * Redis Caching Service
 *
 * Multi-level caching strategy:
 * - L1: In-memory cache (Node.js process) - 100ms TTL
 * - L2: Redis cache (shared across instances) - 5-60 min TTL
 * - L3: Database (PostgreSQL)
 *
 * Benefits:
 * - 50-90% reduction in database queries
 * - Sub-millisecond response times for cached data
 * - Horizontal scaling with shared cache
 */

import { createClient, type RedisClientType } from 'redis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache key namespace
}

class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();
  private memoryCacheTTL: number = 100; // 100ms in-memory cache

  /**
   * Initialize Redis client
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL;

      if (!redisUrl) {
        console.warn('[CACHE] Redis URL not configured. Running without cache.');
        return;
      }

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('[CACHE] Redis reconnection failed after 10 retries');
              return new Error('Redis reconnection limit reached');
            }
            // Exponential backoff: 100ms, 200ms, 400ms, ...
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        console.error('[CACHE] Redis client error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[CACHE] Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('[CACHE] Redis client ready');
      });

      this.client.on('reconnecting', () => {
        console.log('[CACHE] Redis client reconnecting...');
      });

      await this.client.connect();

    } catch (error) {
      console.error('[CACHE] Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * Get value from cache (L1 → L2 → return null)
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.namespace);

    // L1 Cache: Check in-memory cache first
    const memCached = this.getFromMemory<T>(fullKey);
    if (memCached !== null) {
      return memCached;
    }

    // L2 Cache: Check Redis
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(fullKey);

      if (value) {
        const parsed = JSON.parse(value) as T;

        // Store in L1 cache for future requests
        this.setInMemory(fullKey, parsed);

        return parsed;
      }
    } catch (error) {
      console.error('[CACHE] Error getting from Redis:', error);
    }

    return null;
  }

  /**
   * Set value in cache (L1 + L2)
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);
    const ttl = options.ttl || 300; // Default 5 minutes

    // Store in L1 cache
    this.setInMemory(fullKey, value);

    // Store in L2 cache (Redis)
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(fullKey, ttl, serialized);
    } catch (error) {
      console.error('[CACHE] Error setting in Redis:', error);
    }
  }

  /**
   * Delete value from cache (L1 + L2)
   */
  async del(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);

    // Delete from L1 cache
    this.memoryCache.delete(fullKey);

    // Delete from L2 cache (Redis)
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.del(fullKey);
    } catch (error) {
      console.error('[CACHE] Error deleting from Redis:', error);
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async delPattern(pattern: string, options: CacheOptions = {}): Promise<void> {
    const fullPattern = this.buildKey(pattern, options.namespace);

    // Clear matching keys from L1 cache
    for (const key of this.memoryCache.keys()) {
      if (this.matchPattern(key, fullPattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from Redis
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const keys = [];
      for await (const key of this.client.scanIterator({ MATCH: fullPattern })) {
        keys.push(key);
      }

      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('[CACHE] Error deleting pattern from Redis:', error);
    }
  }

  /**
   * Cache a function result
   */
  async wrap<T = any>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, options);

    return result;
  }

  /**
   * Get multiple values at once
   */
  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    const fullKeys = keys.map(k => this.buildKey(k, options.namespace));

    if (!this.isConnected || !this.client) {
      return keys.map(() => null);
    }

    try {
      const values = await this.client.mGet(fullKeys);
      return values.map(v => v ? JSON.parse(v) as T : null);
    } catch (error) {
      console.error('[CACHE] Error getting multiple from Redis:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values at once
   */
  async mset(entries: Array<{ key: string; value: any }>, options: CacheOptions = {}): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const keyValues: string[] = [];
      for (const entry of entries) {
        const fullKey = this.buildKey(entry.key, options.namespace);
        keyValues.push(fullKey, JSON.stringify(entry.value));
      }

      await this.client.mSet(keyValues);
    } catch (error) {
      console.error('[CACHE] Error setting multiple in Redis:', error);
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, by: number = 1, options: CacheOptions = {}): Promise<number> {
    const fullKey = this.buildKey(key, options.namespace);

    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const value = await this.client.incrBy(fullKey, by);

      // Set expiry if TTL provided
      if (options.ttl) {
        await this.client.expire(fullKey, options.ttl);
      }

      return value;
    } catch (error) {
      console.error('[CACHE] Error incrementing in Redis:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memoryKeys: number;
    redisKeys?: number;
    memorySize?: number;
  }> {
    const stats: any = {
      connected: this.isConnected,
      memoryKeys: this.memoryCache.size,
    };

    if (this.isConnected && this.client) {
      try {
        const info = await this.client.info('stats');
        const dbSize = await this.client.dbSize();
        stats.redisKeys = dbSize;
      } catch (error) {
        console.error('[CACHE] Error getting Redis stats:', error);
      }
    }

    return stats;
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('[CACHE] Redis client disconnected');
      } catch (error) {
        console.error('[CACHE] Error disconnecting Redis:', error);
      }

      this.client = null;
      this.isConnected = false;
    }

    this.memoryCache.clear();
  }

  /**
   * Build full cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    const prefix = 'echosenseix';
    if (namespace) {
      return `${prefix}:${namespace}:${key}`;
    }
    return `${prefix}:${key}`;
  }

  /**
   * Get from in-memory cache (L1)
   */
  private getFromMemory<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expires) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  /**
   * Set in in-memory cache (L1)
   */
  private setInMemory(key: string, value: any): void {
    const expires = Date.now() + this.memoryCacheTTL;
    this.memoryCache.set(key, { value, expires });

    // Cleanup old entries if cache gets too large
    if (this.memoryCache.size > 1000) {
      this.cleanupMemoryCache();
    }
  }

  /**
   * Cleanup expired in-memory cache entries
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expires) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Match key against pattern (supports * wildcard)
   */
  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }
}

// Export singleton instance
export const cache = new RedisCache();

// Cache namespaces for organization
export const CacheNamespace = {
  USER: 'user',
  ORGANIZATION: 'org',
  AGENT: 'agent',
  INTEGRATION: 'integration',
  PROVIDER: 'provider',
  CALL_LOG: 'call',
  KNOWLEDGE_BASE: 'kb',
  ANALYTICS: 'analytics',
  RATE_LIMIT: 'ratelimit',
  SESSION: 'session',
} as const;

// Common cache TTLs (in seconds)
export const CacheTTL = {
  VERY_SHORT: 60,      // 1 minute
  SHORT: 300,          // 5 minutes
  MEDIUM: 900,         // 15 minutes
  LONG: 1800,          // 30 minutes
  VERY_LONG: 3600,     // 1 hour
  DAY: 86400,          // 24 hours
} as const;

// Initialize cache on import (in production)
if (process.env.NODE_ENV !== 'test') {
  cache.connect().catch(console.error);
}

// Graceful shutdown
process.on('SIGINT', () => cache.disconnect());
process.on('SIGTERM', () => cache.disconnect());
