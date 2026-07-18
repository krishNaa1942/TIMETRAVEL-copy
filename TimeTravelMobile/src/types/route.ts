/**
 * Route Intelligence Platform - Type System
 * Production-grade routing with AI scoring, traffic, and personalization
 */

// ─────────────────────────────────────────────────────────────
// CORE LOCATION TYPES
// ─────────────────────────────────────────────────────────────

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  location: GeoLocation;
  place_id?: string;
  types?: string[];
  rating?: number;
  distance_m?: number;
}

export interface RecentPlace extends PlaceResult {
  last_used: string;
  usage_count: number;
}

// ─────────────────────────────────────────────────────────────
// ROUTE PREFERENCES
// ─────────────────────────────────────────────────────────────

export type TravelMode = 'car' | 'bike' | 'walk' | 'transit';

export interface RoutePreferences {
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  scenic: boolean;
  ecoFriendly: boolean;
}

export const DEFAULT_PREFERENCES: RoutePreferences = {
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  scenic: false,
  ecoFriendly: false,
};

// ─────────────────────────────────────────────────────────────
// TRAFFIC & CONDITIONS
// ─────────────────────────────────────────────────────────────

export type TrafficCondition = 'free' | 'light' | 'moderate' | 'heavy' | 'congested';

export interface TrafficSegment {
  start_index: number;
  end_index: number;
  condition: TrafficCondition;
  speed_kmh: number;
  delay_seconds: number;
}

export interface TrafficInfo {
  condition: TrafficCondition;
  delay_minutes: number;
  congestion_percentage: number;
  segments?: TrafficSegment[];
}

// ─────────────────────────────────────────────────────────────
// ROUTE METRICS
// ─────────────────────────────────────────────────────────────

export interface RouteMetrics {
  distance_meters: number;
  distance_km: number;
  duration_seconds: number;
  duration_minutes: number;
  duration_with_traffic_seconds: number;
  traffic_delay_seconds: number;
  
  // Cost estimates
  fuel_cost_inr: number;
  toll_cost_inr: number;
  total_cost_inr: number;
  
  // Environmental
  carbon_kg: number;
  fuel_liters: number;
  
  // Scoring
  score: number;
  score_components: {
    time_score: number;
    cost_score: number;
    traffic_score: number;
    preference_score: number;
  };
}

// ─────────────────────────────────────────────────────────────
// ROUTE STEP & INSTRUCTIONS
// ─────────────────────────────────────────────────────────────

export type ManeuverType = 
  | 'turn-left' | 'turn-right' | 'turn-slight-left' | 'turn-slight-right'
  | 'turn-sharp-left' | 'turn-sharp-right' | 'straight' | 'merge'
  | 'roundabout' | 'exit' | 'fork' | 'arrive' | 'depart' | 'u-turn';

export interface RouteStep {
  id: string;
  instruction: string;
  maneuver: ManeuverType;
  distance_meters: number;
  duration_seconds: number;
  start_location: GeoLocation;
  end_location: GeoLocation;
  road_name?: string;
  exit_number?: number;
}

export interface RouteLeg {
  id: string;
  start_address: string;
  end_address: string;
  start_location: GeoLocation;
  end_location: GeoLocation;
  distance_meters: number;
  duration_seconds: number;
  steps: RouteStep[];
}

// ─────────────────────────────────────────────────────────────
// SMART STOP
// ─────────────────────────────────────────────────────────────

export type StopType = 'fuel' | 'restaurant' | 'rest_stop' | 'atm' | 'hospital' | 'ev_charging';

export interface SmartStop {
  id: string;
  name: string;
  type: StopType;
  location: GeoLocation;
  distance_from_route_meters: number;
  distance_along_route_km: number;
  detour_time_minutes: number;
  rating?: number;
  address?: string;
}

// ─────────────────────────────────────────────────────────────
// MAIN ROUTE TYPES
// ─────────────────────────────────────────────────────────────

export type RouteSource = 'api' | 'cache' | 'offline';

export interface Route {
  id: string;
  origin: PlaceResult;
  destination: PlaceResult;
  waypoints?: PlaceResult[];
  travel_mode: TravelMode;
  
  // Geometry
  geometry: GeoLocation[];
  encoded_polyline?: string;
  
  // Metrics
  metrics: RouteMetrics;
  
  // Traffic
  traffic: TrafficInfo;
  
  // Navigation
  legs: RouteLeg[];
  
  // Metadata
  source: RouteSource;
  cached_at?: string;
  expires_at?: string;
  
  // AI Insights
  reasoning: string;
  alternatives_reason?: string;
  
  // Smart stops along route
  smart_stops?: SmartStop[];
}

export interface RouteAlternative {
  route: Route;
  difference: {
    time_minutes: number;
    distance_km: number;
    cost_inr: number;
  };
  is_recommended: boolean;
}

// ─────────────────────────────────────────────────────────────
// ROUTE COMPUTE REQUEST
// ─────────────────────────────────────────────────────────────

export interface RouteComputeRequest {
  origin: GeoLocation;
  destination: GeoLocation;
  waypoints?: GeoLocation[];
  mode: TravelMode;
  preferences: RoutePreferences;
  departure_time?: string;
  optimize_waypoints?: boolean;
}

export interface RouteComputeResponse {
  routes: Route[];
  recommended_route_id: string;
  compute_time_ms: number;
  traffic_updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// PREDICTIVE ENGINE
// ─────────────────────────────────────────────────────────────

export interface DepartureImpact {
  departure_time: string;
  eta_change_minutes: number;
  traffic_condition: TrafficCondition;
  probability_on_time: number;
  recommendation: string;
}

export interface PredictiveResult {
  current_eta: string;
  impacts: DepartureImpact[];
  best_departure_time: string;
  worst_departure_time: string;
}

// ─────────────────────────────────────────────────────────────
// USER BEHAVIOR & PERSONALIZATION
// ─────────────────────────────────────────────────────────────

export interface RouteBehavior {
  user_id: string;
  preferred_modes: Record<TravelMode, number>;
  toll_avoidance_rate: number;
  highway_avoidance_rate: number;
  scenic_preference_rate: number;
  eco_preference_rate: number;
  
  // Time preferences
  avg_departure_hour: number;
  
  // Route switching behavior
  route_switch_count: number;
  cancellation_count: number;
  
  // Most used routes
  frequent_routes: {
    origin_name: string;
    destination_name: string;
    count: number;
  }[];
}

// ─────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────

export type RouteErrorType = 
  | 'network' | 'api_error' | 'no_route' | 'invalid_origin' 
  | 'invalid_destination' | 'permission_denied' | 'timeout'
  | 'rate_limited' | 'service_unavailable' | 'validation_error';

export interface RouteError {
  type: RouteErrorType;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// NAVIGATION STATE
// ─────────────────────────────────────────────────────────────

export type NavigationStatus = 'idle' | 'preparing' | 'navigating' | 'rerouting' | 'arrived' | 'cancelled';

export interface NavigationState {
  status: NavigationStatus;
  active_route: Route | null;
  current_step_index: number;
  distance_remaining_meters: number;
  time_remaining_seconds: number;
  next_step: RouteStep | null;
  is_off_route: boolean;
  last_reroute_at?: string;
}

// ─────────────────────────────────────────────────────────────
// CACHE TYPES
// ─────────────────────────────────────────────────────────────

export interface CachedRoute {
  id: string;
  origin_name: string;
  destination_name: string;
  route: Route;
  cached_at: string;
  expires_at: string;
  access_count: number;
}

export const ROUTE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes