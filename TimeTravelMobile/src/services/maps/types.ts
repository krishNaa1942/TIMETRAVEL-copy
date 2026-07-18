/**
 * 🗺️ MAPS ENGINE - TYPE DEFINITIONS
 * ==================================
 * Production-grade geospatial type system
 */

// ─────────────────────────────────────────────────────────────
// Coordinate & Location Types
// ─────────────────────────────────────────────────────────────

export interface Coordinate {
  lat: number;
  lon: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface MapDestination {
  id: string;
  name: string;
  lat: number;
  lon: number;
  label?: string;
  category?: string;
  region?: string;
}

export interface GeoResult {
  lat: number;
  lon: number;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  countryCode?: string;
  confidence?: number; // 0-1 match confidence
}

export interface ReverseGeoResult extends GeoResult {
  nearestDestination?: MapDestination;
  distanceToNearest?: number;
}

// ─────────────────────────────────────────────────────────────
// Route Types
// ─────────────────────────────────────────────────────────────

export type TravelMode = 'car' | 'walk' | 'bike' | 'transit';

export interface RouteLeg {
  startAddress: string;
  endAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  polyline: string; // Encoded polyline
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver: 'turn-left' | 'turn-right' | 'straight' | 'u-turn' | 'merge' | 'exit' | 'arrive';
  startLat: number;
  startLon: number;
}

export interface RouteResult {
  id: string;
  origin: string;
  destination: string;
  originCoords: Coordinate;
  destCoords: Coordinate;
  travelMode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  durationText: string;
  distanceText: string;
  summary?: string;
  geometry?: Coordinate[];
  legs?: RouteLeg[];
  steps?: RouteStep[];
  tolls?: boolean;
  highways?: boolean;
  ferry?: boolean;
  cached?: boolean;
  provider: MapProvider;
}

export interface RouteOptions {
  mode: TravelMode;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  alternatives?: boolean;
  departureTime?: Date;
  arrivalTime?: Date;
}

// ─────────────────────────────────────────────────────────────
// POI Types
// ─────────────────────────────────────────────────────────────

export type POICategory = 
  | 'restaurant' | 'hotel' | 'gas_station' | 'atm' | 'bank'
  | 'hospital' | 'pharmacy' | 'grocery' | 'shopping' | 'parking'
  | 'tourist_attraction' | 'museum' | 'cafe' | 'bar' | 'nightclub'
  | 'park' | 'beach' | 'airport' | 'train_station' | 'bus_station'
  | 'car_rental' | 'ev_charging' | 'restroom' | 'wifi' | 'custom';

export interface NearbyPOI {
  id: string;
  name: string;
  category: POICategory;
  lat: number;
  lon: number;
  distanceMeters: number;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  priceLevel?: 1 | 2 | 3 | 4;
  openingHours?: string[];
  permanentlyClosed?: boolean;
  photos?: string[];
  provider: MapProvider;
}

export interface NearbySearchOptions {
  category?: POICategory;
  radius?: number; // meters
  limit?: number;
  openNow?: boolean;
  minRating?: number;
}

// ─────────────────────────────────────────────────────────────
// Suggestions & Predictions
// ─────────────────────────────────────────────────────────────

export interface SmartSuggestion {
  nearestDestination: { name: string; distanceKm: number } | null;
  suggestions: Record<POICategory, NearbyPOI[]>;
  location: Coordinate;
  context: SuggestionContext;
}

export interface SuggestionContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number;
  weather?: string;
  userHistory?: string[];
}

export interface AutocompletePrediction {
  id: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
  distanceMeters?: number;
}

export interface SearchHistory {
  query: string;
  timestamp: number;
  resultCount: number;
  selectedResult?: GeoResult;
}

// ─────────────────────────────────────────────────────────────
// Provider Types
// ─────────────────────────────────────────────────────────────

export type MapProvider = 'tomtom' | 'google' | 'osm' | 'here';

export interface ProviderConfig {
  name: MapProvider;
  apiKey?: string;
  baseUrl: string;
  priority: number;
  timeout: number;
  rateLimit: number; // requests per second
  supportsOffline: boolean;
}

export interface ProviderHealth {
  provider: MapProvider;
  available: boolean;
  avgLatency: number;
  errorRate: number;
  lastCheck: number;
}

// ─────────────────────────────────────────────────────────────
// Cache Types
// ─────────────────────────────────────────────────────────────

export interface MapsCacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  provider: MapProvider;
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  hitRate: number;
}

// ─────────────────────────────────────────────────────────────
// Request Types
// ─────────────────────────────────────────────────────────────

export interface MapsRequestConfig {
  timeout?: number;
  signal?: AbortSignal;
  skipCache?: boolean;
  preferredProvider?: MapProvider;
  retryCount?: number;
}

export interface PendingRequest<T> {
  id: string;
  promise: Promise<T>;
  timestamp: number;
  abortController: AbortController;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

export type MapsErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'INVALID_COORDINATES'
  | 'INVALID_QUERY'
  | 'NO_RESULTS'
  | 'PROVIDER_UNAVAILABLE'
  | 'OFFLINE_ERROR'
  | 'CACHE_ERROR'
  | 'ROUTE_NOT_FOUND'
  | 'GEOCODE_FAILED';

export interface MapsError {
  code: MapsErrorCode;
  message: string;
  provider?: MapProvider;
  statusCode?: number;
  retryable: boolean;
  retryAfter?: number;
  context?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Engine Config
// ─────────────────────────────────────────────────────────────

export interface MapsEngineConfig {
  providers: ProviderConfig[];
  defaultTimeout: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  memoryCacheSize: number;
  persistentCache: boolean;
  offlineEnabled: boolean;
  deduplicationWindow: number;
  geocodeDebounce: number;
  predictivePrefetch: boolean;
  maxRetries: number;
  circuitBreakerThreshold: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const DEFAULT_MAPS_CONFIG: Partial<MapsEngineConfig> = {
  defaultTimeout: 10000,
  cacheEnabled: true,
  cacheTTL: 3600000, // 1 hour
  memoryCacheSize: 500,
  persistentCache: true,
  offlineEnabled: true,
  deduplicationWindow: 100,
  geocodeDebounce: 300,
  predictivePrefetch: true,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  logLevel: 'info',
};

// ─────────────────────────────────────────────────────────────
// Analytics Types
// ─────────────────────────────────────────────────────────────

export interface MapsMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatency: number;
  providerUsage: Record<MapProvider, number>;
  errorByCode: Record<MapsErrorCode, number>;
}