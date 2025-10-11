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

  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache<string, CacheItem>({
      max: maxSize,
      ttl: 60 * 60 * 1000, // 1 hour max TTL
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
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
    const ttl = options.ttl || 60 * 1000; // Default 1 minute
    const expires = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expires
    });
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
    for (const [key, item] of this.cache.entries()) {
      totalSize += key.length + JSON.stringify(item.value).length;
    }
    return totalSize;
  }
}

// Singleton instance for the application
let cacheManagerInstance: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager();
  }
  return cacheManagerInstance;
}

export default CacheManager;