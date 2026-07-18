/**
 * Geographic Utilities
 * Production-grade geospatial calculations
 * 
 * Used for:
 * - Distance calculations (Haversine formula)
 * - Travel time estimation
 * - Bounds calculation
 * - Route optimization support
 */

import { Coordinate, TravelMode } from '@/types/itinerary';

/**
 * Earth's radius in meters
 */
const EARTH_RADIUS_METERS = 6371000;
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 */
export const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

/**
 * Convert radians to degrees
 */
export const toDegrees = (radians: number): number => radians * (180 / Math.PI);

/**
 * Calculate distance between two coordinates using Haversine formula
 * 
 * Formula:
 *   a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
 *   c = 2 × atan2(√a, √(1-a))
 *   d = R × c
 * 
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @returns Distance in meters
 * 
 * @example
 * const distance = haversineDistance(
 *   { latitude: 28.6139, longitude: 77.2090 },  // Delhi
 *   { latitude: 19.0760, longitude: 72.8777 }   // Mumbai
 * );
 * // Returns ~1,157,000 meters (1,157 km)
 */
export function haversineDistance(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  const lat1 = toRadians(coord1.latitude);
  const lat2 = toRadians(coord2.latitude);
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLon = toRadians(coord2.longitude - coord1.longitude);
  
  const a = 
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate distance in kilometers
 */
export function haversineDistanceKm(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  return haversineDistance(coord1, coord2) / 1000;
}

/**
 * Estimate travel time based on distance and mode
 * 
 * Uses average speeds:
 * - Walk: 5 km/h
 * - Bike: 15 km/h
 * - Drive: 40 km/h (city), 80 km/h (highway)
 * - Transit: 25 km/h (average with stops)
 * 
 * @param distanceMeters - Distance in meters
 * @param mode - Travel mode
 * @returns Time in minutes
 */
export function estimateTravelTime(
  distanceMeters: number,
  mode: TravelMode
): number {
  const distanceKm = distanceMeters / 1000;
  
  const speeds: Record<TravelMode, number> = {
    walk: 5,      // km/h - average walking speed
    bike: 15,     // km/h - casual cycling
    drive: 40,    // km/h - city driving average (with traffic)
    transit: 25   // km/h - public transit with stops
  };
  
  const speedKmPerH = speeds[mode];
  const timeHours = distanceKm / speedKmPerH;
  const timeMinutes = timeHours * 60;
  
  // Add buffer for traffic/lights
  const buffer = mode === 'drive' ? 1.2 : mode === 'transit' ? 1.15 : 1.0;
  
  return Math.round(timeMinutes * buffer);
}

/**
 * Calculate bearing (direction) between two points
 * 
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
  from: Coordinate,
  to: Coordinate
): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = 
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  
  let bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;  // Normalize to 0-360
}

/**
 * Calculate midpoint between two coordinates
 */
export function midpoint(
  coord1: Coordinate,
  coord2: Coordinate
): Coordinate {
  const lat1 = toRadians(coord1.latitude);
  const lat2 = toRadians(coord2.latitude);
  const lon1 = toRadians(coord1.longitude);
  const lon2 = toRadians(coord2.longitude);
  
  const dLon = lon2 - lon1;
  
  const Bx = Math.cos(lat2) * Math.cos(dLon);
  const By = Math.cos(lat2) * Math.sin(dLon);
  
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) ** 2 + By ** 2)
  );
  
  const lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);
  
  return {
    latitude: toDegrees(lat3),
    longitude: toDegrees(lon3)
  };
}

/**
 * Calculate bounds for a set of coordinates
 * 
 * Returns the bounding box that contains all coordinates
 * with optional padding
 */
export function calculateBounds(
  coordinates: Coordinate[],
  paddingPercent: number = 0.05
): { northEast: Coordinate; southWest: Coordinate } | null {
  if (coordinates.length === 0) return null;
  
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  
  for (const coord of coordinates) {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLon = Math.min(minLon, coord.longitude);
    maxLon = Math.max(maxLon, coord.longitude);
  }
  
  // Add padding
  const latPadding = (maxLat - minLat) * paddingPercent;
  const lonPadding = (maxLon - minLon) * paddingPercent;
  
  return {
    northEast: {
      latitude: maxLat + latPadding,
      longitude: maxLon + lonPadding
    },
    southWest: {
      latitude: minLat - latPadding,
      longitude: minLon - lonPadding
    }
  };
}

/**
 * Check if a point is within bounds
 */
export function isWithinBounds(
  point: Coordinate,
  bounds: { northEast: Coordinate; southWest: Coordinate }
): boolean {
  return (
    point.latitude >= bounds.southWest.latitude &&
    point.latitude <= bounds.northEast.latitude &&
    point.longitude >= bounds.southWest.longitude &&
    point.longitude <= bounds.northEast.longitude
  );
}

/**
 * Calculate total distance of a route
 */
export function calculateRouteDistance(
  coordinates: Coordinate[]
): number {
  if (coordinates.length < 2) return 0;
  
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistance(coordinates[i], coordinates[i + 1]);
  }
  return total;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Calculate center point of multiple coordinates
 */
export function calculateCenter(coordinates: Coordinate[]): Coordinate | null {
  if (coordinates.length === 0) return null;
  
  const sumLat = coordinates.reduce((sum, c) => sum + c.latitude, 0);
  const sumLon = coordinates.reduce((sum, c) => sum + c.longitude, 0);
  
  return {
    latitude: sumLat / coordinates.length,
    longitude: sumLon / coordinates.length
  };
}

/**
 * Destination point from a starting point, bearing and distance
 * 
 * @param start - Starting coordinate
 * @param bearing - Bearing in degrees
 * @param distance - Distance in meters
 * @returns Destination coordinate
 */
export function destinationPoint(
  start: Coordinate,
  bearing: number,
  distance: number
): Coordinate {
  const lat1 = toRadians(start.latitude);
  const lon1 = toRadians(start.longitude);
  const brng = toRadians(bearing);
  const d = distance / EARTH_RADIUS_METERS;
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return {
    latitude: toDegrees(lat2),
    longitude: toDegrees(lon2)
  };
}

export default {
  haversineDistance,
  haversineDistanceKm,
  estimateTravelTime,
  calculateBearing,
  midpoint,
  calculateBounds,
  isWithinBounds,
  calculateRouteDistance,
  formatDistance,
  formatDuration,
  calculateCenter,
  destinationPoint,
  toRadians,
  toDegrees
};