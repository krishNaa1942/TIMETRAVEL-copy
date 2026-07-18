/**
 * 🗺️ MAPS MODULE - PRODUCTION-GRADE GEOSPATIAL SERVICES
 * =======================================================
 * 
 * This module provides a complete, Google Maps-level mapping solution with:
 * - Multi-provider support (TomTom, Google, OSM, HERE)
 * - Offline-first architecture with intelligent caching
 * - Circuit breaker for fault tolerance
 * - Request deduplication for performance
 * - Predictive prefetching for UX optimization
 * 
 * @example
 * ```typescript
 * import { getMapsEngine } from './services/maps';
 * 
 * const mapsEngine = getMapsEngine();
 * 
 * // Geocode an address
 * const location = await mapsEngine.geocode('Eiffel Tower, Paris');
 * 
 * // Get route between two points
 * const route = await mapsEngine.getRoute('Paris', 'London', 'car');
 * 
 * // Find nearby restaurants
 * const restaurants = await mapsEngine.getNearbyByCoords(
 *   { lat: 48.8584, lon: 2.2945 },
 *   { category: 'restaurant', radius: 1000 }
 * );
 * ```
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Core types
  Coordinate,
  BoundingBox,
  
  // Destination types
  MapDestination,
  
  // Geocoding types
  GeoResult,
  ReverseGeoResult,
  
  // Routing types
  RouteResult,
  RouteStep,
  RouteLeg,
  RouteOptions,
  
  // POI types
  NearbyPOI,
  NearbySearchOptions,
  POICategory,
  
  // Smart suggestions
  SmartSuggestion,
  
  // Autocomplete
  AutocompletePrediction,
  
  // Provider types
  MapProvider,
  ProviderHealth,
  
  // Configuration
  MapsEngineConfig,
  MapsMetrics,
  MapsError,
  MapsErrorCode,
  
  // Cache types
  CacheStats,
} from './types';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export { DEFAULT_MAPS_CONFIG } from './types';

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Validation
  validateCoordinate,
  validateQuery,
  
  // Key generation
  generateGeocodeKey,
  generateReverseGeocodeKey,
  generateRouteKey,
  generateNearbyKey,
  
  // Distance/Geo calculations
  haversineDistanceKm,
  isValidCoordinate,
  
  // Error handling
  createMapsError,
  
  // Retry logic
  retryWithBackoff,
  
  // Formatting
  formatDuration,
  formatDistance,
  
  // Polyline
  decodePolyline,
  encodePolyline,
} from './utils';

// ─────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────

export {
  MapsCache,
  getMapsCache,
} from './MapsCache';

// ─────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────

export {
  MapsEngine,
  getMapsEngine,
  resetMapsEngine,
} from './MapsEngine';

// ─────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────

export { MapsEngine as default } from './MapsEngine';