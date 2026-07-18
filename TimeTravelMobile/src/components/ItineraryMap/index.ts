/**
 * 🗺️ ItineraryMap Components - Production Export
 * AI-powered TomTom map components for itinerary planning
 */

// Types
export * from './types';

// Components
export { ItineraryMapView } from './ItineraryMapView';
export { default as ItineraryMapViewDefault } from './ItineraryMapView';

// Re-export commonly used types
export type {
  MapCoordinate,
  MapMarker,
  DayRoute,
  RouteSegment,
  MapPOI,
  AIInsight,
  MarkerType,
  POICategory,
  TrafficLevel,
  ItineraryMapViewProps,
} from './types';

// Helper functions
export {
  toTomTomCoordinate,
  fromTomTomCoordinate,
  getMarkerColor,
  getTrafficColor,
} from './types';