/**
 * ItineraryMapView
 * Production-grade itinerary map with route optimization, clustering,
 * AI insights, live navigation state, and resilient fallbacks.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import MapView, {
  Callout,
  LatLng,
  Marker,
  Polyline,
  Region,
} from "react-native-maps";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";

import { useLocation } from "@/hooks/useLocation";
import { MAP_PROVIDER } from "@/components/Common/ExpoMap";
import {
  buildNavigationState,
  buildOptimizedRoutes,
  clusterMarkers,
  collectRouteCoordinates,
  DAY_COLORS,
  estimateZoomLevel,
  generateMarkerInsight,
  normalizeRoutes,
  routeCoordinates,
  routeMetrics,
  selectRouteForMarker,
} from "./itineraryMapEngine";
import {
  AIInsight,
  DayRoute,
  ItineraryMapCameraMode,
  ItineraryMapMode,
  ItineraryMapNavigationState,
  ItineraryMapViewProps,
  MapCluster,
  MapCoordinate,
  MapMarker,
  MapPOI,
  getMarkerColor,
  getTrafficColor,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DEFAULT_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

const DEFAULT_EDGE_PADDING = {
  top: 100,
  right: 64,
  bottom: 240,
  left: 64,
};

const DEFAULT_CLUSTER_THRESHOLD = 24;
const VOICE_DEBOUNCE_MS = 220;
const FOCUS_DEBOUNCE_MS = 180;

// ─────────────────────────────────────────────────────────────
// Small Helpers
// ─────────────────────────────────────────────────────────────

function toRegion(center: MapCoordinate, latitudeDelta = 0.05): Region {
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta,
    longitudeDelta: latitudeDelta,
  };
}

function coordinatesToLatLng(coordinates: MapCoordinate[]): LatLng[] {
  return coordinates.map((coordinate) => ({
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  }));
}

type MapDirectionsTravelMode = "car" | "walk" | "transit" | "bike";

function toDirectionsTravelMode(
  travelMode: "drive" | "walk" | "transit" | "bike",
): MapDirectionsTravelMode {
  return travelMode === "drive" ? "car" : travelMode;
}

function formatDistanceMeters(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return "0 m";
  }

  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
}

function formatDurationSeconds(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "0 min";
  }

  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatEta(eta?: string): string {
  if (!eta) {
    return "--";
  }

  const date = new Date(eta);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildMapDirectionsUrl(
  origin: MapCoordinate | null,
  destination: MapCoordinate,
  travelMode: MapDirectionsTravelMode,
): string {
  const destinationLabel = `${destination.latitude},${destination.longitude}`;

  if (Platform.OS === "ios") {
    const originParam = origin
      ? `&saddr=${origin.latitude},${origin.longitude}`
      : "";
    const modeParam =
      travelMode === "walk"
        ? "&dirflg=w"
        : travelMode === "bike"
          ? "&dirflg=b"
          : "&dirflg=d";
    return `http://maps.apple.com/?daddr=${destinationLabel}${originParam}${modeParam}`;
  }

  if (Platform.OS === "android") {
    const modeParam =
      travelMode === "walk"
        ? "&mode=w"
        : travelMode === "bike"
          ? "&mode=b"
          : "&mode=d";
    return `google.navigation:q=${destinationLabel}${modeParam}`;
  }

  const originParam = origin
    ? `origin=${origin.latitude},${origin.longitude}&`
    : "";
  return `https://www.google.com/maps/dir/?api=1&${originParam}destination=${destinationLabel}&travelmode=${travelMode}`;
}

function signatureForMarkers(markers: MapMarker[]): string {
  return markers
    .map((marker) =>
      [
        marker.id,
        marker.position.latitude.toFixed(5),
        marker.position.longitude.toFixed(5),
        marker.dayNumber ?? 0,
        marker.type,
        marker.metadata?.rating ?? 0,
      ].join(":"),
    )
    .join("|");
}

function signatureForPoi(poi: MapPOI[]): string {
  return poi
    .map((item) =>
      [
        item.id,
        item.position.latitude.toFixed(5),
        item.position.longitude.toFixed(5),
        item.distanceFromRoute ?? 0,
        item.rating ?? 0,
        item.isOpen ? 1 : 0,
      ].join(":"),
    )
    .join("|");
}

function signatureForRoutes(routes: DayRoute[]): string {
  return routes
    .map((route) =>
      [
        route.dayNumber,
        route.totalDistanceMeters,
        route.totalDurationSeconds,
        route.waypoints.map((waypoint) => waypoint.id).join(","),
        route.segments.map((segment) => segment.id).join(","),
      ].join(":"),
    )
    .join("|");
}

function mergeInsight(marker: MapMarker, insight: AIInsight | null): MapMarker {
  if (!insight) {
    return marker;
  }

  return {
    ...marker,
    metadata: {
      ...marker.metadata,
      aiInsight: insight,
    },
  };
}

function markerFocusPriority(marker?: MapMarker | null): number {
  if (!marker) {
    return 0;
  }

  return marker.metadata?.priority ?? (marker.dayNumber ? 6 : 4);
}

function routeColorForDay(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}

// ─────────────────────────────────────────────────────────────
// Render Helpers
// ─────────────────────────────────────────────────────────────

interface MarkerPinProps {
  marker: MapMarker;
  isSelected: boolean;
  draggable: boolean;
  onPress: () => void;
  onDragEnd?: (coordinate: MapCoordinate) => void;
}

const MarkerPin = React.memo<MarkerPinProps>(
  ({ marker, isSelected, draggable, onPress, onDragEnd }) => {
    const scale = useSharedValue(isSelected ? 1.18 : 1);

    useEffect(() => {
      scale.value = withSpring(isSelected ? 1.18 : 1, {
        damping: 14,
        stiffness: 280,
      });
    }, [isSelected, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const backgroundColor = marker.dayNumber
      ? routeColorForDay(marker.dayNumber)
      : getMarkerColor(marker.type, isSelected);

    const handlePress = useCallback(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }, [onPress]);

    const handleDragEnd = useCallback(
      (event: any) => {
        const coordinate: MapCoordinate = {
          latitude: event.nativeEvent.coordinate.latitude,
          longitude: event.nativeEvent.coordinate.longitude,
        };
        onDragEnd?.(coordinate);
      },
      [onDragEnd],
    );

    return (
      <Marker
        coordinate={marker.position}
        onPress={handlePress}
        draggable={draggable}
        onDragEnd={handleDragEnd}
        tracksViewChanges={false}
        anchor={{ x: 0.5, y: 1 }}
      >
        <Animated.View style={[styles.markerContainer, animatedStyle]}>
          <View
            style={[
              styles.markerPin,
              { backgroundColor },
              isSelected && styles.markerSelected,
            ]}
          >
            {marker.dayNumber ? (
              <Text style={styles.markerNumber}>{marker.dayNumber}</Text>
            ) : (
              <View style={styles.markerDot} />
            )}
          </View>
          {marker.order ? (
            <View style={styles.orderBadge}>
              <Text style={styles.orderText}>{marker.order}</Text>
            </View>
          ) : null}
        </Animated.View>
        <Callout tooltip>
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutTitle}>{marker.title}</Text>
            {marker.subtitle ? (
              <Text style={styles.calloutSubtitle}>{marker.subtitle}</Text>
            ) : null}
            {marker.metadata?.aiInsight ? (
              <Text style={styles.calloutInsight}>
                {marker.metadata.aiInsight.title}
              </Text>
            ) : null}
          </View>
        </Callout>
      </Marker>
    );
  },
);

MarkerPin.displayName = "MarkerPin";

interface ClusterPinProps {
  cluster: MapCluster;
  onPress: () => void;
}

const ClusterPin = React.memo<ClusterPinProps>(({ cluster, onPress }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 260 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  return (
    <Marker
      coordinate={cluster.center}
      onPress={handlePress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <Animated.View style={[styles.clusterOuter, animatedStyle]}>
        <View style={styles.clusterInner}>
          <Text style={styles.clusterCount}>{cluster.count}</Text>
        </View>
      </Animated.View>
    </Marker>
  );
});

ClusterPin.displayName = "ClusterPin";

interface PoiPinProps {
  poi: MapPOI;
  isSelected: boolean;
  onPress?: () => void;
}

const PoiPin = React.memo<PoiPinProps>(({ poi, isSelected, onPress }) => {
  const backgroundColor = isSelected ? "#6366F1" : "#F59E0B";

  return (
    <Marker
      coordinate={poi.position}
      onPress={onPress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View
        style={[
          styles.poiPin,
          { backgroundColor },
          isSelected && styles.poiSelected,
        ]}
      >
        <Text style={styles.poiPinText}>•</Text>
      </View>
      <Callout tooltip>
        <View style={styles.calloutContainer}>
          <Text style={styles.calloutTitle}>{poi.name}</Text>
          <Text style={styles.calloutSubtitle}>{poi.category}</Text>
        </View>
      </Callout>
    </Marker>
  );
});

PoiPin.displayName = "PoiPin";

interface RoutePolylineProps {
  route: DayRoute;
  showTraffic: boolean;
}

const RoutePolyline = React.memo<RoutePolylineProps>(
  ({ route, showTraffic }) => {
    const color = routeColorForDay(route.dayNumber);

    return (
      <>
        {route.segments.map((segment) => (
          <Polyline
            key={segment.id}
            coordinates={coordinatesToLatLng(segment.coordinates)}
            strokeColor={showTraffic ? color : color}
            strokeWidth={showTraffic ? 5 : 4}
            lineCap="round"
            lineJoin="round"
            zIndex={route.dayNumber}
          />
        ))}
      </>
    );
  },
);

RoutePolyline.displayName = "RoutePolyline";

interface InfoChipProps {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}

const InfoChip = ({ label, value, tone = "neutral" }: InfoChipProps) => (
  <View
    style={[
      styles.infoChip,
      tone === "positive" && styles.infoChipPositive,
      tone === "warning" && styles.infoChipWarning,
      tone === "danger" && styles.infoChipDanger,
    ]}
  >
    <Text style={styles.infoChipLabel}>{label}</Text>
    <Text style={styles.infoChipValue}>{value}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export const ItineraryMapView: React.FC<ItineraryMapViewProps> = ({
  markers,
  routes,
  poi = [],
  selectedMarkerId,
  onMarkerPress,
  onMapPress,
  onMapLongPress,
  onPOIPress,
  onMarkerLongPress,
  onSelectionChange,
  showTraffic = false,
  showPOIs = true,
  initialCamera,
  controller,
  style,
}) => {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();
  const location = useLocation();

  const [mapReady, setMapReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(12);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [computedRoutes, setComputedRoutes] = useState<DayRoute[]>([]);
  const [insightMap, setInsightMap] = useState<Record<string, AIInsight>>({});
  const [selectedMarkerInternalId, setSelectedMarkerInternalId] = useState<
    string | null
  >(selectedMarkerId ?? null);
  const [followMode, setFollowMode] = useState<boolean>(
    controller?.followUserLocation ?? false,
  );
  const [cameraMode, setCameraMode] = useState<ItineraryMapCameraMode>(
    controller?.cameraMode ?? "auto",
  );
  const [navigationMode, setNavigationMode] = useState<ItineraryMapMode>(
    controller?.navigationMode ?? "preview",
  );
  const [refreshNonce, setRefreshNonce] = useState(0);

  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVoiceInstructionRef = useRef<string | null>(null);
  const routeRequestIdRef = useRef(0);
  const insightRequestIdRef = useRef(0);

  const travelMode = controller?.travelMode ?? "drive";
  const totalDays = controller?.totalDays ?? 1;
  const routePreferences = controller?.routePreferences;
  const liveSignals = controller?.liveSignals;
  const routeProvider = controller?.routeProvider;
  const aiService = controller?.aiService;
  const enableAutoOptimization = controller?.enableAutoOptimization ?? true;
  const enableClustering = controller?.enableClustering ?? true;
  const clusterThreshold =
    controller?.clusterThreshold ?? DEFAULT_CLUSTER_THRESHOLD;
  const effectiveMode = controller?.navigationMode ?? navigationMode;
  const selectedMarkerProp = selectedMarkerId;

  useEffect(() => {
    if (typeof selectedMarkerProp !== "undefined") {
      setSelectedMarkerInternalId(selectedMarkerProp ?? null);
    }
  }, [selectedMarkerProp]);

  useEffect(() => {
    if (typeof controller?.cameraMode !== "undefined") {
      setCameraMode(controller.cameraMode);
    }
  }, [controller?.cameraMode]);

  useEffect(() => {
    if (typeof controller?.navigationMode !== "undefined") {
      setNavigationMode(controller.navigationMode);
    }
  }, [controller?.navigationMode]);

  useEffect(() => {
    if (typeof controller?.followUserLocation !== "undefined") {
      setFollowMode(controller.followUserLocation);
    }
  }, [controller?.followUserLocation]);

  const markersKey = useMemo(() => signatureForMarkers(markers), [markers]);
  const poiKey = useMemo(() => signatureForPoi(poi), [poi]);
  const providedRoutesKey = useMemo(
    () => signatureForRoutes(routes ?? []),
    [routes],
  );
  const liveSignalsKey = useMemo(
    () => JSON.stringify(liveSignals ?? {}),
    [liveSignals],
  );
  const routePreferencesKey = useMemo(
    () => JSON.stringify(routePreferences ?? {}),
    [routePreferences],
  );
  const hotelLocationKey = useMemo(
    () =>
      controller?.hotelLocation
        ? `${controller.hotelLocation.latitude}:${controller.hotelLocation.longitude}`
        : "",
    [controller?.hotelLocation],
  );

  const [localMarkers, setLocalMarkers] = useState<MapMarker[]>(markers);

  useEffect(() => {
    setLocalMarkers(markers);
  }, [markersKey]);

  const displayMarkers = useMemo(
    () =>
      localMarkers.map((marker) =>
        mergeInsight(
          marker,
          insightMap[marker.id] || marker.metadata?.aiInsight || null,
        ),
      ),
    [localMarkers, insightMap],
  );
  const displayMarkersKey = useMemo(
    () => signatureForMarkers(displayMarkers),
    [displayMarkers],
  );

  const providedRoutes = useMemo(
    () => normalizeRoutes(routes ?? []),
    [providedRoutesKey],
  );

  const fallbackRoutes = useMemo(
    () =>
      buildOptimizedRoutes(displayMarkers, {
        travelMode,
        totalDays,
        startHour: controller?.startHour,
        endHour: controller?.endHour,
        hotelLocation: controller?.hotelLocation ?? null,
        enableAutoOptimization,
      }),
    [
      displayMarkers,
      travelMode,
      totalDays,
      controller?.startHour,
      controller?.endHour,
      hotelLocationKey,
      enableAutoOptimization,
      markersKey,
    ],
  );

  const resolvedRoutes = useMemo(
    () =>
      providedRoutes.length > 0
        ? providedRoutes
        : computedRoutes.length > 0
          ? computedRoutes
          : fallbackRoutes,
    [providedRoutes, computedRoutes, fallbackRoutes],
  );

  const selectedMarker = useMemo(
    () =>
      displayMarkers.find(
        (marker) =>
          marker.id === (selectedMarkerProp ?? selectedMarkerInternalId),
      ) || null,
    [displayMarkers, selectedMarkerInternalId, selectedMarkerProp],
  );

  const activeRoute = useMemo(
    () =>
      selectRouteForMarker(resolvedRoutes, selectedMarker?.id) ||
      resolvedRoutes[0] ||
      null,
    [resolvedRoutes, selectedMarker?.id],
  );

  const activeRouteCoordinates = useMemo(
    () => (activeRoute ? routeCoordinates(activeRoute) : []),
    [activeRoute],
  );

  const currentLocationCoordinate = useMemo<MapCoordinate | null>(() => {
    if (!location.location) {
      return null;
    }

    return {
      latitude: location.location.latitude,
      longitude: location.location.longitude,
    };
  }, [location.location]);

  const navigationSummary = useMemo(
    () =>
      buildNavigationState(
        resolvedRoutes,
        currentLocationCoordinate,
        effectiveMode,
        liveSignals,
        selectedMarker?.id ?? null,
      ),
    [
      resolvedRoutes,
      currentLocationCoordinate,
      effectiveMode,
      liveSignalsKey,
      selectedMarker?.id,
    ],
  );

  const navigationState = useMemo<ItineraryMapNavigationState>(
    () => ({
      mode: navigationSummary.mode,
      status: navigationSummary.status,
      activeRouteId: navigationSummary.activeRouteId,
      currentStepIndex: navigationSummary.currentStepIndex,
      totalSteps: navigationSummary.steps.length,
      distanceRemainingMeters: navigationSummary.distanceRemainingMeters,
      timeRemainingSeconds: navigationSummary.timeRemainingSeconds,
      nextInstruction: navigationSummary.nextInstruction,
      eta: navigationSummary.eta,
      isOffRoute: navigationSummary.isOffRoute,
    }),
    [navigationSummary],
  );

  const routeSummary = useMemo(
    () => (activeRoute ? routeMetrics(activeRoute) : null),
    [activeRoute],
  );

  const clusters = useMemo(() => {
    if (!enableClustering) {
      return displayMarkers.map((marker) => ({
        id: marker.id,
        center: marker.position,
        markers: [marker],
        count: 1,
      })) as MapCluster[];
    }

    return clusterMarkers(displayMarkers, zoomLevel, clusterThreshold);
  }, [displayMarkers, zoomLevel, enableClustering, clusterThreshold]);

  const renderableMarkers = useMemo(() => {
    if (!enableClustering || clusters.length === 0) {
      return displayMarkers;
    }

    return clusters.flatMap((cluster) =>
      cluster.count > 1 ? [] : cluster.markers,
    );
  }, [enableClustering, clusters, displayMarkers]);

  useEffect(() => {
    onSelectionChange?.(selectedMarker);
  }, [selectedMarker?.id, onSelectionChange]);

  useEffect(() => {
    controller?.onNavigationStateChange?.(navigationState);
  }, [navigationState, controller]);

  useEffect(() => {
    if (!controller?.onVoiceInstruction) {
      return;
    }

    const nextStep =
      navigationSummary.steps[navigationSummary.currentStepIndex] || null;
    const instruction =
      navigationSummary.nextInstruction ||
      nextStep?.instruction ||
      nextStep?.title ||
      nextStep?.markerId ||
      null;
    if (!instruction) {
      return;
    }

    if (
      navigationSummary.status !== "navigating" &&
      navigationSummary.status !== "rerouting"
    ) {
      return;
    }

    if (lastVoiceInstructionRef.current === instruction) {
      return;
    }

    const timer = setTimeout(() => {
      lastVoiceInstructionRef.current = instruction;
      controller.onVoiceInstruction?.(instruction);
    }, VOICE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    navigationSummary.status,
    navigationSummary.nextInstruction,
    navigationSummary.currentStepIndex,
    controller?.onVoiceInstruction,
  ]);

  useEffect(() => {
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }

    if (!mapReady || !mapRef.current) {
      return;
    }

    const shouldFollowLocation =
      followMode ||
      navigationSummary.status === "navigating" ||
      navigationSummary.status === "rerouting";
    const shouldPreferSelection =
      cameraMode === "selection" || (cameraMode === "auto" && selectedMarker);
    const shouldPreferUser = cameraMode === "user" || shouldFollowLocation;
    const shouldPreferRoute =
      cameraMode === "route" ||
      (cameraMode === "auto" &&
        !shouldPreferSelection &&
        !shouldPreferUser &&
        resolvedRoutes.length > 0);

    focusTimerRef.current = setTimeout(() => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      if (shouldPreferUser && currentLocationCoordinate) {
        map.animateCamera({
          center: currentLocationCoordinate,
          zoom: Math.max(14, zoomLevel),
        });
        return;
      }

      if (shouldPreferSelection && selectedMarker) {
        map.animateCamera({
          center: selectedMarker.position,
          zoom: Math.max(14, zoomLevel),
        });
        return;
      }

      if (shouldPreferRoute && activeRouteCoordinates.length > 1) {
        map.fitToCoordinates(coordinatesToLatLng(activeRouteCoordinates), {
          edgePadding: DEFAULT_EDGE_PADDING,
          animated: true,
        });
        return;
      }

      const fallbackCoordinates = displayMarkers.map(
        (marker) => marker.position,
      );
      if (fallbackCoordinates.length > 1) {
        map.fitToCoordinates(coordinatesToLatLng(fallbackCoordinates), {
          edgePadding: DEFAULT_EDGE_PADDING,
          animated: true,
        });
      } else if (fallbackCoordinates.length === 1) {
        map.animateCamera({
          center: fallbackCoordinates[0],
          zoom: 14,
        });
      }
    }, FOCUS_DEBOUNCE_MS);

    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [
    mapReady,
    selectedMarker?.id,
    activeRoute?.dayNumber,
    activeRouteCoordinates.length,
    currentLocationCoordinate?.latitude,
    currentLocationCoordinate?.longitude,
    zoomLevel,
    followMode,
    cameraMode,
    resolvedRoutes.length,
    displayMarkersKey,
    navigationSummary.status,
  ]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    if (insightTimerRef.current) {
      clearTimeout(insightTimerRef.current);
    }

    const targets: MapMarker[] = [];
    if (selectedMarker) {
      targets.push(selectedMarker);
    }

    for (const waypoint of activeRoute?.waypoints ?? []) {
      if (targets.length >= 4) {
        break;
      }
      if (!targets.some((candidate) => candidate.id === waypoint.id)) {
        targets.push(waypoint);
      }
    }

    if (targets.length === 0) {
      return;
    }

    const targetSignature = targets
      .map(
        (marker) =>
          `${marker.id}:${liveSignalsKey}:${poiKey}:${activeRoute?.dayNumber ?? 0}`,
      )
      .join("|");
    const requestId = ++insightRequestIdRef.current;

    insightTimerRef.current = setTimeout(() => {
      Promise.all(
        targets.map(async (marker) => {
          if (aiService) {
            const insight = await aiService.inferInsight({
              marker,
              route: activeRoute || undefined,
              signals: liveSignals,
              userLocation: currentLocationCoordinate,
              poi,
            });
            return [marker.id, insight] as const;
          }

          const insight = generateMarkerInsight(
            {
              marker,
              route: activeRoute || undefined,
              signals: liveSignals,
              userLocation: currentLocationCoordinate,
              poi,
            },
            activeRoute,
          );

          return [marker.id, insight] as const;
        }),
      )
        .then((results) => {
          if (requestId !== insightRequestIdRef.current) {
            return;
          }

          setInsightMap((previous) => {
            const next = { ...previous };
            for (const [markerId, insight] of results) {
              if (insight) {
                next[markerId] = insight;
              }
            }
            return next;
          });
        })
        .catch(() => {
          // Keep previously cached insights on failure.
        });
    }, 180);

    return () => {
      if (insightTimerRef.current) {
        clearTimeout(insightTimerRef.current);
        insightTimerRef.current = null;
      }
    };
  }, [
    mapReady,
    selectedMarker?.id,
    activeRoute?.dayNumber,
    liveSignalsKey,
    poiKey,
    currentLocationCoordinate?.latitude,
    currentLocationCoordinate?.longitude,
    aiService,
    activeRoute?.waypoints?.length,
  ]);

  useEffect(() => {
    const requestId = ++routeRequestIdRef.current;

    const run = async () => {
      if (providedRoutes.length > 0) {
        setRouteLoading(false);
        setRouteError(null);
        return;
      }

      if (displayMarkers.length === 0) {
        setComputedRoutes([]);
        setRouteLoading(false);
        setRouteError(null);
        controller?.onRouteOptimized?.([]);
        return;
      }

      if (
        netInfo.isConnected === false ||
        netInfo.isInternetReachable === false ||
        !routeProvider
      ) {
        setComputedRoutes(fallbackRoutes);
        setRouteLoading(false);
        setRouteError(
          netInfo.isConnected === false
            ? "Offline mode: using local route optimization."
            : null,
        );
        controller?.onRouteOptimized?.(fallbackRoutes);
        return;
      }

      setRouteLoading(true);
      setRouteError(null);

      try {
        const remoteRoutes = await routeProvider({
          markers: displayMarkers,
          travelMode,
          totalDays,
          routePreferences,
          liveSignals,
        });

        if (requestId !== routeRequestIdRef.current) {
          return;
        }

        const normalized = normalizeRoutes(
          remoteRoutes.length > 0 ? remoteRoutes : fallbackRoutes,
        );
        setComputedRoutes(normalized);
        setRouteError(null);
        controller?.onRouteOptimized?.(normalized);
      } catch (error) {
        if (requestId !== routeRequestIdRef.current) {
          return;
        }

        setComputedRoutes(fallbackRoutes);
        setRouteError("Live routing failed. Showing locally optimized routes.");
        controller?.onRouteOptimized?.(fallbackRoutes);
      } finally {
        if (requestId === routeRequestIdRef.current) {
          setRouteLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      void run();
    }, 160);

    return () => clearTimeout(timer);
  }, [
    providedRoutesKey,
    markersKey,
    travelMode,
    totalDays,
    routePreferencesKey,
    liveSignalsKey,
    fallbackRoutes,
    routeProvider,
    netInfo.isConnected,
    netInfo.isInternetReachable,
    refreshNonce,
  ]);

  const activeRouteCoordinatesLatLng = useMemo(
    () => coordinatesToLatLng(activeRouteCoordinates),
    [activeRouteCoordinates],
  );
  const markerCoordinatesLatLng = useMemo(
    () => coordinatesToLatLng(displayMarkers.map((marker) => marker.position)),
    [displayMarkersKey],
  );

  const initialRegion = useMemo<Region>(() => {
    if (initialCamera?.center) {
      return {
        latitude: initialCamera.center.latitude,
        longitude: initialCamera.center.longitude,
        latitudeDelta: initialCamera.zoom
          ? 360 / Math.pow(2, initialCamera.zoom)
          : 0.05,
        longitudeDelta: initialCamera.zoom
          ? 360 / Math.pow(2, initialCamera.zoom)
          : 0.05,
      };
    }

    if (activeRouteCoordinatesLatLng.length > 1) {
      const lats = activeRouteCoordinatesLatLng.map(
        (coordinate) => coordinate.latitude,
      );
      const lons = activeRouteCoordinatesLatLng.map(
        (coordinate) => coordinate.longitude,
      );
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.8),
        longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.8),
      };
    }

    if (markerCoordinatesLatLng.length === 1) {
      return toRegion(markerCoordinatesLatLng[0], 0.02);
    }

    return DEFAULT_REGION;
  }, [
    initialCamera?.center?.latitude,
    initialCamera?.center?.longitude,
    initialCamera?.zoom,
    activeRouteCoordinatesLatLng.length,
    markerCoordinatesLatLng.length,
  ]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setZoomLevel(estimateZoomLevel(region.latitudeDelta));
  }, []);

  const handleMarkerPress = useCallback(
    (marker: MapMarker) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedMarkerInternalId(marker.id);
      onMarkerPress?.(marker);
    },
    [onMarkerPress],
  );

  const handleMarkerDragEnd = useCallback(
    (marker: MapMarker, coordinate: MapCoordinate) => {
      setLocalMarkers((previous) => {
        const updated = previous.map((candidate) =>
          candidate.id === marker.id
            ? { ...candidate, position: coordinate }
            : candidate,
        );

        if (controller?.onRouteReordered) {
          const reordered = buildOptimizedRoutes(updated, {
            travelMode,
            totalDays,
            startHour: controller?.startHour,
            endHour: controller?.endHour,
            hotelLocation: controller?.hotelLocation ?? null,
            enableAutoOptimization,
          }).flatMap((route) => route.waypoints);
          controller.onRouteReordered(reordered);
        }

        return updated;
      });

      controller?.onMarkerDragEnd?.({ ...marker, position: coordinate });
      setRefreshNonce((value) => value + 1);
    },
    [controller, travelMode, totalDays, enableAutoOptimization],
  );

  const handleClusterPress = useCallback(
    (cluster: MapCluster) => {
      if (!mapRef.current) {
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (cluster.markers.length > 1) {
        mapRef.current.fitToCoordinates(
          coordinatesToLatLng(cluster.markers.map((marker) => marker.position)),
          {
            edgePadding: DEFAULT_EDGE_PADDING,
            animated: true,
          },
        );
        return;
      }

      mapRef.current.animateCamera({
        center: cluster.center,
        zoom: Math.max(14, zoomLevel + 2),
      });
    },
    [zoomLevel],
  );

  const handleMapPress = useCallback(
    (event?: { nativeEvent?: { coordinate?: MapCoordinate } }) => {
      setSelectedMarkerInternalId(null);
      controller?.onNavigationAction?.("pause");
      onMapPress?.(
        event?.nativeEvent?.coordinate || { latitude: 0, longitude: 0 },
      );
    },
    [controller, onMapPress],
  );

  const handleMapLongPress = useCallback(
    (event: { nativeEvent: { coordinate: MapCoordinate } }) => {
      onMapLongPress?.(event.nativeEvent.coordinate);
    },
    [onMapLongPress],
  );

  const focusCurrentContext = useCallback(() => {
    if (!mapRef.current) {
      return;
    }

    if (followMode && currentLocationCoordinate) {
      mapRef.current.animateCamera({
        center: currentLocationCoordinate,
        zoom: Math.max(14, zoomLevel),
      });
      return;
    }

    if (selectedMarker) {
      mapRef.current.animateCamera({
        center: selectedMarker.position,
        zoom: Math.max(14, zoomLevel),
      });
      return;
    }

    if (activeRouteCoordinatesLatLng.length > 1) {
      mapRef.current.fitToCoordinates(activeRouteCoordinatesLatLng, {
        edgePadding: DEFAULT_EDGE_PADDING,
        animated: true,
      });
      return;
    }

    if (markerCoordinatesLatLng.length > 1) {
      mapRef.current.fitToCoordinates(markerCoordinatesLatLng, {
        edgePadding: DEFAULT_EDGE_PADDING,
        animated: true,
      });
      return;
    }

    if (markerCoordinatesLatLng.length === 1) {
      mapRef.current.animateCamera({
        center: markerCoordinatesLatLng[0],
        zoom: 14,
      });
    }
  }, [
    followMode,
    currentLocationCoordinate,
    selectedMarker,
    activeRouteCoordinatesLatLng,
    markerCoordinatesLatLng,
    zoomLevel,
  ]);

  const handleZoomIn = useCallback(() => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.getCamera().then((camera) => {
      mapRef.current?.animateCamera({ zoom: (camera.zoom || zoomLevel) + 1 });
    });
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.getCamera().then((camera) => {
      mapRef.current?.animateCamera({
        zoom: Math.max(1, (camera.zoom || zoomLevel) - 1),
      });
    });
  }, [zoomLevel]);

  const handleCenter = useCallback(() => {
    focusCurrentContext();
    controller?.onNavigationAction?.("recenter");
  }, [focusCurrentContext, controller]);

  const handleStartNavigation = useCallback(() => {
    setNavigationMode("navigation");
    setFollowMode(true);
    controller?.onNavigationAction?.("start");
    focusCurrentContext();
  }, [controller, focusCurrentContext]);

  const handlePauseNavigation = useCallback(() => {
    setNavigationMode("preview");
    controller?.onNavigationAction?.("pause");
  }, [controller]);

  const handleStopNavigation = useCallback(() => {
    setNavigationMode("preview");
    setFollowMode(false);
    controller?.onNavigationAction?.("stop");
  }, [controller]);

  const handleFollowToggle = useCallback(() => {
    setFollowMode((previous) => !previous);
    controller?.onNavigationAction?.("recenter");
    focusCurrentContext();
  }, [controller, focusCurrentContext]);

  const handleDirections = useCallback(async () => {
    const target = selectedMarker;
    if (!target) {
      return;
    }

    const url = buildMapDirectionsUrl(
      currentLocationCoordinate,
      target.position,
      toDirectionsTravelMode(travelMode),
    );
    try {
      await Linking.openURL(url);
      setNavigationMode("live");
      setFollowMode(true);
      controller?.onNavigationAction?.("start");
    } catch {
      controller?.onLocationError?.("Unable to open native directions app.");
    }
  }, [selectedMarker, currentLocationCoordinate, travelMode, controller]);

  const handleAddToItinerary = useCallback(() => {
    if (!selectedMarker) {
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    controller?.onAddToItinerary?.(selectedMarker);
  }, [selectedMarker, controller]);

  const handleRefreshRoutes = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const selectedInsight =
    selectedMarker?.metadata?.aiInsight ||
    (selectedMarker ? insightMap[selectedMarker.id] : null) ||
    null;
  const routeStats = activeRoute ? routeMetrics(activeRoute) : null;
  const nextStep =
    navigationSummary.steps[navigationSummary.currentStepIndex] || null;
  const topSteps = nextStep
    ? [
        nextStep,
        ...navigationSummary.steps.slice(
          navigationSummary.currentStepIndex + 1,
          navigationSummary.currentStepIndex + 3,
        ),
      ]
    : navigationSummary.steps.slice(0, 3);

  const statusTone =
    routeError || location.error
      ? "danger"
      : netInfo.isConnected === false || netInfo.isInternetReachable === false
        ? "warning"
        : navigationSummary.status === "navigating" ||
            navigationSummary.status === "rerouting"
          ? "positive"
          : "neutral";

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        provider={MAP_PROVIDER || undefined}
        onMapReady={handleMapReady}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handleMapPress}
        onLongPress={handleMapLongPress}
        showsUserLocation={Boolean(location.hasPermission)}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={showTraffic}
        loadingEnabled
        loadingIndicatorColor="#6366F1"
        loadingBackgroundColor="#E2E8F0"
        mapPadding={{
          top: insets.top + 80,
          right: 24,
          bottom: insets.bottom + 220,
          left: 24,
        }}
      >
        {resolvedRoutes.map((route) => (
          <RoutePolyline
            key={`route-${route.dayNumber}-${route.totalDistanceMeters}-${route.totalDurationSeconds}`}
            route={route}
            showTraffic={showTraffic}
          />
        ))}

        {enableClustering && clusters.length > 0
          ? clusters.map((cluster) =>
              cluster.count > 1 ? (
                <ClusterPin
                  key={cluster.id}
                  cluster={cluster}
                  onPress={() => handleClusterPress(cluster)}
                />
              ) : null,
            )
          : null}

        {renderableMarkers.map((marker) => (
          <MarkerPin
            key={marker.id}
            marker={marker}
            isSelected={marker.id === selectedMarker?.id}
            draggable={Boolean(
              controller?.onMarkerDragEnd || controller?.onRouteReordered,
            )}
            onPress={() => handleMarkerPress(marker)}
            onDragEnd={(coordinate) => handleMarkerDragEnd(marker, coordinate)}
          />
        ))}

        {showPOIs
          ? poi.map((point) => (
              <PoiPin
                key={point.id}
                poi={point}
                isSelected={false}
                onPress={() => onPOIPress?.(point)}
              />
            ))
          : null}
      </MapView>

      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(160)}
        style={[styles.topOverlay, { top: insets.top + 10 }]}
      >
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              statusTone === "warning" && styles.badgeWarning,
              statusTone === "danger" && styles.badgeDanger,
              statusTone === "positive" && styles.badgePositive,
            ]}
          >
            <Text style={styles.badgeText}>
              {routeLoading
                ? "Optimizing routes"
                : netInfo.isConnected === false
                  ? "Offline mode"
                  : navigationSummary.status === "navigating"
                    ? "Live navigation"
                    : "Preview mode"}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {resolvedRoutes.length} route
              {resolvedRoutes.length === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {displayMarkers.length} stop
              {displayMarkers.length === 1 ? "" : "s"}
            </Text>
          </View>
          {liveSignals?.trafficLevel ? (
            <View style={styles.badge}>
              <Text
                style={styles.badgeText}
              >{`Traffic ${liveSignals.trafficLevel}`}</Text>
            </View>
          ) : null}
          {liveSignals?.crowdLevel ? (
            <View style={styles.badge}>
              <Text
                style={styles.badgeText}
              >{`Crowd ${liveSignals.crowdLevel}`}</Text>
            </View>
          ) : null}
        </View>

        {routeError || location.error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Map issue</Text>
            <Text style={styles.errorText}>{routeError || location.error}</Text>
            <Pressable style={styles.errorAction} onPress={handleRefreshRoutes}>
              <Text style={styles.errorActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View
        entering={SlideInUp.springify().damping(20)}
        exiting={SlideOutDown.springify().damping(20)}
        style={[
          styles.bottomSheet,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderLeft}>
            <Text style={styles.sheetTitle}>
              {selectedMarker ? selectedMarker.title : "Itinerary Navigator"}
            </Text>
            <Text style={styles.sheetSubtitle}>
              {selectedMarker
                ? selectedMarker.subtitle || selectedMarker.type
                : "AI-assisted route planning and turn-by-turn guidance"}
            </Text>
          </View>
          <View style={styles.sheetHeaderRight}>
            <Pressable style={styles.smallAction} onPress={handleCenter}>
              <Text style={styles.smallActionText}>Center</Text>
            </Pressable>
            <Pressable style={styles.smallAction} onPress={handleFollowToggle}>
              <Text style={styles.smallActionText}>
                {followMode ? "Follow" : "Track"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <InfoChip
            label="Distance"
            value={
              routeStats
                ? formatDistanceMeters(activeRoute?.totalDistanceMeters || 0)
                : "--"
            }
          />
          <InfoChip label="ETA" value={formatEta(navigationSummary.eta)} />
          <InfoChip
            label="Mode"
            value={effectiveMode}
            tone={
              navigationSummary.status === "navigating" ? "positive" : "neutral"
            }
          />
        </View>

        <View style={styles.routeSummaryRow}>
          <View style={styles.routeSummaryBlock}>
            <Text style={styles.routeSummaryLabel}>Remaining</Text>
            <Text style={styles.routeSummaryValue}>
              {formatDistanceMeters(navigationSummary.distanceRemainingMeters)}
            </Text>
          </View>
          <View style={styles.routeSummaryBlock}>
            <Text style={styles.routeSummaryLabel}>Travel Time</Text>
            <Text style={styles.routeSummaryValue}>
              {formatDurationSeconds(navigationSummary.timeRemainingSeconds)}
            </Text>
          </View>
          <View style={styles.routeSummaryBlock}>
            <Text style={styles.routeSummaryLabel}>Traffic</Text>
            <Text style={styles.routeSummaryValue}>
              {liveSignals?.trafficLevel || "live"}
            </Text>
          </View>
        </View>

        {nextStep ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepLabel}>Next instruction</Text>
            <Text style={styles.stepTitle}>{nextStep.title}</Text>
            <Text style={styles.stepText}>{nextStep.instruction}</Text>
          </View>
        ) : null}

        {topSteps.length > 0 ? (
          <View style={styles.stepList}>
            {topSteps.slice(0, 3).map((step, index) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={styles.stepIndexBadge}>
                  <Text style={styles.stepIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepRowTitle}>{step.title}</Text>
                  <Text style={styles.stepRowText}>{step.instruction}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {selectedInsight ? (
          <View style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiHeaderLabel}>AI Insight</Text>
              <Text style={styles.aiHeaderMeta}>
                {selectedMarker?.metadata?.estimatedVisitMinutes
                  ? `${selectedMarker.metadata.estimatedVisitMinutes} min`
                  : "Live"}
              </Text>
            </View>
            <Text style={styles.aiTitle}>{selectedInsight.title}</Text>
            <Text style={styles.aiDescription}>
              {selectedInsight.description}
            </Text>
            {selectedInsight.tips?.length ? (
              <View style={styles.aiTips}>
                {selectedInsight.tips.slice(0, 3).map((tip) => (
                  <Text key={tip} style={styles.aiTip}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.aiMetaRow}>
              <Text style={styles.aiMetaLabel}>Best window</Text>
              <Text style={styles.aiMetaValue}>
                {selectedInsight.bestTimeToVisit || "Anytime"}
              </Text>
            </View>
            <View style={styles.aiButtonRow}>
              <Pressable
                style={[styles.aiButton, styles.aiButtonSecondary]}
                onPress={handleAddToItinerary}
              >
                <Text style={styles.aiButtonSecondaryText}>Add to Trip</Text>
              </Pressable>
              <Pressable
                style={[styles.aiButton, styles.aiButtonPrimary]}
                onPress={handleDirections}
              >
                <Text style={styles.aiButtonPrimaryText}>Directions</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.controlRow}>
          <Pressable style={styles.controlButton} onPress={handleZoomIn}>
            <Text style={styles.controlButtonText}>+</Text>
          </Pressable>
          <Pressable style={styles.controlButton} onPress={handleZoomOut}>
            <Text style={styles.controlButtonText}>−</Text>
          </Pressable>
          <Pressable
            style={[styles.controlButton, styles.controlButtonPrimary]}
            onPress={handleCenter}
          >
            <Text style={styles.controlButtonTextPrimary}>⌖</Text>
          </Pressable>
          {navigationSummary.status === "navigating" ? (
            <Pressable
              style={styles.controlButton}
              onPress={handlePauseNavigation}
            >
              <Text style={styles.controlButtonText}>Pause</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.controlButton}
              onPress={handleStartNavigation}
            >
              <Text style={styles.controlButtonText}>Start</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.controlButton}
            onPress={handleStopNavigation}
          >
            <Text style={styles.controlButtonText}>Stop</Text>
          </Pressable>
        </View>
      </Animated.View>

      {routeLoading ? (
        <Animated.View
          style={styles.loadingOverlay}
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(120)}
        >
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.loadingText}>
              Optimizing route and refreshing live context…
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#0F172A",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 40,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: "rgba(15, 23, 42, 0.84)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  badgePositive: {
    backgroundColor: "rgba(16, 185, 129, 0.9)",
  },
  badgeWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.92)",
  },
  badgeDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.92)",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.32)",
  },
  errorTitle: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  errorText: {
    color: "#E2E8F0",
    fontSize: 12,
    lineHeight: 17,
  },
  errorAction: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "#EF4444",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  bottomSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    zIndex: 50,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sheetHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  sheetHeaderRight: {
    flexDirection: "row",
    gap: 8,
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  sheetSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  smallAction: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  infoChip: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(30, 41, 59, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  infoChipPositive: {
    backgroundColor: "rgba(6, 95, 70, 0.92)",
  },
  infoChipWarning: {
    backgroundColor: "rgba(146, 64, 14, 0.92)",
  },
  infoChipDanger: {
    backgroundColor: "rgba(127, 29, 29, 0.92)",
  },
  infoChipLabel: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoChipValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  routeSummaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  routeSummaryBlock: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 10,
  },
  routeSummaryLabel: {
    color: "#94A3B8",
    fontSize: 11,
    marginBottom: 4,
  },
  routeSummaryValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  stepCard: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.32)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  stepLabel: {
    color: "#A5B4FC",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  stepTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  stepText: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 18,
  },
  stepList: {
    marginBottom: 12,
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 10,
  },
  stepIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepIndexText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  stepBody: {
    flex: 1,
  },
  stepRowTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  stepRowText: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  aiCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  aiHeaderLabel: {
    color: "#A5B4FC",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  aiHeaderMeta: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },
  aiTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  aiDescription: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
  },
  aiTips: {
    marginTop: 10,
    gap: 4,
  },
  aiTip: {
    color: "#E2E8F0",
    fontSize: 12,
    lineHeight: 16,
  },
  aiMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  aiMetaLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  aiMetaValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  aiButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  aiButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  aiButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  aiButtonPrimary: {
    backgroundColor: "#6366F1",
  },
  aiButtonSecondaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  aiButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  controlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  controlButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonPrimary: {
    backgroundColor: "#6366F1",
  },
  controlButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  controlButtonTextPrimary: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerSelected: {
    borderColor: "#F8FAFC",
    shadowOpacity: 0.4,
    elevation: 7,
  },
  markerNumber: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  orderBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#111827",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  orderText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  calloutContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    width: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 12,
    color: "#475569",
  },
  calloutInsight: {
    marginTop: 6,
    fontSize: 11,
    color: "#6366F1",
    fontWeight: "700",
  },
  clusterOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  clusterInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  clusterCount: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  poiPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  poiSelected: {
    transform: [{ scale: 1.08 }],
  },
  poiPinText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: -3,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.24)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 90,
    zIndex: 60,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});

export default ItineraryMapView;
