/**
 * 🗺️ MAPS ENGINE - MULTI-LAYER CACHE
 * ===================================
 * Memory + Persistent caching for geospatial data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MapProvider, CacheStats, MapsCacheEntry } from './types';

const STORAGE_PREFIX = '@maps_cache:';
const STATS_KEY = '@maps_cache_stats';

export class MapsCache {
  private memoryCache: Map<string, MapsCacheEntry<unknown>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, evictions: 0, hitRate: 0 };

  constructor(maxSize = 500, defaultTTL = 3600000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.loadStats();
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key) as MapsCacheEntry<T> | undefined;
    if (memEntry && !this.isExpired(memEntry)) {
      memEntry.hitCount++;
      this.stats.hits++;
      this.updateHitRate();
      return memEntry.data;
    }

    // Check persistent cache
    try {
      const stored = await AsyncStorage.getItem(STORAGE_PREFIX + key);
      if (stored) {
        const entry: MapsCacheEntry<T> = JSON.parse(stored);
        if (!this.isExpired(entry)) {
          // Promote to memory cache
          this.memoryCache.set(key, entry);
          entry.hitCount++;
          this.stats.hits++;
          this.updateHitRate();
          return entry.data;
        }
        // Remove expired
        await AsyncStorage.removeItem(STORAGE_PREFIX + key);
      }
    } catch {
      // Ignore storage errors
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  async set<T>(key: string, data: T, ttl?: number, provider?: MapProvider): Promise<void> {
    const entry: MapsCacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
      provider: provider ?? 'tomtom',
      hitCount: 0,
    };

    // Set in memory cache with LRU eviction
    if (this.memoryCache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.memoryCache.set(key, entry);

    // Persist to storage
    try {
      await AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // Storage full - clear old entries
      await this.clearOldEntries();
    }

    this.stats.size = this.memoryCache.size;
  }

  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(STORAGE_PREFIX + key);
    } catch {}
    this.stats.size = this.memoryCache.size;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) keysToDelete.push(key);
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
      try {
        await AsyncStorage.removeItem(STORAGE_PREFIX + key);
      } catch {}
    }

    this.stats.size = this.memoryCache.size;
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch {}
    this.stats.size = 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────

  private isExpired(entry: MapsCacheEntry<unknown>): boolean {
    return Date.now() > entry.timestamp + entry.ttl;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private async clearOldEntries(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX));

    for (const key of cacheKeys.slice(0, 50)) {
      await AsyncStorage.removeItem(key);
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private async loadStats(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STATS_KEY);
      if (stored) this.stats = { ...this.stats, ...JSON.parse(stored) };
    } catch {}
  }

  async saveStats(): Promise<void> {
    try {
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(this.stats));
    } catch {}
  }
}

// Singleton
let cacheInstance: MapsCache | null = null;

export const getMapsCache = (maxSize?: number, ttl?: number): MapsCache => {
  if (!cacheInstance) cacheInstance = new MapsCache(maxSize, ttl);
  return cacheInstance;
};

export const resetMapsCache = (): void => {
  cacheInstance = null;
};