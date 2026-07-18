/**
 * Itinerary Types
 * Production-grade data models for itinerary system
 * 
 * Features:
 * - Full geospatial data (coordinates, bounds)
 * - Route optimization support
 * - Multi-day distribution
 * - Time and budget tracking
 */

/**
 * Geographic coordinate
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Travel mode for route calculation
 */
export type TravelMode = 'walk' | 'drive' | 'transit' | 'bike';

/**
 * Place category for filtering
 */
export type PlaceCategory = 
  | 'attraction'
  | 'restaurant'
  | 'hotel'
  | 'museum'
  | 'beach'
  | 'park'
  | 'shopping'
  | 'nightlife'
  | 'viewpoint'
  | 'activity';

/**
 * Opening hours time range
 */
export interface TimeRange {
  open: string;   // "09:00"
  close: string;  // "18:00"
}

/**
 * Opening hours for a place
 */
export interface OpeningHours {
  monday?: TimeRange;
  tuesday?: TimeRange;
  wednesday?: TimeRange;
  thursday?: TimeRange;
  friday?: TimeRange;
  saturday?: TimeRange;
  sunday?: TimeRange;
}

/**
 * A place to visit
 * 
 * Core entity for itinerary planning
 */
export interface Place {
  id: string;
  name: string;
  coordinate: Coordinate;
  category: PlaceCategory;
  
  // Visit metadata
  visitDuration: number;        // minutes
  averageCost: number;          // USD
  rating: number;               // 0-5
  openingHours?: OpeningHours;
  
  // Display
  description: string;
  imageUrl?: string;
  tags: string[];
  
  // Computed during optimization
  estimatedArrival?: string;    // ISO timestamp
  estimatedDeparture?: string;  // ISO timestamp
  travelTimeFromPrevious?: number;  // minutes
  distanceFromPrevious?: number;    // meters
}

/**
 * Route between two places
 */
export interface RouteSegment {
  from: Place;
  to: Place;
  distance: number;       // meters
  duration: number;       // minutes
  travelMode: TravelMode;
  polyline?: Coordinate[];  // For map rendering
}

/**
 * Bounds for map display
 */
export interface MapBounds {
  northEast: Coordinate;
  southWest: Coordinate;
}

/**
 * Single day in itinerary
 */
export interface ItineraryDay {
  dayNumber: number;
  date?: string;  // ISO date string
  
  // Places in visit order (optimized)
  places: Place[];
  
  // Computed metrics
  totalVisitTime: number;     // minutes (sum of visit durations)
  totalTravelTime: number;    // minutes
  totalDistance: number;      // meters
  totalTime: number;          // minutes (visit + travel)
  
  // Route data
  routeSegments: RouteSegment[];
  
  // Bounds for map display
  bounds?: MapBounds;
  
  // Summary
  startLocation?: Place;  // Usually hotel
  endLocation?: Place;    // Usually hotel or last place
}

/**
 * Complete itinerary
 */
export interface Itinerary {
  id: string;
  title: string;
  destination: string;
  
  // Configuration
  totalDays: number;
  travelMode: TravelMode;
  startHour: number;      // e.g., 9 for 9 AM
  endHour: number;        // e.g., 20 for 8 PM
  
  // Days
  days: ItineraryDay[];
  
  // Aggregated metrics
  totalPlaces: number;
  totalVisitTime: number;
  totalTravelTime: number;
  totalDistance: number;
  
  // Budget
  estimatedCost: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  
  // Warnings
  warnings?: string[];
}

/**
 * Itinerary generation request
 */
export interface ItineraryRequest {
  destination: string;
  centerPoint: Coordinate;
  totalDays: number;
  travelMode?: TravelMode;
  
  // Constraints
  budgetMax?: number;
  startHour?: number;
  endHour?: number;
  maxPlacesPerDay?: number;
  maxTravelTimePerDay?: number;  // minutes
  
  // Preferences
  categories?: PlaceCategory[];
  mustSee?: string[];            // Place IDs that must be included
  exclude?: string[];            // Place IDs to exclude
  
  // Start/end locations
  hotelLocation?: Coordinate;
}

/**
 * Itinerary generation response
 */
export interface ItineraryResponse {
  itinerary: Itinerary;
  warnings: string[];
  alternatives?: ItineraryDay[];
}

/**
 * Route optimization configuration
 */
export interface OptimizationConfig {
  travelMode: TravelMode;
  startPoint?: Coordinate;
  endPoint?: Coordinate;
  respectOpeningHours: boolean;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  orderedPlaces: Place[];
  routeSegments: RouteSegment[];
  totalDistance: number;
  totalTravelTime: number;
  totalVisitTime: number;
}

/**
 * Day distribution configuration
 */
export interface DistributionConfig {
  totalDays: number;
  maxPlacesPerDay: number;
  maxVisitTimePerDay: number;    // minutes
  maxTravelTimePerDay: number;   // minutes
  startHour: number;
  endHour: number;
  travelMode: TravelMode;
  hotelLocation?: Coordinate;
}

/**
 * Day distribution result
 */
export interface DistributionResult {
  days: ItineraryDay[];
  totalPlaces: number;
  totalVisitTime: number;
  totalTravelTime: number;
  totalDistance: number;
  warnings: string[];
}

/**
 * Marker cluster for map performance
 */
export interface MarkerCluster {
  id: string;
  center: Coordinate;
  places: Place[];
}

/**
 * Itinerary summary for list display
 */
export interface ItinerarySummary {
  id: string;
  title: string;
  destination: string;
  totalDays: number;
  totalPlaces: number;
  thumbnailUrl?: string;
  createdAt: string;
}

export default {
  // Types are exported above
};