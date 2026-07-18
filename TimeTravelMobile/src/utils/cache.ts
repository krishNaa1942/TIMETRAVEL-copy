/**
 * Smart Cache Utility
 * Implements stale-while-revalidate strategy with AsyncStorage persistence
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@ttt_cache_";
const DEFAULT_TTL = 1000 * 60 * 60; // 1 hour

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  persist?: boolean; // Whether to persist to AsyncStorage
}

/**
 * In-memory cache for fast access
 */
const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Cache utility class with stale-while-revalidate strategy
 */
export const cache = {
  /**
   * Get cached data, returns stale data while revalidating in background
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = CACHE_PREFIX + key;
    
    // Check memory cache first
    const memEntry = memoryCache.get(fullKey);
    if (memEntry) {
      const isStale = Date.now() - memEntry.timestamp > memEntry.ttl;
      if (!isStale) {
        return memEntry.data as T;
      }
    }
    
    // Check AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(fullKey);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        memoryCache.set(fullKey, entry);
        return entry.data;
      }
    } catch (error) {
      console.warn("[Cache] Failed to read from AsyncStorage:", error);
    }
    
    return null;
  },

  /**
   * Set cache data
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = CACHE_PREFIX + key;
    const ttl = options.ttl ?? DEFAULT_TTL;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    
    // Update memory cache
    memoryCache.set(fullKey, entry);
    
    // Persist to AsyncStorage if enabled
    if (options.persist !== false) {
      try {
        await AsyncStorage.setItem(fullKey, JSON.stringify(entry));
      } catch (error) {
        console.warn("[Cache] Failed to persist to AsyncStorage:", error);
      }
    }
  },

  /**
   * Check if cache entry exists and is fresh
   */
  isFresh(key: string): boolean {
    const fullKey = CACHE_PREFIX + key;
    const entry = memoryCache.get(fullKey);
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  },

  /**
   * Get cache age in milliseconds
   */
  getAge(key: string): number | null {
    const fullKey = CACHE_PREFIX + key;
    const entry = memoryCache.get(fullKey);
    if (!entry) return null;
    return Date.now() - entry.timestamp;
  },

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(key: string): Promise<void> {
    const fullKey = CACHE_PREFIX + key;
    memoryCache.delete(fullKey);
    try {
      await AsyncStorage.removeItem(fullKey);
    } catch (error) {
      console.warn("[Cache] Failed to remove from AsyncStorage:", error);
    }
  },

  /**
   * Invalidate all cache entries matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    
    // Clear from memory
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
    
    // Clear from AsyncStorage
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => 
        k.startsWith(CACHE_PREFIX) && regex.test(k)
      );
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn("[Cache] Failed to clear pattern from AsyncStorage:", error);
    }
  },

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn("[Cache] Failed to clear AsyncStorage:", error);
    }
  },

  /**
   * Get cache stats
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: memoryCache.size,
      keys: Array.from(memoryCache.keys()).map(k => k.replace(CACHE_PREFIX, "")),
    };
  },
};

/**
 * Stale-while-revalidate fetcher
 * Returns cached data immediately, then fetches fresh data in background
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<{ data: T | null; isStale: boolean; revalidate: () => Promise<T | null> }> {
  const cachedData = await cache.get<T>(key);
  const isStale = !cache.isFresh(key);
  
  let revalidatePromise: Promise<T | null> | null = null;
  
  const revalidate = async (): Promise<T | null> => {
    if (revalidatePromise) return revalidatePromise;
    
    revalidatePromise = (async () => {
      try {
        const freshData = await fetcher();
        await cache.set(key, freshData, options);
        return freshData;
      } catch (error) {
        console.warn("[SWR] Revalidation failed:", error);
        return null;
      }
    })();
    
    return revalidatePromise;
  };
  
  // If stale or no cache, trigger background revalidation
  if (isStale || !cachedData) {
    revalidate();
  }
  
  return {
    data: cachedData,
    isStale,
    revalidate,
  };
}

export default cache;