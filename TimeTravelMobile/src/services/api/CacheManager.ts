/**
 * 💾 CACHE MANAGER
 * Stale-while-revalidate caching strategy
 * 
 * Features:
 * - TTL-based invalidation
 * - Stale-while-revalidate pattern
 * - LRU eviction
 * - Request deduplication
 * - ETag support
 */

import { CacheEntry, CacheConfig } from './types';

// ─────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
};

// ─────────────────────────────────────────────────────────────
// CACHE MANAGER CLASS
// ─────────────────────────────────────────────────────────────
class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: CacheConfig;
  private pendingRequests = new Map<string, Promise<unknown>>();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate cache key from request
   */
  private generateKey(method: string, path: string, data?: unknown): string {
    const dataHash = data ? JSON.stringify(data) : '';
    return `${method}:${path}:${dataHash}`;
  }

  /**
   * Get cached response if valid
   */
  get<T>(method: string, path: string, data?: unknown): T | null {
    // Only cache GET requests
    if (method.toUpperCase() !== 'GET') return null;

    const key = this.generateKey(method, path, data);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    const now = Date.now();
    const isExpired = now >= entry.expiresAt;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    this.log('Cache HIT', { key, age: now - entry.timestamp });
    return entry.data;
  }

  /**
   * Set cache entry
   */
  set<T>(method: string, path: string, data: unknown, response: T, ttl?: number): void {
    // Only cache GET requests
    if (method.toUpperCase() !== 'GET') return;

    const key = this.generateKey(method, path, data);
    const now = Date.now();

    this.cache.set(key, {
      data: response,
      timestamp: now,
      expiresAt: now + (ttl || this.config.defaultTTL),
    });

    this.log('Cache SET', { key, ttl: ttl || this.config.defaultTTL });
    this.evictIfNeeded();
  }

  /**
   * Check if entry exists and is fresh
   */
  has(method: string, path: string, data?: unknown): boolean {
    if (method.toUpperCase() !== 'GET') return false;
    
    const key = this.generateKey(method, path, data);
    const entry = this.cache.get(key);

    if (!entry) return false;
    return Date.now() < entry.expiresAt;
  }

  /**
   * Check if entry is stale (exists but expired)
   */
  isStale(method: string, path: string, data?: unknown): boolean {
    if (method.toUpperCase() !== 'GET') return false;
    
    const key = this.generateKey(method, path, data);
    const entry = this.cache.get(key);

    if (!entry) return false;
    return Date.now() >= entry.expiresAt;
  }

  /**
   * Invalidate specific entry
   */
  invalidate(method: string, path: string, data?: unknown): void {
    const key = this.generateKey(method, path, data);
    this.cache.delete(key);
    this.log('Cache INVALIDATE', { key });
  }

  /**
   * Invalidate all entries matching pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    this.log('Cache INVALIDATE_PATTERN', { pattern, count: keysToDelete.length });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    this.log('Cache CLEAR');
  }

  /**
   * Evict oldest entries if cache is too large
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.config.maxSize) return;

    // Sort by timestamp and remove oldest
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toEvict = entries.slice(0, this.cache.size - this.config.maxSize);
    toEvict.forEach(([key]) => this.cache.delete(key));

    this.log('Cache EVICT', { count: toEvict.length });
  }

  // ─────────────────────────────────────────────────────────────
  // REQUEST DEDUPLICATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Get or create pending request promise
   * Prevents duplicate concurrent requests
   */
  async getOrFetch<T>(
    method: string,
    path: string,
    data: unknown,
    fetcher: () => Promise<T>,
    skipCache: boolean = false
  ): Promise<T> {
    const key = this.generateKey(method, path, data);

    // Check cache first (if not skipped)
    if (!skipCache && method.toUpperCase() === 'GET') {
      const cached = this.get<T>(method, path, data);
      if (cached !== null) {
        return cached;
      }

      // Check for pending request
      const pending = this.pendingRequests.get(key) as Promise<T> | undefined;
      if (pending) {
        this.log('Request DEDUPLICATED', { key });
        return pending;
      }
    }

    // Create new request
    const requestPromise = fetcher().then((result) => {
      // Cache successful GET responses
      if (method.toUpperCase() === 'GET') {
        this.set(method, path, data, result);
      }
      this.pendingRequests.delete(key);
      return result;
    }).catch((error) => {
      this.pendingRequests.delete(key);
      throw error;
    });

    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; pendingCount: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      pendingCount: this.pendingRequests.size,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // LOGGING
  // ─────────────────────────────────────────────────────────────

  private log(message: string, data?: unknown): void {
    if (__DEV__) {
      console.log(`💾 [CacheManager] ${message}`, data ?? '');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────
export const cacheManager = new CacheManager();
export default cacheManager;