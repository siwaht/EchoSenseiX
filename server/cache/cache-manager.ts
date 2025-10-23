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

  constructor(maxSize: number = 5000) { // Increased cache size for better hit rate
    this.cache = new LRUCache<string, CacheItem>({
      max: maxSize,
      ttl: 2 * 60 * 60 * 1000, // 2 hours max TTL for better performance
      allowStale: true, // Allow stale cache while revalidating
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      // Add size calculation for memory management
      sizeCalculation: (value: CacheItem) => {
        try {
          return JSON.stringify(value).length;
        } catch {
          return 1;
        }
      },
      maxSize: 100 * 1024 * 1024, // 100MB max cache size
    });
  }

  async get(key: string): Promise<any | null> {
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
    return item.value;
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || 5 * 60 * 1000; // Default 5 minutes (increased from 1)
    const expires = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expires
    });
  }

  // Add method to get or set with callback
  async getOrSet(key: string, factory: () => Promise<any>, options: CacheOptions = {}): Promise<any> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  // Add method for stale-while-revalidate pattern
  async getStaleWhileRevalidate(
    key: string, 
    factory: () => Promise<any>, 
    options: CacheOptions = {}
  ): Promise<any> {
    const item = this.cache.get(key);
    
    if (item) {
      // Return stale data immediately
      this.hits++;
      
      // Revalidate in background if expired
      if (item.expires && item.expires < Date.now()) {
        factory().then(value => {
          this.set(key, value, options);
        }).catch(() => {
          // Silent fail for background revalidation
        });
      }
      
      return item.value;
    }

    // No cache, fetch and store
    this.misses++;
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keys = Array.from(this.cache.keys());
    
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const hitRate = this.hits + this.misses > 0 
      ? (this.hits / (this.hits + this.misses) * 100).toFixed(2)
      : '0.00';

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.cache.max
    };
  }

  // Get cache size in bytes (approximate)
  getCacheSizeBytes(): number {
    let totalSize = 0;
    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      totalSize += key.length + JSON.stringify(item.value).length;
    }
    return totalSize;
  }
}

// Multiple cache instances for different purposes
let cacheInstances: Map<string, CacheManager> = new Map();

export function getCacheManager(name: string = 'default', maxSize: number = 5000): CacheManager {
  if (!cacheInstances.has(name)) {
    cacheInstances.set(name, new CacheManager(maxSize));
  }
  return cacheInstances.get(name)!;
}

// Specialized cache managers
export const cacheManagers = {
  default: () => getCacheManager('default', 5000),
  agents: () => getCacheManager('agents', 1000),
  analytics: () => getCacheManager('analytics', 2000),
  static: () => getCacheManager('static', 500),
  user: () => getCacheManager('user', 3000),
};

export default CacheManager;