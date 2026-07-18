/**
 * ItineraryMap Component Types
 * Types for AI-powered itinerary map components
 */

import { Coordinate as TomTomCoordinate } from "../../services/tomtom/types";
import type { TravelMode } from "@/types/itinerary";
import type { RoutePreferences } from "@/types/route";

// ─────────────────────────────────────────────────────────────
// Map Types
// ─────────────────────────────────────────────────────────────

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface MapCamera {
  center: MapCoordinate;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

// ─────────────────────────────────────────────────────────────
// Marker Types
// ─────────────────────────────────────────────────────────────

export type MarkerType =
  | "start"
  | "end"
  | "waypoint"
  | "poi"
  | "hotel"
  | "restaurant"
  | "attraction"
  | "gas_station"
  | "rest_stop";

export interface MapMarker {
  id: string;
  position: MapCoordinate;
  type: MarkerType;
  title: string;
  subtitle?: string;
  dayNumber?: number;
  order?: number;
  isSelected?: boolean;
  metadata?: MarkerMetadata;
}

export interface MarkerMetadata {
  placeId?: string;
  category?: string;
  rating?: number;
  priceLevel?: number;
  openingHours?: string;
  estimatedVisitMinutes?: number;
  crowdSensitivity?: "low" | "medium" | "high";
  isOutdoor?: boolean;
  priority?: number;
  aiInsight?: AIInsight;
}

export interface AIInsight {
  title: string;
  description: string;
  tips?: string[];
  bestTimeToVisit?: string;
  localTip?: string;
  estimatedDuration?: string;
}

// ─────────────────────────────────────────────────────────────
// Route Types
// ─────────────────────────────────────────────────────────────

export interface RouteSegment {
  id: string;
  startMarker: string; // marker id
  endMarker: string;
  coordinates: MapCoordinate[];
  encodedPolyline?: string;
  distanceMeters: number;
  durationSeconds: number;
  trafficDelaySeconds?: number;
  color?: string;
}

export interface DayRoute {
  dayNumber: number;
  segments: RouteSegment[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  waypoints: MapMarker[];
}

// ─────────────────────────────────────────────────────────────
// POI Types
// ─────────────────────────────────────────────────────────────

export interface MapPOI {
  id: string;
  name: string;
  category: POICategory;
  position: MapCoordinate;
  distanceFromRoute?: number;
  rating?: number;
  isOpen?: boolean;
  priceLevel?: number;
  isSelected?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Intelligence, Navigation, and Controller Types
// ─────────────────────────────────────────────────────────────

export type ItineraryMapMode = "preview" | "navigation" | "live";
export type ItineraryMapCameraMode = "auto" | "route" | "selection" | "user";

export interface ItineraryMapLiveSignals {
  trafficLevel?: TrafficLevel;
  trafficDelayMinutes?: number;
  weatherCondition?: string;
  rainProbability?: number;
  temperatureC?: number;
  crowdLevel?: "low" | "moderate" | "high";
  isOffline?: boolean;
  updatedAt?: string;
}

export interface ItineraryMapNavigationStep {
  id: string;
  title: string;
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  markerId?: string;
}

export interface ItineraryMapNavigationState {
  mode: ItineraryMapMode;
  status: "idle" | "navigating" | "rerouting" | "arrived" | "offline";
  activeRouteId: string | null;
  currentStepIndex: number;
  totalSteps: number;
  distanceRemainingMeters: number;
  timeRemainingSeconds: number;
  nextInstruction?: string;
  eta?: string;
  isOffRoute: boolean;
}

export interface ItineraryMapRouteRequest {
  markers: MapMarker[];
  travelMode: TravelMode;
  totalDays?: number;
  routePreferences?: Partial<RoutePreferences>;
  liveSignals?: ItineraryMapLiveSignals;
}

export type ItineraryMapRouteProvider = (
  request: ItineraryMapRouteRequest,
) => Promise<DayRoute[]>;

export interface ItineraryMapAIRequest {
  marker: MapMarker;
  route?: DayRoute;
  signals?: ItineraryMapLiveSignals;
  userLocation?: MapCoordinate | null;
  poi?: MapPOI[];
}

export interface ItineraryMapAIService {
  inferInsight: (request: ItineraryMapAIRequest) => Promise<AIInsight | null>;
}

export interface MapCluster {
  id: string;
  center: MapCoordinate;
  markers: MapMarker[];
  count: number;
}

export interface ItineraryMapControllerConfig {
  travelMode?: TravelMode;
  navigationMode?: ItineraryMapMode;
  cameraMode?: ItineraryMapCameraMode;
  totalDays?: number;
  startHour?: number;
  endHour?: number;
  hotelLocation?: MapCoordinate;
  enableAutoOptimization?: boolean;
  enableClustering?: boolean;
  clusterThreshold?: number;
  followUserLocation?: boolean;
  autoFetchRoutes?: boolean;
  routePreferences?: Partial<RoutePreferences>;
  liveSignals?: ItineraryMapLiveSignals;
  routeProvider?: ItineraryMapRouteProvider;
  aiService?: ItineraryMapAIService;
  onRouteOptimized?: (routes: DayRoute[]) => void;
  onNavigationStateChange?: (state: ItineraryMapNavigationState) => void;
  onNavigationAction?: (
    action: "start" | "pause" | "stop" | "recenter",
  ) => void;
  onSelectionChange?: (marker: MapMarker | null) => void;
  onVoiceInstruction?: (instruction: string) => void;
  onRouteReordered?: (markers: MapMarker[]) => void;
  onMapLongPress?: (coordinate: MapCoordinate) => void;
  onMarkerDragEnd?: (marker: MapMarker) => void;
  onAddToItinerary?: (marker: MapMarker) => void;
  onLocationError?: (message: string) => void;
}

export type POICategory =
  | "restaurant"
  | "cafe"
  | "gas_station"
  | "hotel"
  | "attraction"
  | "shopping"
  | "parking"
  | "rest_area";

// ─────────────────────────────────────────────────────────────
// Callout Types
// ─────────────────────────────────────────────────────────────

export interface MapCallout {
  id: string;
  markerId: string;
  visible: boolean;
  content: CalloutContent;
  position: MapCoordinate;
}

export interface CalloutContent {
  title: string;
  subtitle?: string;
  description?: string;
  aiExplanation?: string;
  tips?: string[];
  actions?: CalloutAction[];
}

export interface CalloutAction {
  id: string;
  label: string;
  icon?: string;
  onPress: () => void;
}

// ─────────────────────────────────────────────────────────────
// Traffic Types
// ─────────────────────────────────────────────────────────────

export type TrafficLevel = "free" | "light" | "moderate" | "heavy" | "severe";

export interface TrafficSegment {
  start: MapCoordinate;
  end: MapCoordinate;
  level: TrafficLevel;
  delaySeconds?: number;
}

// ─────────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────────

export interface ItineraryMapViewProps {
  markers: MapMarker[];
  routes?: DayRoute[];
  poi?: MapPOI[];
  selectedMarkerId?: string;
  onMarkerPress?: (marker: MapMarker) => void;
  onMapPress?: (coordinate: MapCoordinate) => void;
  onMapLongPress?: (coordinate: MapCoordinate) => void;
  onPOIPress?: (poi: MapPOI) => void;
  onMarkerLongPress?: (marker: MapMarker) => void;
  onSelectionChange?: (marker: MapMarker | null) => void;
  showTraffic?: boolean;
  showPOIs?: boolean;
  initialCamera?: Partial<MapCamera>;
  controller?: ItineraryMapControllerConfig;
  style?: object;
}

export interface DayMarkerProps {
  marker: MapMarker;
  isSelected?: boolean;
  onPress?: () => void;
  showLabel?: boolean;
}

export interface RouteLayerProps {
  segments: RouteSegment[];
  showTraffic?: boolean;
  animated?: boolean;
}

export interface AIExplanationCalloutProps {
  marker: MapMarker;
  visible: boolean;
  onClose: () => void;
  onAddToItinerary?: () => void;
  onGetDirections?: () => void;
}

export interface POIMarkerProps {
  poi: MapPOI;
  isSelected?: boolean;
  onPress?: () => void;
}

export interface NavigationControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onFollowMode: () => void;
  followMode?: boolean;
}

// ─────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────

export interface MapState {
  camera: MapCamera;
  markers: MapMarker[];
  routes: DayRoute[];
  poi: MapPOI[];
  selectedMarkerId: string | null;
  trafficSegments: TrafficSegment[];
  isLoading: boolean;
  error: string | null;
}

export type MapAction =
  | { type: "SET_CAMERA"; payload: Partial<MapCamera> }
  | { type: "SET_MARKERS"; payload: MapMarker[] }
  | { type: "ADD_MARKER"; payload: MapMarker }
  | { type: "REMOVE_MARKER"; payload: string }
  | { type: "SELECT_MARKER"; payload: string | null }
  | {
      type: "UPDATE_MARKER";
      payload: { id: string; updates: Partial<MapMarker> };
    }
  | { type: "SET_ROUTES"; payload: DayRoute[] }
  | { type: "SET_POI"; payload: MapPOI[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null };

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

export const toTomTomCoordinate = (coord: MapCoordinate): TomTomCoordinate => ({
  lat: coord.latitude,
  lon: coord.longitude,
});

export const fromTomTomCoordinate = (
  coord: TomTomCoordinate,
): MapCoordinate => ({
  latitude: coord.lat,
  longitude: coord.lon,
});

export const getMarkerColor = (
  type: MarkerType,
  isSelected?: boolean,
): string => {
  const colors: Record<MarkerType, string> = {
    start: "#10B981",
    end: "#EF4444",
    waypoint: "#6366F1",
    poi: "#F59E0B",
    hotel: "#8B5CF6",
    restaurant: "#EC4899",
    attraction: "#06B6D4",
    gas_station: "#64748B",
    rest_stop: "#84CC16",
  };

  const baseColor = colors[type] || "#6366F1";
  return isSelected ? baseColor : `${baseColor}CC`;
};

export const getTrafficColor = (level: TrafficLevel): string => {
  const colors: Record<TrafficLevel, string> = {
    free: "#10B981",
    light: "#84CC16",
    moderate: "#F59E0B",
    heavy: "#F97316",
    severe: "#EF4444",
  };
  return colors[level];
};
