/**
 * 🗺️ TomTom API Client
 * Production-grade client for TomTom Maps SDK
 */

import {
  TomTomConfig,
  Coordinate,
  RouteOptions,
  RouteResult,
  RouteResponse,
  TrafficIncident,
  TrafficResponse,
  GeocodingResult,
  GeocodingResponse,
  POI,
  POISearchResponse,
  TomTomError,
  TomTomErrorCode,
  MatrixRequest,
  MatrixResponse,
  DEFAULT_TOMTOM_CONFIG,
} from './types';

// ─────────────────────────────────────────────────────────────
// Error Factory
// ─────────────────────────────────────────────────────────────

const createTomTomError = (
  code: TomTomErrorCode,
  message: string,
  statusCode?: number,
  details?: Record<string, unknown>
): TomTomError => ({
  code,
  message,
  statusCode,
  details,
  retryable: ['RATE_LIMIT_EXCEEDED', 'REQUEST_TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'].includes(code),
});

// ─────────────────────────────────────────────────────────────
// Circuit Breaker
// ─────────────────────────────────────────────────────────────

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
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
    return true;
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
// Request Cache
// ─────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL: number;

  constructor(defaultTTL = 300000) { // 5 minutes
    this.defaultTTL = defaultTTL;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// TomTom Client
// ─────────────────────────────────────────────────────────────

export class TomTomClient {
  private config: TomTomConfig;
  private circuitBreaker: CircuitBreaker;
  private cache: RequestCache;
  private abortControllers = new Map<string, AbortController>();

  constructor(config: Partial<TomTomConfig>) {
    this.config = {
      ...DEFAULT_TOMTOM_CONFIG,
      ...config,
    } as TomTomConfig;
    
    this.circuitBreaker = new CircuitBreaker(5, 30000);
    this.cache = new RequestCache(300000); // 5 min default TTL
  }

  // ─────────────────────────────────────────────────────────────
  // Core Request Handler
  // ─────────────────────────────────────────────────────────────

  private async request<T>(
    endpoint: string,
    cacheKey: string,
    options: {
      method?: 'GET' | 'POST';
      body?: Record<string, unknown>;
      ttl?: number;
      skipCache?: boolean;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, ttl, skipCache = false } = options;

    // Check circuit breaker
    if (!this.circuitBreaker.isAvailable()) {
      throw createTomTomError(
        'SERVICE_UNAVAILABLE',
        'TomTom service is temporarily unavailable. Please try again later.'
      );
    }

    // Check cache
    if (!skipCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Build URL
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    url.searchParams.set('key', this.config.apiKey);

    // Create abort controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    this.abortControllers.set(cacheKey, controller);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.abortControllers.delete(cacheKey);

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      
      // Cache result
      this.cache.set(cacheKey, data, ttl);
      
      this.circuitBreaker.recordSuccess();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(cacheKey);
      
      if ((error as Error).name === 'AbortError') {
        throw createTomTomError('REQUEST_TIMEOUT', 'Request timed out');
      }
      
      if ((error as TomTomError).code) {
        this.circuitBreaker.recordFailure();
        throw error;
      }
      
      this.circuitBreaker.recordFailure();
      throw createTomTomError('NETWORK_ERROR', (error as Error).message);
    }
  }

  private async handleErrorResponse(response: Response): Promise<TomTomError> {
    const statusCode = response.status;
    let errorData: { error?: { description?: string } } = {};
    
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    switch (statusCode) {
      case 400:
        return createTomTomError('INVALID_REQUEST', errorData.error?.description || 'Invalid request parameters', statusCode);
      case 401:
        return createTomTomError('INVALID_API_KEY', 'Invalid or missing TomTom API key', statusCode);
      case 403:
        return createTomTomError('INVALID_API_KEY', 'Access forbidden. Check API key permissions', statusCode);
      case 404:
        return createTomTomError('NO_RESULTS', 'No results found', statusCode);
      case 429:
        return createTomTomError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded. Please try again later', statusCode);
      case 500:
      case 502:
      case 503:
        return createTomTomError('SERVICE_UNAVAILABLE', 'TomTom service is temporarily unavailable', statusCode);
      default:
        return createTomTomError('UNKNOWN_ERROR', `Unexpected error: ${response.statusText}`, statusCode);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Routing API
  // ─────────────────────────────────────────────────────────────

  async calculateRoute(
    waypoints: Coordinate[],
    options: RouteOptions = {}
  ): Promise<RouteResult[]> {
    if (waypoints.length < 2) {
      throw createTomTomError('INVALID_REQUEST', 'At least 2 waypoints are required');
    }

    // Build waypoint string (lat,lon format)
    const locations = waypoints.map(wp => `${wp.lat},${wp.lon}`).join(':');
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (options.travelMode) params.set('travelMode', options.travelMode);
    if (options.routeType) params.set('routeType', options.routeType);
    if (options.traffic !== undefined) params.set('traffic', String(options.traffic));
    if (options.avoidTolls) params.set('avoid', params.get('avoid') ? `${params.get('avoid')}:tollRoads` : 'tollRoads');
    if (options.avoidHighways) params.set('avoid', params.get('avoid') ? `${params.get('avoid')}:motorways` : 'motorways');
    if (options.avoidFerries) params.set('avoid', params.get('avoid') ? `${params.get('avoid')}:ferries` : 'ferries');
    if (options.departAt) params.set('departAt', options.departAt);
    if (options.arriveAt) params.set('arriveAt', options.arriveAt);
    if (options.vehicleMaxSpeed) params.set('vehicleMaxSpeed', String(options.vehicleMaxSpeed));

    // Add computeTravelTime for all
    params.set('computeTravelTimeFor', 'all');

    const cacheKey = `route:${locations}:${params.toString()}`;
    const endpoint = `/routing/1/calculateRoute/${locations}/json?${params.toString()}`;

    const response = await this.request<RouteResponse>(endpoint, cacheKey, {
      ttl: 180000, // 3 minutes for routes
    });

    return response.routes;
  }

  async calculateRouteWithTraffic(
    waypoints: Coordinate[],
    options: RouteOptions = {}
  ): Promise<{ route: RouteResult; incidents: TrafficIncident[] }> {
    const routes = await this.calculateRoute(waypoints, { ...options, traffic: true });
    
    if (routes.length === 0) {
      throw createTomTomError('ROUTE_NOT_FOUND', 'No route found between the specified locations');
    }

    // Get traffic incidents along route
    const incidents = await this.getTrafficAlongRoute(routes[0]);

    return { route: routes[0], incidents };
  }

  // ─────────────────────────────────────────────────────────────
  // Traffic API
  // ─────────────────────────────────────────────────────────────

  async getTrafficAlongRoute(route: RouteResult): Promise<TrafficIncident[]> {
    // Get bounding box from route geometry
    if (!route.geometry || route.geometry.length === 0) return [];

    const bounds = {
      minLat: Math.min(...route.geometry.map(p => p.lat)),
      maxLat: Math.max(...route.geometry.map(p => p.lat)),
      minLon: Math.min(...route.geometry.map(p => p.lon)),
      maxLon: Math.max(...route.geometry.map(p => p.lon)),
    };

    // Add padding
    const padding = 0.01; // ~1km
    bounds.minLat -= padding;
    bounds.maxLat += padding;
    bounds.minLon -= padding;
    bounds.maxLon += padding;

    return this.getTrafficInBounds(bounds);
  }

  async getTrafficInBounds(bounds: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  }): Promise<TrafficIncident[]> {
    const { minLat, minLon, maxLat, maxLon } = bounds;
    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

    const cacheKey = `traffic:${bbox}`;
    const endpoint = `/traffic/services/4/incidentDetails/s3/0/json?bbox=${bbox}&fields=%7Bincidents%7Btype,geometry(coordinates),details(id,from,to,roadNumber,description,iconCategory,cause,source)%7D%7D`;

    const response = await this.request<TrafficResponse>(endpoint, cacheKey, {
      ttl: 60000, // 1 minute for traffic
    });

    return response.incidents;
  }

  // ─────────────────────────────────────────────────────────────
  // Geocoding API
  // ─────────────────────────────────────────────────────────────

  async geocode(query: string, options?: {
    country?: string;
    bounds?: { minLat: number; minLon: number; maxLat: number; maxLon: number };
    limit?: number;
  }): Promise<GeocodingResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const params = new URLSearchParams();
    params.set('query', query);
    
    if (options?.country) params.set('countrySet', options.country);
    if (options?.bounds) {
      const { minLat, minLon, maxLat, maxLon } = options.bounds;
      params.set('bbox', `${minLon},${minLat},${maxLon},${maxLat}`);
    }
    if (options?.limit) params.set('limit', String(options.limit));

    const cacheKey = `geocode:${params.toString()}`;
    const endpoint = `/search/2/geocode/${encodeURIComponent(query)}.json?${params.toString()}`;

    const response = await this.request<GeocodingResponse>(endpoint, cacheKey, {
      ttl: 86400000, // 24 hours for geocoding
    });

    return response.results;
  }

  async reverseGeocode(coordinate: Coordinate): Promise<GeocodingResult | null> {
    const { lat, lon } = coordinate;
    
    const cacheKey = `reverse:${lat.toFixed(6)},${lon.toFixed(6)}`;
    const endpoint = `/search/2/reverseGeocode/${lat},${lon}.json`;

    const response = await this.request<GeocodingResponse>(endpoint, cacheKey, {
      ttl: 86400000, // 24 hours
    });

    return response.results[0] || null;
  }

  // ─────────────────────────────────────────────────────────────
  // POI Search API
  // ─────────────────────────────────────────────────────────────

  async searchPOI(
    query: string,
    center: Coordinate,
    options?: {
      radius?: number; // meters
      limit?: number;
      categories?: string[];
    }
  ): Promise<POI[]> {
    const { lat, lon } = center;
    const radius = options?.radius ?? 10000;
    const limit = options?.limit ?? 20;

    const params = new URLSearchParams();
    params.set('lat', String(lat));
    params.set('lon', String(lon));
    params.set('radius', String(radius));
    params.set('limit', String(limit));
    
    if (options?.categories && options.categories.length > 0) {
      params.set('categorySet', options.categories.join(','));
    }

    const cacheKey = `poi:${query}:${params.toString()}`;
    const endpoint = `/search/2/poiSearch/${encodeURIComponent(query)}.json?${params.toString()}`;

    const response = await this.request<POISearchResponse>(endpoint, cacheKey, {
      ttl: 3600000, // 1 hour for POIs
    });

    return response.results;
  }

  async searchNearbyPOI(
    center: Coordinate,
    category: string,
    options?: {
      radius?: number;
      limit?: number;
    }
  ): Promise<POI[]> {
    const { lat, lon } = center;
    const radius = options?.radius ?? 5000;
    const limit = options?.limit ?? 20;

    const cacheKey = `nearby:${category}:${lat.toFixed(4)},${lon.toFixed(4)}:${radius}`;
    const endpoint = `/search/2/nearbySearch/.json?lat=${lat}&lon=${lon}&radius=${radius}&categorySet=${category}&limit=${limit}`;

    const response = await this.request<POISearchResponse>(endpoint, cacheKey, {
      ttl: 3600000, // 1 hour
    });

    return response.results;
  }

  // ─────────────────────────────────────────────────────────────
  // Matrix Routing API
  // ─────────────────────────────────────────────────────────────

  async calculateMatrix(request: MatrixRequest): Promise<MatrixResponse> {
    const { origins, destinations, travelMode, routeType, traffic, departAt } = request;

    if (origins.length === 0 || destinations.length === 0) {
      throw createTomTomError('INVALID_REQUEST', 'Origins and destinations are required');
    }

    const originsStr = origins.map(o => `${o.lat},${o.lon}`).join(':');
    const destinationsStr = destinations.map(d => `${d.lat},${d.lon}`).join(':');

    const params = new URLSearchParams();
    if (travelMode) params.set('travelMode', travelMode);
    if (routeType) params.set('routeType', routeType);
    if (traffic !== undefined) params.set('traffic', String(traffic));
    if (departAt) params.set('departAt', departAt);

    const cacheKey = `matrix:${originsStr}:${destinationsStr}:${params.toString()}`;
    const endpoint = `/routing/1/matrix/sync/json?origins=${originsStr}&destinations=${destinationsStr}&${params.toString()}`;

    return this.request<MatrixResponse>(endpoint, cacheKey, {
      ttl: 300000, // 5 minutes
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────

  cancelRequest(cacheKey: string): void {
    const controller = this.abortControllers.get(cacheKey);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(cacheKey);
    }
  }

  cancelAllRequests(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  clearCache(): void {
    this.cache.invalidate();
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.cache.invalidate(); // Clear cache when API key changes
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let clientInstance: TomTomClient | null = null;

export const getTomTomClient = (config?: Partial<TomTomConfig>): TomTomClient => {
  if (!clientInstance) {
    const apiKey = config?.apiKey ?? process.env.EXPO_PUBLIC_TOMTOM_API_KEY ?? '';
    
    if (!apiKey) {
      console.warn('[TomTomClient] No API key provided. TomTom features will be limited.');
    }
    
    clientInstance = new TomTomClient({ ...config, apiKey });
  }
  return clientInstance;
};

export const resetTomTomClient = (): void => {
  if (clientInstance) {
    clientInstance.cancelAllRequests();
    clientInstance.clearCache();
  }
  clientInstance = null;
};

export default TomTomClient;