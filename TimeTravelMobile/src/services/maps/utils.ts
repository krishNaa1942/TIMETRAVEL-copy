/**
 * 🗺️ MAPS ENGINE - UTILITY FUNCTIONS
 * ===================================
 * Geospatial calculations, validation, and encoding
 */

import type { Coordinate, MapsErrorCode, MapsError } from './types';

// ─────────────────────────────────────────────────────────────
// Coordinate Validation
// ─────────────────────────────────────────────────────────────

export const isValidLatitude = (lat: number): boolean =>
  typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;

export const isValidLongitude = (lon: number): boolean =>
  typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180;

export const isValidCoordinate = (coord: unknown): coord is Coordinate => {
  if (!coord || typeof coord !== 'object') return false;
  const c = coord as Record<string, unknown>;
  return isValidLatitude(c.lat as number) && isValidLongitude(c.lon as number);
};

export const validateCoordinate = (coord: unknown, name = 'coordinate'): Coordinate => {
  if (!isValidCoordinate(coord)) {
    throw createMapsError('INVALID_COORDINATES', `Invalid ${name}: ${JSON.stringify(coord)}`);
  }
  return coord;
};

// ─────────────────────────────────────────────────────────────
// Query Validation & Sanitization
// ─────────────────────────────────────────────────────────────

const DANGEROUS_CHARS_REGEX = /[<>'"\\;()]/g;
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/g;
const MAX_QUERY_LENGTH = 500;

export const sanitizeQuery = (query: string): string => {
  if (typeof query !== 'string') return '';
  return query
    .replace(DANGEROUS_CHARS_REGEX, '')
    .replace(CONTROL_CHARS_REGEX, '')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
};

export const validateQuery = (query: unknown): string => {
  if (typeof query !== 'string' || query.trim().length < 2) {
    throw createMapsError('INVALID_QUERY', 'Query must be at least 2 characters');
  }
  return sanitizeQuery(query);
};

// ─────────────────────────────────────────────────────────────
// Coordinate Rounding & Normalization
// ─────────────────────────────────────────────────────────────

const COORD_PRECISION = 6;
const CACHE_PRECISION = 4;

export const roundCoord = (coord: Coordinate, precision = COORD_PRECISION): Coordinate => ({
  lat: Number(coord.lat.toFixed(precision)),
  lon: Number(coord.lon.toFixed(precision)),
});

export const roundCoordForCache = (coord: Coordinate): string => {
  const lat = coord.lat.toFixed(CACHE_PRECISION);
  const lon = coord.lon.toFixed(CACHE_PRECISION);
  return `${lat},${lon}`;
};

export const normalizeQuery = (query: string): string =>
  query.toLowerCase().replace(/\s+/g, ' ').trim();

// ─────────────────────────────────────────────────────────────
// Cache Key Generation
// ─────────────────────────────────────────────────────────────

export const generateGeocodeKey = (query: string): string =>
  `geo:${normalizeQuery(query)}`;

export const generateReverseGeocodeKey = (coord: Coordinate): string =>
  `rev:${roundCoordForCache(coord)}`;

export const generateRouteKey = (
  origin: string,
  dest: string,
  mode: string,
  options?: Record<string, unknown>
): string => {
  const opts = options ? JSON.stringify(options) : '';
  return `route:${normalizeQuery(origin)}→${normalizeQuery(dest)}:${mode}:${opts}`;
};

export const generateNearbyKey = (
  coord: Coordinate,
  category?: string,
  radius?: number
): string => {
  const cat = category || 'all';
  const rad = radius || 1000;
  return `nearby:${roundCoordForCache(coord)}:${cat}:${rad}`;
};

// ─────────────────────────────────────────────────────────────
// Distance Calculations (Haversine Formula)
// ─────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_M = 6371000;

export const haversineDistanceKm = (a: Coordinate, b: Coordinate): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const cosLatA = Math.cos(latA);
  const cosLatB = Math.cos(latB);

  const c = sinDLat * sinDLat + sinDLon * sinDLon * cosLatA * cosLatB;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
};

export const haversineDistanceM = (a: Coordinate, b: Coordinate): number =>
  haversineDistanceKm(a, b) * 1000;

export const toRad = (deg: number): number => (deg * Math.PI) / 180;
export const toDeg = (rad: number): number => (rad * 180) / Math.PI;

// ─────────────────────────────────────────────────────────────
// Bearing Calculation
// ─────────────────────────────────────────────────────────────

export const calculateBearing = (from: Coordinate, to: Coordinate): number => {
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
};

// ─────────────────────────────────────────────────────────────
// Polyline Encoding/Decoding (Google's Algorithm)
// ─────────────────────────────────────────────────────────────

export const encodePolyline = (coords: Coordinate[]): string => {
  let encoded = '';
  let prevLat = 0;
  let prevLon = 0;

  for (const coord of coords) {
    const lat = Math.round(coord.lat * 1e5);
    const lon = Math.round(coord.lon * 1e5);

    encoded += encodeSigned(lat - prevLat);
    encoded += encodeSigned(lon - prevLon);

    prevLat = lat;
    prevLon = lon;
  }

  return encoded;
};

const encodeSigned = (value: number): string => {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = '';
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
};

export const decodePolyline = (encoded: string, precision = 5): Coordinate[] => {
  const coords: Coordinate[] = [];
  let lat = 0;
  let lon = 0;
  let index = 0;
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lon += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({ lat: lat / factor, lon: lon / factor });
  }

  return coords;
};

// ─────────────────────────────────────────────────────────────
// Bounding Box Calculations
// ─────────────────────────────────────────────────────────────

export const getBoundingBox = (center: Coordinate, radiusKm: number) => {
  const latDelta = radiusKm / EARTH_RADIUS_KM;
  const lonDelta = radiusKm / (EARTH_RADIUS_KM * Math.cos(toRad(center.lat)));

  return {
    minLat: center.lat - toDeg(latDelta),
    maxLat: center.lat + toDeg(latDelta),
    minLon: center.lon - toDeg(lonDelta),
    maxLon: center.lon + toDeg(lonDelta),
  };
};

export const isCoordInBox = (coord: Coordinate, box: ReturnType<typeof getBoundingBox>): boolean =>
  coord.lat >= box.minLat &&
  coord.lat <= box.maxLat &&
  coord.lon >= box.minLon &&
  coord.lon <= box.maxLon;

// ─────────────────────────────────────────────────────────────
// Time Formatting
// ─────────────────────────────────────────────────────────────

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

// ─────────────────────────────────────────────────────────────
// Error Creation
// ─────────────────────────────────────────────────────────────

export const createMapsError = (
  code: MapsErrorCode,
  message: string,
  context?: Record<string, unknown>
): MapsError => {
  const retryableCodes: MapsErrorCode[] = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'RATE_LIMIT_ERROR',
    'PROVIDER_UNAVAILABLE',
  ];

  return {
    code,
    message,
    retryable: retryableCodes.includes(code),
    context,
  };
};

// ─────────────────────────────────────────────────────────────
// Retry with Exponential Backoff + Jitter
// ─────────────────────────────────────────────────────────────

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) break;

      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const delay = exponentialDelay + jitter;

      await sleep(delay);
    }
  }

  throw lastError;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────
// Debounce & Throttle
// ─────────────────────────────────────────────────────────────

export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => Promise<ReturnType<T>>) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolvePromise = resolve;

      timeoutId = setTimeout(() => {
        const result = fn(...args) as ReturnType<T>;
        resolve(result);
      }, delay);
    });
  };
};

export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => ReturnType<T> | undefined) => {
  let inThrottle = false;

  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    if (!inThrottle) {
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
      return fn(...args) as ReturnType<T>;
    }
    return undefined;
  };
};