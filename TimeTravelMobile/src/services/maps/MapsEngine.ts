/**
 * 🗺️ MAPS ENGINE - PRODUCTION-GRADE GEOSPATIAL SERVICE
 * =====================================================
 * Google Maps-level performance with offline-first architecture
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import type {
  MapDestination,
  GeoResult,
  ReverseGeoResult,
  RouteResult,
  RouteOptions,
  NearbyPOI,
  NearbySearchOptions,
  SmartSuggestion,
  AutocompletePrediction,
  MapProvider,
  MapsEngineConfig,
  MapsMetrics,
  MapsError,
  ProviderHealth,
  Coordinate,
} from './types';
import { DEFAULT_MAPS_CONFIG } from './types';
import { MapsCache, getMapsCache } from './MapsCache';
import {
  validateCoordinate,
  validateQuery,
  generateGeocodeKey,
  generateReverseGeocodeKey,
  generateRouteKey,
  generateNearbyKey,
  haversineDistanceKm,
  createMapsError,
  retryWithBackoff,
  formatDuration,
  formatDistance,
} from './utils';
import apiService from '../api';

// ─────────────────────────────────────────────────────────────
// Circuit Breaker
// ─────────────────────────────────────────────────────────────

type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTime: number;

  constructor(threshold = 5, resetTime = 30000) {
    this.threshold = threshold;
    this.resetTime = resetTime;
  }

  isAvailable(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTime) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true; // half-open allows one attempt
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Request Deduplicator
// ─────────────────────────────────────────────────────────────

class RequestDeduplicator {
  private pending = new Map<string, Promise<unknown>>();
  private window: number;

  constructor(windowMs = 100) {
    this.window = windowMs;
  }

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fn().finally(() => {
      setTimeout(() => this.pending.delete(key), this.window);
    });
    this.pending.set(key, promise);
    return promise;
  }
}

// ─────────────────────────────────────────────────────────────
// Maps Engine
// ─────────────────────────────────────────────────────────────

export class MapsEngine {
  private config: MapsEngineConfig;
  private cache: MapsCache;
  private deduplicator: RequestDeduplicator;
  private circuitBreakers: Map<MapProvider, CircuitBreaker> = new Map();
  private providerHealth: Map<MapProvider, ProviderHealth> = new Map();
  private metrics: MapsMetrics;
  private isOnline = true;
  private geocodeQueue: Array<{ query: string; resolve: Function; reject: Function }> = [];
  private geocodeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<MapsEngineConfig> = {}) {
    this.config = { ...DEFAULT_MAPS_CONFIG, ...config } as MapsEngineConfig;
    this.cache = getMapsCache(this.config.memoryCacheSize, this.config.cacheTTL);
    this.deduplicator = new RequestDeduplicator(this.config.deduplicationWindow);
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLatency: 0,
      providerUsage: {} as Record<MapProvider, number>,
      errorByCode: {} as Record<string, number>,
    };

    // Initialize circuit breakers for each provider
    const providers: MapProvider[] = ['tomtom', 'google', 'osm', 'here'];
    providers.forEach(p => {
      this.circuitBreakers.set(p, new CircuitBreaker(this.config.circuitBreakerThreshold));
      this.providerHealth.set(p, {
        provider: p,
        available: true,
        avgLatency: 0,
        errorRate: 0,
        lastCheck: Date.now(),
      });
    });

    this.setupNetworkListener();
  }

  // ─────────────────────────────────────────────────────────────
  // Network & Offline
  // ─────────────────────────────────────────────────────────────

  private setupNetworkListener(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      this.isOnline = state.isConnected ?? false;
    });
  }

  private checkOffline(): void {
    if (!this.isOnline && !this.config.offlineEnabled) {
      throw createMapsError('OFFLINE_ERROR', 'No network connection available');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Core Request Handler
  // ─────────────────────────────────────────────────────────────

  private async request<T>(
    endpoint: string,
    cacheKey: string,
    options: {
      skipCache?: boolean;
      ttl?: number;
      provider?: MapProvider;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const { skipCache = false, ttl, timeout = this.config.defaultTimeout } = options;

    // Check cache first
    if (!skipCache && this.config.cacheEnabled) {
      const cached = await this.cache.get<T>(cacheKey);
      if (cached !== null) {
        this.metrics.cacheHits++;
        return { ...cached, cached: true } as T;
      }
      this.metrics.cacheMisses++;
    }

    // Check offline
    this.checkOffline();

    // Deduplicate request
    return this.deduplicator.dedupe(cacheKey, async () => {
      const startTime = Date.now();
      this.metrics.totalRequests++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const result = await retryWithBackoff(
          () => apiService.get<T>(endpoint, { signal: controller.signal }),
          this.config.maxRetries
        );

        clearTimeout(timeoutId);

        // Cache result
        if (this.config.cacheEnabled) {
          await this.cache.set(cacheKey, result, ttl, options.provider);
        }

        this.metrics.successfulRequests++;
        this.recordLatency(Date.now() - startTime);
        return result;

      } catch (error) {
        this.metrics.failedRequests++;
        throw this.handleError(error);
      }
    }) as Promise<T>;
  }

  private handleError(error: unknown): MapsError {
    if ((error as Error).name === 'AbortError') {
      return createMapsError('TIMEOUT_ERROR', 'Request timed out');
    }
    if ((error as { status?: number }).status === 429) {
      return createMapsError('RATE_LIMIT_ERROR', 'Rate limit exceeded');
    }
    return createMapsError('NETWORK_ERROR', (error as Error).message);
  }

  private recordLatency(latency: number): void {
    const total = this.metrics.totalRequests;
    this.metrics.avgLatency = (this.metrics.avgLatency * (total - 1) + latency) / total;
  }

  // ─────────────────────────────────────────────────────────────
  // Geocoding
  // ─────────────────────────────────────────────────────────────

  async geocode(query: string): Promise<GeoResult | null> {
    const validatedQuery = validateQuery(query);
    const cacheKey = generateGeocodeKey(validatedQuery);

    return this.request<GeoResult | null>(
      `/maps/geocode?q=${encodeURIComponent(validatedQuery)}`,
      cacheKey
    );
  }

  async geocodeWithDebounce(query: string): Promise<GeoResult | null> {
    return new Promise((resolve, reject) => {
      this.geocodeQueue.push({ query, resolve, reject });
      
      if (this.geocodeTimeout) clearTimeout(this.geocodeTimeout);
      
      this.geocodeTimeout = setTimeout(async () => {
        const queue = [...this.geocodeQueue];
        this.geocodeQueue = [];
        
        // Process only the most recent query
        const last = queue[queue.length - 1];
        if (last) {
          try {
            const result = await this.geocode(last.query);
            queue.forEach(item => item.resolve(result));
          } catch (error) {
            queue.forEach(item => item.reject(error));
          }
        }
      }, this.config.geocodeDebounce);
    });
  }

  async reverseGeocode(lat: number, lon: number): Promise<ReverseGeoResult> {
    const coord = validateCoordinate({ lat, lon }, 'reverse geocode coordinate');
    const cacheKey = generateReverseGeocodeKey(coord);

    return this.request<ReverseGeoResult>(
      `/maps/reverse?lat=${coord.lat}&lon=${coord.lon}`,
      cacheKey,
      { ttl: 86400000 } // 24 hours for reverse geocode
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Routing
  // ─────────────────────────────────────────────────────────────

  async getRoute(
    from: string,
    to: string,
    mode: string = 'car',
    options: RouteOptions = { mode: 'car' }
  ): Promise<RouteResult> {
    const cacheKey = generateRouteKey(from, to, mode, { ...options });
    const params = new URLSearchParams({ from, to, mode });
    
    if (options.avoidTolls) params.append('avoidTolls', 'true');
    if (options.avoidHighways) params.append('avoidHighways', 'true');
    if (options.alternatives) params.append('alternatives', 'true');

    const result = await this.request<RouteResult>(
      `/maps/route?${params}`,
      cacheKey,
      { ttl: 1800000 } // 30 min for routes
    );

    return {
      ...result,
      durationText: formatDuration(result.durationSeconds),
      distanceText: formatDistance(result.distanceMeters),
    };
  }

  async getMultiStopRoute(waypoints: string[], mode: string = 'car'): Promise<RouteResult[]> {
    const results: RouteResult[] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const route = await this.getRoute(waypoints[i], waypoints[i + 1], mode);
      results.push(route);
    }
    return results;
  }

  // ─────────────────────────────────────────────────────────────
  // Nearby POIs
  // ─────────────────────────────────────────────────────────────

  async getNearby(
    dest: string,
    category?: string,
    limit: number = 20
  ): Promise<NearbyPOI[]> {
    const params = new URLSearchParams({ dest });
    if (category) params.append('category', category);
    if (limit) params.append('limit', String(limit));

    const cacheKey = `nearby:${dest}:${category || 'all'}:${limit}`;
    
    const res = await this.request<{ pois: NearbyPOI[] }>(
      `/maps/nearby?${params}`,
      cacheKey,
      { ttl: 3600000 } // 1 hour for POIs
    );

    return res.pois;
  }

  async getNearbyByCoords(
    coord: Coordinate,
    options: NearbySearchOptions = {}
  ): Promise<NearbyPOI[]> {
    validateCoordinate(coord, 'nearby search coordinate');
    
    const { category, radius = 1000, limit = 20 } = options;
    const cacheKey = generateNearbyKey(coord, category, radius);

    const params = new URLSearchParams({
      lat: String(coord.lat),
      lon: String(coord.lon),
      radius: String(radius),
      limit: String(limit),
    });
    if (category) params.append('category', category);

    const res = await this.request<{ pois: NearbyPOI[] }>(
      `/maps/nearby/coords?${params}`,
      cacheKey,
      { ttl: 1800000 }
    );

    return res.pois.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  // ─────────────────────────────────────────────────────────────
  // Smart Suggestions
  // ─────────────────────────────────────────────────────────────

  async getSuggestions(lat: number, lon: number): Promise<SmartSuggestion> {
    const coord = validateCoordinate({ lat, lon }, 'suggestions coordinate');
    const cacheKey = `suggestions:${coord.lat.toFixed(4)},${coord.lon.toFixed(4)}`;

    return this.request<SmartSuggestion>(
      `/maps/suggest?lat=${coord.lat}&lon=${coord.lon}`,
      cacheKey,
      { ttl: 600000 } // 10 min for suggestions
    );
  }

  async getContextualSuggestions(
    lat: number,
    lon: number,
    context?: { timeOfDay?: string; preferences?: string[] }
  ): Promise<SmartSuggestion> {
    const coord = validateCoordinate({ lat, lon }, 'contextual suggestions');

    // Get base suggestions
    const suggestions = await this.getSuggestions(coord.lat, coord.lon);

    // Enhance with context-aware ordering
    const hour = new Date().getHours();
    const timeOfDay = context?.timeOfDay ?? 
      (hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night');

    // Reorder suggestions based on time of day
    const prioritizedCategories = this.getPrioritizedCategories(timeOfDay);
    const suggestionMap = suggestions.suggestions as Record<string, NearbyPOI[]>;
    
    const reordered: Record<string, NearbyPOI[]> = {};
    prioritizedCategories.forEach(cat => {
      if (suggestionMap[cat]) {
        reordered[cat] = suggestionMap[cat];
      }
    });
    Object.keys(suggestionMap).forEach(cat => {
      if (!reordered[cat]) reordered[cat] = suggestionMap[cat];
    });

    return { ...suggestions, suggestions: reordered };
  }

  private getPrioritizedCategories(timeOfDay: string): string[] {
    const priorities: Record<string, string[]> = {
      morning: ['cafe', 'breakfast', 'bakery', 'gym', 'park'],
      afternoon: ['restaurant', 'cafe', 'shopping', 'tourist_attraction', 'museum'],
      evening: ['restaurant', 'bar', 'nightclub', 'entertainment', 'hotel'],
      night: ['hotel', 'bar', 'nightclub', 'restaurant', 'gas_station'],
    };
    return priorities[timeOfDay] || priorities.afternoon;
  }

  // ─────────────────────────────────────────────────────────────
  // Autocomplete & Search
  // ─────────────────────────────────────────────────────────────

  async autocomplete(
    query: string,
    location?: Coordinate
  ): Promise<AutocompletePrediction[]> {
    if (query.length < 2) return [];

    const params = new URLSearchParams({ q: query });
    if (location) {
      validateCoordinate(location, 'autocomplete location');
      params.append('lat', String(location.lat));
      params.append('lon', String(location.lon));
    }

    const cacheKey = `autocomplete:${query}:${location ? `${location.lat},${location.lon}` : 'none'}`;
    
    return this.request<AutocompletePrediction[]>(
      `/maps/autocomplete?${params}`,
      cacheKey,
      { ttl: 300000, timeout: 5000 }
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Destinations
  // ─────────────────────────────────────────────────────────────

  async getDestinations(): Promise<MapDestination[]> {
    const res = await this.request<{ destinations: MapDestination[] }>(
      '/maps/destinations',
      'destinations:all',
      { ttl: 86400000 } // 24 hours
    );
    return res.destinations;
  }

  async getNearestDestination(
    coord: Coordinate
  ): Promise<{ destination: MapDestination; distanceKm: number } | null> {
    validateCoordinate(coord, 'nearest destination coordinate');
    
    const destinations = await this.getDestinations();
    if (destinations.length === 0) return null;

    let nearest = destinations[0];
    let minDistance = haversineDistanceKm(coord, { lat: nearest.lat, lon: nearest.lon });

    for (let i = 1; i < destinations.length; i++) {
      const dest = destinations[i];
      const distance = haversineDistanceKm(coord, { lat: dest.lat, lon: dest.lon });
      if (distance < minDistance) {
        minDistance = distance;
        nearest = dest;
      }
    }

    return { destination: nearest, distanceKm: minDistance };
  }

  // ─────────────────────────────────────────────────────────────
  // Predictive Prefetching
  // ─────────────────────────────────────────────────────────────

  async prefetchArea(coord: Coordinate, radiusKm: number = 10): Promise<void> {
    if (!this.config.predictivePrefetch) return;

    validateCoordinate(coord, 'prefetch coordinate');

    // Prefetch nearby POIs for common categories
    const categories = ['restaurant', 'hotel', 'gas_station', 'tourist_attraction'];
    
    await Promise.allSettled(
      categories.map(cat => 
        this.getNearbyByCoords(coord, { category: cat as any, radius: radiusKm * 1000 })
      )
    );
  }

  async prefetchRoute(start: string, end: string, mode: string = 'car'): Promise<void> {
    if (!this.config.predictivePrefetch) return;
    
    // Prefetch route
    await this.getRoute(start, end, mode).catch(() => {});
  }

  // ─────────────────────────────────────────────────────────────
  // Cache Management
  // ─────────────────────────────────────────────────────────────

  async invalidateCache(pattern?: string): Promise<void> {
    if (pattern) {
      await this.cache.invalidatePattern(pattern);
    } else {
      await this.cache.clear();
    }
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  // ─────────────────────────────────────────────────────────────
  // Metrics & Health
  // ─────────────────────────────────────────────────────────────

  getMetrics(): MapsMetrics {
    return { ...this.metrics };
  }

  getProviderHealth(): Map<MapProvider, ProviderHealth> {
    return new Map(this.providerHealth);
  }

  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLatency: 0,
      providerUsage: {} as Record<MapProvider, number>,
      errorByCode: {} as Record<string, number>,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let engineInstance: MapsEngine | null = null;

export const getMapsEngine = (config?: Partial<MapsEngineConfig>): MapsEngine => {
  if (!engineInstance) engineInstance = new MapsEngine(config);
  return engineInstance;
};

export const resetMapsEngine = (): void => {
  engineInstance = null;
};

export default MapsEngine;