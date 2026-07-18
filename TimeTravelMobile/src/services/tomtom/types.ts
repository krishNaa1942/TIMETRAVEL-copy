/**
 * 🗺️ TomTom API Types
 * Production-grade type definitions for TomTom services
 */

// ─────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────

export interface TomTomConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export interface Coordinate {
  lat: number;
  lon: number;
}

export interface BoundingBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

// ─────────────────────────────────────────────────────────────
// Routing Types
// ─────────────────────────────────────────────────────────────

export type TravelMode = 'car' | 'truck' | 'taxi' | 'bus' | 'van' | 'motorcycle' | 'bicycle' | 'pedestrian';

export type RouteType = 'fastest' | 'shortest' | 'eco' | 'thrilling';

export type TrafficModel = 'historical' | 'live' | 'delayImpact';

export interface RouteOptions {
  travelMode?: TravelMode;
  routeType?: RouteType;
  traffic?: boolean;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  avoidUnpavedRoads?: boolean;
  avoidCarpoolLanes?: boolean;
  avoidAlreadyVisitedRoads?: boolean;
  trafficModel?: TrafficModel;
  departAt?: string; // ISO 8601 datetime
  arriveAt?: string; // ISO 8601 datetime
  computeTravelTimeFor?: 'all' | 'none';
  vehicleEngineType?: 'combustion' | 'electric' | 'hybrid';
  vehicleMaxSpeed?: number; // km/h
  vehicleWeight?: number; // kg
  vehicleAxleWeight?: number; // kg
  vehicleLength?: number; // meters
  vehicleWidth?: number; // meters
  vehicleHeight?: number; // meters
  vehicleCommercial?: boolean;
}

export interface RouteWaypoint {
  coordinate: Coordinate;
  heading?: number; // degrees
  headingTolerance?: number; // degrees
  minHeadingDistance?: number; // meters
  sideOfStreet?: 'left' | 'right' | 'either';
}

export interface RouteLeg {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
    departureTime: string;
    arrivalTime: string;
    noTrafficTravelTimeInSeconds: number;
    historicTravelTimeInSeconds: number;
    liveTrafficIncidentsTravelTimeInSeconds: number;
  };
  points: Coordinate[];
  startTimestamp: string;
  endTimestamp: string;
}

export interface RouteInstruction {
  routeOffsetInMeters: number;
  travelTimeInSeconds: number;
  turnAngle: number;
  turnDirection: 'LEFT' | 'RIGHT' | 'STRAIGHT' | 'UTURN' | 'SHARP_LEFT' | 'SHARP_RIGHT' | 'SLIGHT_LEFT' | 'SLIGHT_RIGHT';
  roundaboutExitNumber?: number;
  point: Coordinate;
  message: string;
  roadName?: string;
  roadNumber?: string;
  exitNumber?: string;
  streetName?: string;
  maneuverType: 'TURN' | 'ROUNDABOUT' | 'ARRIVE' | 'DEPART' | 'FORK' | 'MERGE' | 'KEEP' | 'UTURN';
}

export interface RouteSection {
  startPointIndex: number;
  endPointIndex: number;
  sectionType: 'CAR_TRAIN' | 'FERRY' | 'TUNNEL' | 'MOTORWAY' | 'PEDESTRIAN' | 'TOLL_ROAD' | 'TOLL_VIGNETTE' | 'PAVED_ROAD' | 'UNPAVED_ROAD' | 'CITY_FERRY' | 'TRAVEL_MODE';
  travelMode?: TravelMode;
}

export interface RouteResult {
  id: string;
  legs: RouteLeg[];
  sections: RouteSection[];
  guidance: {
    instructions: RouteInstruction[];
    instructionGroups: {
      firstInstructionIndex: number;
      lastInstructionIndex: number;
      groupMessage: string;
      groupLengthInMeters: number;
    }[];
  };
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
    departureTime: string;
    arrivalTime: string;
    noTrafficTravelTimeInSeconds: number;
    historicTravelTimeInSeconds: number;
    liveTrafficIncidentsTravelTimeInSeconds: number;
    fuelConsumptionInLiters?: number;
    batteryConsumptionInkWh?: number;
  };
  geometry: Coordinate[];
  isFallbackRoute?: boolean;
}

export interface RouteResponse {
  routes: RouteResult[];
  formatVersion: string;
  copyright: string;
  privacy: string;
}

// ─────────────────────────────────────────────────────────────
// Traffic Types
// ─────────────────────────────────────────────────────────────

export type TrafficIncidentType = 
  | 'ACCIDENT'
  | 'CONGESTION'
  | 'CONSTRUCTION'
  | 'DISABLED_VEHICLE'
  | 'LANE_RESTRICTION'
  | 'ROAD_CLOSURE'
  | 'ROAD_HAZARD'
  | 'WEATHER'
  | 'EVENT'
  | 'OTHER';

export type TrafficSeverity = 'unknown' | 'minor' | 'moderate' | 'major' | 'severe' | 'undefined';

export interface TrafficIncident {
  id: string;
  type: TrafficIncidentType;
  severity: TrafficSeverity;
  location: {
    coordinates: Coordinate[];
    description?: string;
  };
  from: string;
  to: string;
  startTime: string;
  endTime?: string;
  delayInSeconds?: number;
  distanceInMeters?: number;
  roadName?: string;
  roadNumber?: string;
  description?: string;
  details?: string[];
}

export interface TrafficResponse {
  incidents: TrafficIncident[];
  summary: {
    numIncidents: number;
    totalDelayInSeconds: number;
    totalDistanceInMeters: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Geocoding Types
// ─────────────────────────────────────────────────────────────

export interface GeocodingResult {
  type: 'Street' | 'PointAddress' | 'POI' | 'Geography' | 'CrossStreet' | 'AddressRange';
  id: string;
  score: number;
  address: {
    streetNumber?: string;
    streetName?: string;
    municipality?: string;
    countrySubdivision?: string;
    countrySecondarySubdivision?: string;
    countryTertiarySubdivision?: string;
    countryCode: string;
    country: string;
    countryCodeISO3: string;
    freeformAddress: string;
    localName?: string;
  };
  position: Coordinate;
  boundingBox?: BoundingBox;
  viewport?: BoundingBox;
  entryPoints?: {
    type: 'main' | 'minor';
    position: Coordinate;
  }[];
  poi?: {
    name: string;
    categories: string[];
    categorySet: { id: number }[];
    classifications: {
      code: string;
      names: { nameLocale: string; name: string }[];
    }[];
  };
}

export interface GeocodingResponse {
  summary: {
    queryTime: number;
    numResults: number;
    offset: number;
    totalResults: number;
    fuzzyLevel: number;
    geoBias?: Coordinate;
  };
  results: GeocodingResult[];
}

// ─────────────────────────────────────────────────────────────
// POI Types
// ─────────────────────────────────────────────────────────────

export type POICategory = 
  | 'restaurant'
  | 'hotel'
  | 'gas_station'
  | 'parking'
  | 'tourist_attraction'
  | 'museum'
  | 'shopping_center'
  | 'cafe'
  | 'bank'
  | 'hospital'
  | 'pharmacy'
  | 'park'
  | 'beach'
  | 'airport'
  | 'train_station'
  | 'bus_station';

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  categories: string[];
  position: Coordinate;
  address: {
    streetNumber?: string;
    streetName?: string;
    municipality?: string;
    countrySubdivision?: string;
    countryCode: string;
    freeformAddress: string;
  };
  distance?: number; // meters from search center
  rating?: number;
  openingHours?: {
    mode: 'nextSevenDays' | 'all';
    timeRanges: {
      startTime: { date: string; hour: number; minute: number };
      endTime: { date: string; hour: number; minute: number };
    }[];
  };
  phone?: string;
  url?: string;
  brands?: { name: string }[];
}

export interface POISearchResponse {
  summary: {
    queryTime: number;
    numResults: number;
    offset: number;
    totalResults: number;
    geoBias?: Coordinate;
  };
  results: POI[];
}

// ─────────────────────────────────────────────────────────────
// Matrix Routing Types
// ─────────────────────────────────────────────────────────────

export interface MatrixRequest {
  origins: Coordinate[];
  destinations: Coordinate[];
  travelMode?: TravelMode;
  routeType?: RouteType;
  traffic?: boolean;
  departAt?: string;
}

export interface MatrixCell {
  originIndex: number;
  destinationIndex: number;
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
    departureTime: string;
    arrivalTime: string;
    noTrafficTravelTimeInSeconds: number;
    historicTravelTimeInSeconds: number;
    liveTrafficIncidentsTravelTimeInSeconds: number;
  } | null;
  status: 'OK' | 'FAILED' | 'NOT_SKIPPED' | 'SKIPPED_SIZE_LIMIT_EXCEEDED';
}

export interface MatrixResponse {
  formatVersion: string;
  matrix: MatrixCell[][];
  summary: {
    successfulCells: number;
    totalCells: number;
    queryTime: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Map Configuration
// ─────────────────────────────────────────────────────────────

export interface MapStyle {
  id: string;
  name: string;
  tileUrl: string;
  attribution: string;
  minZoom: number;
  maxZoom: number;
}

export interface MapCameraPosition {
  center: Coordinate;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface MapMarkerOptions {
  position: Coordinate;
  title?: string;
  snippet?: string;
  icon?: string;
  color?: string;
  anchor?: 'top' | 'bottom' | 'center';
  draggable?: boolean;
  zIndex?: number;
}

export interface MapPolylineOptions {
  points: Coordinate[];
  color: string;
  width: number;
  outlineColor?: string;
  outlineWidth?: number;
  isDashed?: boolean;
  zIndex?: number;
}

export interface MapPolygonOptions {
  points: Coordinate[];
  fillColor: string;
  fillOpacity?: number;
  strokeColor: string;
  strokeWidth: number;
  zIndex?: number;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

export type TomTomErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'REQUEST_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_REQUEST'
  | 'NO_RESULTS'
  | 'ROUTE_NOT_FOUND'
  | 'TRAFFIC_DATA_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export interface TomTomError {
  code: TomTomErrorCode;
  message: string;
  details?: Record<string, unknown>;
  statusCode?: number;
  retryable: boolean;
}

// ─────────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────────

export interface DistanceMatrix {
  origins: { id: string; coordinate: Coordinate }[];
  destinations: { id: string; coordinate: Coordinate }[];
  matrix: {
    distanceMeters: number;
    durationSeconds: number;
    status: 'OK' | 'FAILED';
  }[][];
}

export interface RouteOptimizationResult {
  waypoints: Coordinate[];
  optimizedOrder: number[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: {
    from: number;
    to: number;
    distanceMeters: number;
    durationSeconds: number;
    geometry: Coordinate[];
  }[];
}

export interface TrafficAwareRoute {
  route: RouteResult;
  incidents: TrafficIncident[];
  totalDelayMinutes: number;
  recommendedDepartureTime?: string;
  alternativeRoutes?: RouteResult[];
}

// Export default config
export const DEFAULT_TOMTOM_CONFIG: Partial<TomTomConfig> = {
  baseUrl: 'https://api.tomtom.com',
  timeout: 10000,
  maxRetries: 3,
};