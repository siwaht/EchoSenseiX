/**
 * Distributed Cache Manager
 *
 * High-performance caching for concurrent requests
 * Supports: In-memory LRU cache, Redis distributed cache
 */

export interface CacheConfig {
  provider: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  ttl?: number; // Default TTL in seconds
  maxSize?: number; // Max items in memory cache
}

export interface CacheProvider {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  getStats(): Promise<{ hits: number; misses: number; size: number }>;
}

/**
 * In-Memory Cache (for single instance)
 */
export class MemoryCacheProvider implements CacheProvider {
  private cache: Map<string, { value: any; expires: number }>;
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.maxSize = config.maxSize || 1000;
    this.startCleanup();
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const expires = Date.now() + (ttl || 3600) * 1000;
    this.cache.set(key, { value, expires });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }

  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}

/**
 * Redis Cache (for distributed systems)
 */
export class RedisCacheProvider implements CacheProvider {
  private redis: any;
  private hits = 0;
  private misses = 0;

  constructor(private config: CacheConfig) {}

  async initialize(): Promise<void> {
    console.log('[CACHE] Connecting to Redis...');

    try {
      // Dynamically import Redis
      const Redis = (await import('ioredis')).default;

      this.redis = new Redis({
        host: this.config.redis?.host || 'localhost',
        port: this.config.redis?.port || 6379,
        password: this.config.redis?.password,
        db: this.config.redis?.db || 0,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.redis.on('error', (err: Error) => {
        console.error('[CACHE] Redis error:', err.message);
      });

      this.redis.on('connect', () => {
        console.log('[CACHE] Connected to Redis');
      });

      await this.redis.ping();
    } catch (error: any) {
      console.error('[CACHE] Failed to connect to Redis:', error.message);
      throw error;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (value === null) {
        this.misses++;
        return null;
      }

      this.hits++;
      return JSON.parse(value) as T;
    } catch (error: any) {
      console.error('[CACHE] Get error:', error.message);
      this.misses++;
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const ttlSeconds = ttl || this.config.ttl || 3600;

      await this.redis.setex(key, ttlSeconds, serialized);
    } catch (error: any) {
      console.error('[CACHE] Set error:', error.message);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error: any) {
      console.error('[CACHE] Delete error:', error.message);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error: any) {
      console.error('[CACHE] Clear error:', error.message);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error: any) {
      console.error('[CACHE] Has error:', error.message);
      return false;
    }
  }

  async getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      size: await this.redis.dbsize(),
    };
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

/**
 * Cache Factory
 */
export class CacheFactory {
  private static instance: CacheProvider | null = null;

  static async getInstance(config?: CacheConfig): Promise<CacheProvider> {
    if (this.instance) {
      return this.instance;
    }

    if (!config) {
      config = this.getConfigFromEnv();
    }

    this.instance = await this.createCache(config);
    return this.instance;
  }

  private static async createCache(config: CacheConfig): Promise<CacheProvider> {
    switch (config.provider) {
      case 'redis': {
        const cache = new RedisCacheProvider(config);
        await cache.initialize();
        return cache;
      }
      case 'memory':
      default:
        return new MemoryCacheProvider(config);
    }
  }

  private static getConfigFromEnv(): CacheConfig {
    const provider = (process.env.CACHE_PROVIDER || 'memory') as CacheConfig['provider'];

    return {
      provider,
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
      ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
    };
  }
}

/**
 * Convenience function to get cache instance
 */
export async function getCache(config?: CacheConfig): Promise<CacheProvider> {
  return CacheFactory.getInstance(config);
}

/**
 * Cache decorator for functions
 */
export function Cached(ttl?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = await getCache();
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await cache.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}
