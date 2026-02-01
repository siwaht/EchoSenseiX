import { LRUCache } from 'lru-cache';

interface CacheItem {
  value: any;
  expires: number;
}

interface CacheOptions {
  ttl?: number;  // Time to live in milliseconds
  maxSize?: number; // Maximum cache entries
}

export class CacheManager {
  private cache: LRUCache<string, CacheItem>;
  private hits: number = 0;
  private misses: number = 0;
  private name: string;

  constructor(name: string = 'default', maxSize: number = 10000) {
    this.name = name;
    this.cache = new LRUCache<string, CacheItem>({
      max: maxSize,
      ttl: 4 * 60 * 60 * 1000, // 4 hours max TTL
      allowStale: true, // Allow stale cache while revalidating
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      // Memory-based eviction
      sizeCalculation: (value: CacheItem) => {
        try {
          return JSON.stringify(value).length;
        } catch {
          return 1000; // Default size estimate
        }
      },
      maxSize: 200 * 1024 * 1024, // 200MB max cache size
      // Dispose callback for cleanup
      dispose: (value, key, reason) => {
        if (reason === 'evict' && process.env.NODE_ENV === 'development') {
          console.log(`[Cache:${this.name}] Evicted: ${key}`);
        }
      }
    });
  }

  async get<T = any>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return item.value as T;
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || 5 * 60 * 1000; // Default 5 minutes
    const expires = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expires
    });
  }

  // Get or set with callback (cache-aside pattern)
  async getOrSet<T = any>(key: string, factory: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  // Stale-while-revalidate pattern for better UX
  async getStaleWhileRevalidate<T = any>(
    key: string, 
    factory: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const item = this.cache.get(key);
    
    if (item) {
      this.hits++;
      
      // Revalidate in background if expired
      if (item.expires && item.expires < Date.now()) {
        // Don't await - fire and forget
        factory().then(value => {
          this.set(key, value, options);
        }).catch(err => {
          console.error(`[Cache:${this.name}] Background revalidation failed for ${key}:`, err.message);
        });
      }
      
      return item.value as T;
    }

    // No cache, fetch and store
    this.misses++;
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  // Batch get for efficiency
  async getMany<T = any>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    for (const key of keys) {
      results.set(key, await this.get<T>(key));
    }
    return results;
  }

  // Batch set
  async setMany(entries: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.options);
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidate(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keys = Array.from(this.cache.keys());
    let deleted = 0;
    
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  // Invalidate by prefix (more efficient)
  async invalidatePrefix(prefix: string): Promise<number> {
    const keys = Array.from(this.cache.keys());
    let deleted = 0;
    
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 
      ? (this.hits / total * 100).toFixed(2)
      : '0.00';

    return {
      name: this.name,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.cache.max,
      calculatedSize: this.cache.calculatedSize,
    };
  }

  // Get cache size in bytes (approximate)
  getCacheSizeBytes(): number {
    return this.cache.calculatedSize || 0;
  }
}

// Cache instances for different purposes
const cacheInstances: Map<string, CacheManager> = new Map();

export function getCacheManager(name: string = 'default', maxSize: number = 10000): CacheManager {
  if (!cacheInstances.has(name)) {
    cacheInstances.set(name, new CacheManager(name, maxSize));
  }
  return cacheInstances.get(name)!;
}

// Specialized cache managers with appropriate sizes
export const cacheManagers = {
  default: () => getCacheManager('default', 10000),
  agents: () => getCacheManager('agents', 5000),        // Agent configs
  analytics: () => getCacheManager('analytics', 3000),  // Analytics data
  static: () => getCacheManager('static', 1000),        // Static content
  user: () => getCacheManager('user', 5000),            // User sessions/data
  provider: () => getCacheManager('provider', 2000),    // Provider API responses
  calls: () => getCacheManager('calls', 10000),         // Call logs
};

// Get all cache stats for monitoring
export function getAllCacheStats() {
  const stats: Record<string, ReturnType<CacheManager['getStats']>> = {};
  for (const [name, cache] of cacheInstances) {
    stats[name] = cache.getStats();
  }
  return stats;
}

// Clear all caches
export async function clearAllCaches() {
  for (const cache of cacheInstances.values()) {
    await cache.clear();
  }
}

export default CacheManager;