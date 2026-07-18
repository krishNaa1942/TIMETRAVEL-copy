import { DayDistributor } from "@/services/dayDistributor";
import { optimizeRoute } from "@/services/routeOptimizer";
import { decodePolyline } from "@/services/maps/utils";
import { calculateBounds, haversineDistance } from "@/utils/geoUtils";
import {
  Coordinate,
  ItineraryDay,
  Place,
  PlaceCategory,
  RouteSegment as ItineraryRouteSegment,
  TravelMode,
} from "@/types/itinerary";
import {
  AIInsight,
  DayRoute,
  MapCluster,
  MapCoordinate,
  MapMarker,
  MapPOI,
  ItineraryMapAIRequest,
  ItineraryMapLiveSignals,
  ItineraryMapNavigationState,
  ItineraryMapNavigationStep,
  ItineraryMapMode,
  ItineraryMapRouteRequest,
  MarkerType,
} from "./types";

export const DAY_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#8B5CF6",
  "#EF4444",
];

const DEFAULT_CLUSTER_THRESHOLD = 24;
const DEFAULT_DAY_COUNT = 1;
const DEFAULT_VISIT_DURATION: Record<MarkerType, number> = {
  start: 0,
  end: 0,
  waypoint: 45,
  poi: 30,
  hotel: 25,
  restaurant: 60,
  attraction: 90,
  gas_station: 15,
  rest_stop: 15,
};

const DEFAULT_AVERAGE_COST: Record<MarkerType, number> = {
  start: 0,
  end: 0,
  waypoint: 0,
  poi: 200,
  hotel: 3500,
  restaurant: 900,
  attraction: 500,
  gas_station: 250,
  rest_stop: 120,
};

const PLACE_CATEGORY_BY_MARKER: Record<MarkerType, PlaceCategory> = {
  start: "activity",
  end: "activity",
  waypoint: "activity",
  poi: "attraction",
  hotel: "hotel",
  restaurant: "restaurant",
  attraction: "attraction",
  gas_station: "activity",
  rest_stop: "activity",
};

const MARKER_TYPE_BY_PLACE: Record<PlaceCategory, MarkerType> = {
  attraction: "attraction",
  restaurant: "restaurant",
  hotel: "hotel",
  museum: "attraction",
  beach: "attraction",
  park: "poi",
  shopping: "poi",
  nightlife: "poi",
  viewpoint: "poi",
  activity: "waypoint",
};

const OUTDOOR_TYPES = new Set<MarkerType>(["attraction", "poi", "waypoint"]);

export interface BuildOptimizedRoutesOptions {
  travelMode: TravelMode;
  totalDays?: number;
  startHour?: number;
  endHour?: number;
  hotelLocation?: MapCoordinate | null;
  enableAutoOptimization?: boolean;
}

export interface NavigationSummary {
  mode: ItineraryMapMode;
  status: ItineraryMapNavigationState["status"];
  activeRoute: DayRoute | null;
  activeRouteId: string | null;
  currentStepIndex: number;
  steps: ItineraryMapNavigationStep[];
  distanceRemainingMeters: number;
  timeRemainingSeconds: number;
  nextInstruction?: string;
  eta?: string;
  isOffRoute: boolean;
}

function toCoordinate(point: MapCoordinate | Coordinate): Coordinate {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

function toMapCoordinate(point: Coordinate): MapCoordinate {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

export function markerToPlace(marker: MapMarker): Place {
  const estimatedVisitMinutes =
    marker.metadata?.estimatedVisitMinutes ??
    DEFAULT_VISIT_DURATION[marker.type];

  return {
    id: marker.id,
    name: marker.title,
    coordinate: toCoordinate(marker.position),
    category: PLACE_CATEGORY_BY_MARKER[marker.type],
    visitDuration: estimatedVisitMinutes,
    averageCost: DEFAULT_AVERAGE_COST[marker.type],
    rating: marker.metadata?.rating ?? 4.2,
    openingHours: undefined,
    description: marker.subtitle || marker.title,
    imageUrl: undefined,
    tags: [marker.type, marker.metadata?.category || marker.type].filter(
      Boolean,
    ),
    estimatedArrival: undefined,
    estimatedDeparture: undefined,
  };
}

export function placeToMarker(place: Place, dayNumber?: number): MapMarker {
  return {
    id: place.id,
    title: place.name,
    subtitle: place.description,
    position: toMapCoordinate(place.coordinate),
    type: MARKER_TYPE_BY_PLACE[place.category] ?? "poi",
    dayNumber,
    metadata: {
      category: place.category,
      rating: place.rating,
      estimatedVisitMinutes: place.visitDuration,
      isOutdoor: OUTDOOR_TYPES.has(
        MARKER_TYPE_BY_PLACE[place.category] ?? "poi",
      ),
    },
  };
}

function interpolateCoordinates(
  start: MapCoordinate,
  end: MapCoordinate,
  points = 16,
): MapCoordinate[] {
  const steps = Math.max(2, points);
  const coordinates: MapCoordinate[] = [];

  for (let index = 0; index < steps; index += 1) {
    const ratio = index / (steps - 1);
    coordinates.push({
      latitude: start.latitude + (end.latitude - start.latitude) * ratio,
      longitude: start.longitude + (end.longitude - start.longitude) * ratio,
    });
  }

  return coordinates;
}

function simplifyCoordinates(
  coordinates: MapCoordinate[],
  maxPoints = 140,
): MapCoordinate[] {
  if (coordinates.length <= maxPoints) {
    return coordinates;
  }

  const step = Math.ceil(coordinates.length / maxPoints);
  return coordinates.filter(
    (_, index) => index % step === 0 || index === coordinates.length - 1,
  );
}

function normalizeSegmentCoordinates(
  segment: Partial<ItineraryRouteSegment> & {
    coordinates?: Coordinate[];
    encodedPolyline?: string;
  },
  fallbackStart: MapCoordinate,
  fallbackEnd: MapCoordinate,
): MapCoordinate[] {
  if (segment.encodedPolyline) {
    return simplifyCoordinates(
      decodePolyline(segment.encodedPolyline).map((point) => ({
        latitude: point.lat,
        longitude: point.lon,
      })),
    );
  }

  if (segment.coordinates && segment.coordinates.length > 0) {
    return simplifyCoordinates(
      segment.coordinates.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    );
  }

  const points = Math.max(
    10,
    Math.min(48, Math.round((segment.distance ?? 0) / 350)),
  );
  return interpolateCoordinates(fallbackStart, fallbackEnd, points);
}

function routeSegmentToMapSegment(
  route: DayRoute,
  segment: ItineraryRouteSegment & {
    id?: string;
    encodedPolyline?: string;
  },
  index: number,
): DayRoute["segments"][number] {
  const coordinates = normalizeSegmentCoordinates(
    segment,
    route.waypoints[index]?.position || route.waypoints[0].position,
    route.waypoints[index + 1]?.position ||
      route.waypoints[route.waypoints.length - 1].position,
  );

  return {
    id: segment.id || `${route.dayNumber}-${index}`,
    startMarker: segment.from.id,
    endMarker: segment.to.id,
    coordinates,
    encodedPolyline: undefined,
    distanceMeters: Math.round(segment.distance),
    durationSeconds: Math.round(segment.duration * 60),
    trafficDelaySeconds: undefined,
    color: DAY_COLORS[(route.dayNumber - 1) % DAY_COLORS.length],
  };
}

function routeDayToMapRoute(day: ItineraryDay): DayRoute {
  const waypoints = day.places.map((place) =>
    placeToMarker(place, day.dayNumber),
  );
  const route: DayRoute = {
    dayNumber: day.dayNumber,
    segments: [],
    totalDistanceMeters: Math.round(day.totalDistance),
    totalDurationSeconds: Math.round(day.totalTravelTime * 60),
    waypoints,
  };

  route.segments = day.routeSegments.map((segment, index) =>
    routeSegmentToMapSegment(route, segment, index),
  );
  return normalizeRoute(route);
}

function buildSingleDayRoute(
  markers: MapMarker[],
  dayNumber: number,
  travelMode: TravelMode,
  hotelLocation?: MapCoordinate | null,
): DayRoute {
  if (markers.length === 0) {
    return {
      dayNumber,
      segments: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      waypoints: [],
    };
  }

  if (markers.length === 1) {
    const single = markers[0];
    return {
      dayNumber,
      segments: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      waypoints: [single],
    };
  }

  const places = markers.map(markerToPlace);
  const optimization = optimizeRoute(places, {
    travelMode,
    startPoint: hotelLocation
      ? toCoordinate(hotelLocation)
      : places[0].coordinate,
    endPoint: hotelLocation
      ? toCoordinate(hotelLocation)
      : places[places.length - 1].coordinate,
    respectOpeningHours: markers.some((marker) =>
      Boolean(marker.metadata?.openingHours),
    ),
  });

  const markerById = new Map(
    markers.map((marker) => [marker.id, marker] as const),
  );
  const orderedMarkers = optimization.orderedPlaces.map(
    (place) => markerById.get(place.id) || placeToMarker(place, dayNumber),
  );

  const route: DayRoute = {
    dayNumber,
    segments: optimization.routeSegments.map((segment, index) => ({
      id: `${dayNumber}-${segment.from.id}-${segment.to.id}-${index}`,
      startMarker: segment.from.id,
      endMarker: segment.to.id,
      coordinates: normalizeSegmentCoordinates(
        segment,
        orderedMarkers[index]?.position ||
          toMapCoordinate(segment.from.coordinate),
        orderedMarkers[index + 1]?.position ||
          toMapCoordinate(segment.to.coordinate),
      ),
      encodedPolyline: undefined,
      distanceMeters: Math.round(segment.distance),
      durationSeconds: Math.round(segment.duration * 60),
      trafficDelaySeconds: undefined,
      color: DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length],
    })),
    totalDistanceMeters: Math.round(optimization.totalDistance),
    totalDurationSeconds: Math.round(optimization.totalTravelTime * 60),
    waypoints: orderedMarkers,
  };

  return normalizeRoute(route);
}

export function normalizeRoute(route: DayRoute): DayRoute {
  return {
    ...route,
    segments: route.segments.map((segment, index) => ({
      ...segment,
      coordinates: normalizeSegmentCoordinates(
        segment,
        route.waypoints[index]?.position || route.waypoints[0].position,
        route.waypoints[index + 1]?.position ||
          route.waypoints[route.waypoints.length - 1].position,
      ),
      color:
        segment.color || DAY_COLORS[(route.dayNumber - 1) % DAY_COLORS.length],
    })),
  };
}

export function normalizeRoutes(routes: DayRoute[]): DayRoute[] {
  return routes.map(normalizeRoute);
}

function groupMarkersByDay(markers: MapMarker[]): Map<number, MapMarker[]> {
  const grouped = new Map<number, MapMarker[]>();

  for (const marker of markers) {
    const dayNumber = Math.max(1, marker.dayNumber || 1);
    const bucket = grouped.get(dayNumber) || [];
    bucket.push(marker);
    grouped.set(dayNumber, bucket);
  }

  return grouped;
}

export function buildOptimizedRoutes(
  markers: MapMarker[],
  options: BuildOptimizedRoutesOptions,
): DayRoute[] {
  if (!markers.length) {
    return [];
  }

  const totalDays = Math.max(
    DEFAULT_DAY_COUNT,
    options.totalDays || DEFAULT_DAY_COUNT,
  );
  const hasExplicitDays = markers.some(
    (marker) => typeof marker.dayNumber === "number",
  );

  if (hasExplicitDays) {
    const grouped = groupMarkersByDay(markers);
    return Array.from(grouped.entries())
      .sort(([left], [right]) => left - right)
      .map(([dayNumber, group]) =>
        buildSingleDayRoute(
          group,
          dayNumber,
          options.travelMode,
          options.hotelLocation,
        ),
      );
  }

  if (options.enableAutoOptimization === false || markers.length <= 2) {
    return [
      buildSingleDayRoute(
        markers,
        1,
        options.travelMode,
        options.hotelLocation,
      ),
    ];
  }

  if (totalDays > 1 && markers.length > 3) {
    const distributor = new DayDistributor({
      totalDays,
      maxPlacesPerDay: 8,
      maxVisitTimePerDay: 480,
      maxTravelTimePerDay: 180,
      startHour: options.startHour || 9,
      endHour: options.endHour || 20,
      travelMode: options.travelMode,
      hotelLocation: options.hotelLocation
        ? toCoordinate(options.hotelLocation)
        : undefined,
    });

    const distribution = distributor.distribute(markers.map(markerToPlace));
    return normalizeRoutes(distribution.days.map(routeDayToMapRoute));
  }

  return [
    buildSingleDayRoute(markers, 1, options.travelMode, options.hotelLocation),
  ];
}

export function estimateZoomLevel(latitudeDelta: number): number {
  if (!Number.isFinite(latitudeDelta) || latitudeDelta <= 0) {
    return 14;
  }

  const zoom = Math.log2(360 / latitudeDelta);
  return Math.max(1, Math.min(18, Math.round(zoom)));
}

export function clusterMarkers(
  markers: MapMarker[],
  zoomLevel: number,
  threshold = DEFAULT_CLUSTER_THRESHOLD,
): MapCluster[] {
  if (markers.length === 0) {
    return [];
  }

  if (markers.length <= threshold || zoomLevel >= 15) {
    return markers.map((marker) => ({
      id: marker.id,
      center: marker.position,
      markers: [marker],
      count: 1,
    }));
  }

  const cellSize = Math.max(
    0.01,
    0.65 / Math.pow(2, Math.max(0, zoomLevel - 8)),
  );
  const buckets = new Map<string, MapMarker[]>();

  for (const marker of markers) {
    const bucketLat = Math.floor(marker.position.latitude / cellSize);
    const bucketLon = Math.floor(marker.position.longitude / cellSize);
    const bucketKey = `${bucketLat}:${bucketLon}`;
    const bucket = buckets.get(bucketKey) || [];
    bucket.push(marker);
    buckets.set(bucketKey, bucket);
  }

  return Array.from(buckets.entries()).map(([bucketKey, bucketMarkers]) => {
    if (bucketMarkers.length === 1) {
      return {
        id: bucketMarkers[0].id,
        center: bucketMarkers[0].position,
        markers: bucketMarkers,
        count: 1,
      };
    }

    const center = bucketMarkers.reduce(
      (accumulator, marker) => ({
        latitude: accumulator.latitude + marker.position.latitude,
        longitude: accumulator.longitude + marker.position.longitude,
      }),
      { latitude: 0, longitude: 0 },
    );

    return {
      id: `cluster:${bucketKey}`,
      center: {
        latitude: center.latitude / bucketMarkers.length,
        longitude: center.longitude / bucketMarkers.length,
      },
      markers: bucketMarkers,
      count: bucketMarkers.length,
    };
  });
}

export function collectRouteCoordinates(routes: DayRoute[]): MapCoordinate[] {
  const coordinates: MapCoordinate[] = [];

  for (const route of routes) {
    for (const segment of route.segments) {
      coordinates.push(...segment.coordinates);
    }

    for (const waypoint of route.waypoints) {
      coordinates.push(waypoint.position);
    }
  }

  return dedupeCoordinates(coordinates);
}

export function collectMarkerCoordinates(
  markers: MapMarker[],
): MapCoordinate[] {
  return markers.map((marker) => marker.position);
}

export function dedupeCoordinates(
  coordinates: MapCoordinate[],
): MapCoordinate[] {
  const deduped: MapCoordinate[] = [];
  const seen = new Set<string>();

  for (const coordinate of coordinates) {
    const key = `${coordinate.latitude.toFixed(6)}:${coordinate.longitude.toFixed(6)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(coordinate);
    }
  }

  return deduped;
}

export function selectRouteForMarker(
  routes: DayRoute[],
  markerId?: string | null,
): DayRoute | null {
  if (!routes.length) {
    return null;
  }

  if (!markerId) {
    return routes[0];
  }

  return (
    routes.find(
      (route) =>
        route.waypoints.some((marker) => marker.id === markerId) ||
        route.segments.some(
          (segment) =>
            segment.startMarker === markerId || segment.endMarker === markerId,
        ),
    ) || routes[0]
  );
}

function buildNavigationSteps(route: DayRoute): ItineraryMapNavigationStep[] {
  return route.waypoints.slice(1).map((marker, index) => ({
    id: `${route.dayNumber}:${index}`,
    title: marker.title,
    instruction: `Proceed to ${marker.title}`,
    distanceMeters: Math.round(route.segments[index]?.distanceMeters || 0),
    durationSeconds: Math.round(route.segments[index]?.durationSeconds || 0),
    markerId: marker.id,
  }));
}

function distanceBetweenCoordinates(
  left: MapCoordinate,
  right: MapCoordinate,
): number {
  return haversineDistance(
    { latitude: left.latitude, longitude: left.longitude },
    { latitude: right.latitude, longitude: right.longitude },
  );
}

function nearestWaypointIndex(
  route: DayRoute,
  currentLocation: MapCoordinate,
): number {
  if (route.waypoints.length === 0) {
    return 0;
  }

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  route.waypoints.forEach((waypoint, index) => {
    const distance = distanceBetweenCoordinates(
      currentLocation,
      waypoint.position,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return Math.min(bestIndex, Math.max(0, route.waypoints.length - 1));
}

function remainingDistance(
  route: DayRoute,
  startIndex: number,
  currentLocation?: MapCoordinate | null,
): number {
  if (!route.waypoints.length) {
    return 0;
  }

  let total = 0;
  const index = Math.max(0, Math.min(startIndex, route.waypoints.length - 1));

  if (currentLocation) {
    total += distanceBetweenCoordinates(
      currentLocation,
      route.waypoints[index].position,
    );
  }

  for (
    let waypointIndex = index;
    waypointIndex < route.waypoints.length - 1;
    waypointIndex += 1
  ) {
    total += distanceBetweenCoordinates(
      route.waypoints[waypointIndex].position,
      route.waypoints[waypointIndex + 1].position,
    );
  }

  return total;
}

function nearestRoutePointDistance(
  route: DayRoute,
  currentLocation: MapCoordinate,
): number {
  const routeCoordinates = collectRouteCoordinates([route]);
  if (routeCoordinates.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(
    ...routeCoordinates.map((coordinate) =>
      distanceBetweenCoordinates(currentLocation, coordinate),
    ),
  );
}

export function buildNavigationState(
  routes: DayRoute[],
  currentLocation: MapCoordinate | null,
  mode: ItineraryMapMode,
  signals?: ItineraryMapLiveSignals,
  selectedMarkerId?: string | null,
): NavigationSummary {
  const activeRoute = selectRouteForMarker(routes, selectedMarkerId);

  if (!activeRoute) {
    return {
      mode,
      status: "idle",
      activeRoute: null,
      activeRouteId: null,
      currentStepIndex: 0,
      steps: [],
      distanceRemainingMeters: 0,
      timeRemainingSeconds: 0,
      nextInstruction: undefined,
      eta: undefined,
      isOffRoute: false,
    };
  }

  const navigationSteps = buildNavigationSteps(activeRoute);
  const waypointIndex = currentLocation
    ? nearestWaypointIndex(activeRoute, currentLocation)
    : 0;
  const distanceRemainingMeters = currentLocation
    ? remainingDistance(activeRoute, waypointIndex, currentLocation)
    : activeRoute.totalDistanceMeters;
  const trafficDelaySeconds = Math.max(
    0,
    Math.round((signals?.trafficDelayMinutes || 0) * 60),
  );
  const timeRemainingSeconds = Math.max(
    0,
    activeRoute.totalDurationSeconds + trafficDelaySeconds,
  );
  const nextWaypoint =
    activeRoute.waypoints[
      Math.min(waypointIndex + 1, activeRoute.waypoints.length - 1)
    ];
  const nearestDistance = currentLocation
    ? nearestRoutePointDistance(activeRoute, currentLocation)
    : 0;
  const isOffRoute = Boolean(currentLocation && nearestDistance > 600);
  const eta = new Date(Date.now() + timeRemainingSeconds * 1000).toISOString();
  const status: NavigationSummary["status"] = signals?.isOffline
    ? "offline"
    : timeRemainingSeconds <= 0
      ? "arrived"
      : isOffRoute
        ? "rerouting"
        : mode === "navigation" || mode === "live"
          ? "navigating"
          : "idle";

  return {
    mode,
    status,
    activeRoute,
    activeRouteId: `day-${activeRoute.dayNumber}`,
    currentStepIndex: waypointIndex,
    steps: navigationSteps,
    distanceRemainingMeters,
    timeRemainingSeconds,
    nextInstruction: nextWaypoint
      ? `Proceed to ${nextWaypoint.title}`
      : "Arrive at destination",
    eta,
    isOffRoute,
  };
}

function pickAlternativePoi(
  poi: MapPOI[] | undefined,
  marker: MapMarker,
): MapPOI | null {
  if (!poi || poi.length === 0) {
    return null;
  }

  const candidates = poi
    .filter((candidate) => candidate.id !== marker.metadata?.placeId)
    .sort((left, right) => {
      const distanceScore =
        (left.distanceFromRoute ?? Number.POSITIVE_INFINITY) -
        (right.distanceFromRoute ?? Number.POSITIVE_INFINITY);
      if (distanceScore !== 0) {
        return distanceScore;
      }

      const ratingScore = (right.rating ?? 0) - (left.rating ?? 0);
      if (ratingScore !== 0) {
        return ratingScore;
      }

      return Number(right.isOpen ?? false) - Number(left.isOpen ?? false);
    });

  return candidates[0] || null;
}

function isOutdoorMarker(marker: MapMarker): boolean {
  if (typeof marker.metadata?.isOutdoor === "boolean") {
    return marker.metadata.isOutdoor;
  }

  return OUTDOOR_TYPES.has(marker.type);
}

function buildTimeWindow(signal?: ItineraryMapLiveSignals): string {
  if (!signal) {
    return "This is a good general window.";
  }

  if (signal.crowdLevel === "low") {
    return "Now is a good window.";
  }

  if ((signal.rainProbability ?? 0) >= 0.6) {
    return "Wait for clearer weather if this stop is outdoors.";
  }

  if (signal.trafficLevel === "heavy" || signal.trafficLevel === "severe") {
    return "Consider leaving during an off-peak period.";
  }

  return "Use an off-peak window for a smoother visit.";
}

function buildInsightBase(
  marker: MapMarker,
  signal?: ItineraryMapLiveSignals,
  poi?: MapPOI[],
): AIInsight {
  const duration =
    marker.metadata?.estimatedVisitMinutes ??
    DEFAULT_VISIT_DURATION[marker.type];
  const tips: string[] = [];

  if (marker.metadata?.openingHours) {
    tips.push(`Opening hours available for ${marker.title}.`);
  }

  if (marker.metadata?.priority && marker.metadata.priority > 7) {
    tips.push("High priority stop - keep it earlier in the day.");
  }

  if (signal?.isOffline) {
    tips.push("Offline mode is active; guidance is cached locally.");
  }

  const outdoor = isOutdoorMarker(marker);
  const rainProbability = signal?.rainProbability ?? 0;
  const crowdLevel = signal?.crowdLevel ?? "moderate";

  let title =
    marker.metadata?.aiInsight?.title || `Best time for ${marker.title}`;
  let description =
    marker.metadata?.aiInsight?.description ||
    `${marker.title} can be scheduled flexibly.`;

  if (signal?.isOffline) {
    title = `Cached guidance for ${marker.title}`;
    description = "You are offline. Showing the best available local fallback.";
  } else if (outdoor && rainProbability >= 0.6) {
    title = "Rain expected, postpone";
    description = `${marker.title} is outdoors and the forecast suggests rain. Move it to a sheltered slot.`;
  } else if (crowdLevel === "low") {
    title = "Visit now (low crowd)";
    description = `${marker.title} is currently quieter than usual. This is a strong time to go.`;
  } else if (
    signal?.trafficLevel === "heavy" ||
    signal?.trafficLevel === "severe"
  ) {
    title = "Traffic ahead, leave later";
    description = `Traffic around the route is building. Delay departure or pick a nearby alternative.`;
  }

  const alternative = pickAlternativePoi(poi, marker);
  if (alternative) {
    tips.push(`Nearby alternative: ${alternative.name}.`);
  }

  if (signal?.weatherCondition) {
    tips.push(`Weather: ${signal.weatherCondition}.`);
  }

  return {
    title,
    description,
    tips,
    bestTimeToVisit: buildTimeWindow(signal),
    localTip: alternative
      ? `Consider ${alternative.name} (${alternative.category}) as a fallback.`
      : marker.metadata?.openingHours ||
        "Keep buffers around travel and queue times.",
    estimatedDuration: `${duration} min`,
  };
}

export function generateMarkerInsight(
  request: ItineraryMapAIRequest,
  route?: DayRoute | null,
): AIInsight {
  const baseInsight = buildInsightBase(
    request.marker,
    request.signals,
    request.poi,
  );
  const staticInsight = request.marker.metadata?.aiInsight;

  if (!request.signals && !route && staticInsight) {
    return staticInsight;
  }

  if (staticInsight?.tips?.length) {
    return {
      ...baseInsight,
      tips: [
        ...new Set([
          ...(staticInsight.tips || []),
          ...(baseInsight.tips || []),
        ]),
      ],
    };
  }

  return baseInsight;
}

export function routeMetrics(route: DayRoute): {
  distanceKm: number;
  durationMinutes: number;
  stopCount: number;
} {
  return {
    distanceKm: Math.round((route.totalDistanceMeters / 1000) * 10) / 10,
    durationMinutes: Math.max(0, Math.round(route.totalDurationSeconds / 60)),
    stopCount: route.waypoints.length,
  };
}

export function routeCoordinates(route: DayRoute): MapCoordinate[] {
  return collectRouteCoordinates([route]);
}

export function routeBounds(
  routes: DayRoute[],
  markers: MapMarker[],
  currentLocation?: MapCoordinate | null,
): MapCoordinate[] {
  const coordinates = [
    ...routes.flatMap((route) => routeCoordinates(route)),
    ...collectMarkerCoordinates(markers),
  ];

  if (currentLocation) {
    coordinates.push(currentLocation);
  }

  return dedupeCoordinates(coordinates);
}

export function routeBoundingBox(
  routes: DayRoute[],
  markers: MapMarker[],
  currentLocation?: MapCoordinate | null,
) {
  const coordinates = routeBounds(routes, markers, currentLocation);
  if (coordinates.length === 0) {
    return null;
  }

  return calculateBounds(
    coordinates.map((coordinate) => ({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    })),
  );
}
