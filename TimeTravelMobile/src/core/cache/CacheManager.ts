/**
 * 🗄️ CACHE MANAGER
 * ================
 * Production-grade caching with LRU eviction, TTL, and tagging
 */

import type { CacheEntry, CacheOptions, CacheStats } from '../types';

/**
 * Cache configuration
 */
interface CacheConfig {
  maxSize: number;         // Max cache size in bytes
  maxEntries: number;      // Max number of entries
  defaultTTL: number;      // Default time-to-live in ms
  cleanupInterval: number; // Cleanup interval in ms
}

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024,  // 50MB
  maxEntries: 1000,
  defaultTTL: 5 * 60 * 1000,  // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
};

/**
 * LRU Cache Manager
 * Supports TTL, tags for invalidation, and size-based eviction
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, entries: 0, hitRate: 0 };
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.recordMiss();
      return null;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      this.recordMiss();
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.recordHit();
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const ttl = options.ttl ?? this.config.defaultTTL;
    const size = this.estimateSize(value);
    
    // Check if we need to evict
    while (this.needsEviction(size)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      tags: options.tags ?? [],
      size,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    this.cache.set(key, entry);
    this.stats.size += size;
    this.stats.entries = this.cache.size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    this.cache.delete(key);
    this.stats.size -= entry.size;
    this.stats.entries = this.cache.size;
    return true;
  }

  /**
   * Invalidate all entries with given tags
   */
  invalidateTags(tags: string[]): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate entries matching pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.entries = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0,
    };
  }

  /**
   * Get or set (compute if missing)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, options);
    return value;
  }

  /**
   * Peek at value without updating access
   */
  peek<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      return null;
    }
    return entry.value as T;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.timestamp + entry.ttl;
  }

  private needsEviction(newSize: number): boolean {
    return (
      this.cache.size >= this.config.maxEntries ||
      this.stats.size + newSize > this.config.maxSize
    );
  }

  private evictLRU(): void {
    // First entry is least recently used (Map maintains insertion order)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.delete(firstKey);
    }
  }

  private estimateSize(value: unknown): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 1024; // Default 1KB for non-serializable
    }
  }

  private recordHit(): void {
    this.stats.hits++;
  }

  private recordMiss(): void {
    this.stats.misses++;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
      }
    }
  }
}

// Singleton instance
let cacheInstance: CacheManager | null = null;

export function getCacheManager(config?: Partial<CacheConfig>): CacheManager {
  if (!cacheInstance) {
    cacheInstance = new CacheManager(config);
  }
  return cacheInstance;
}

export function resetCacheManager(): void {
  if (cacheInstance) {
    cacheInstance.destroy();
    cacheInstance = null;
  }
}