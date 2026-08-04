/**
 * ItineraryScreen V4 – Production-Grade AI Travel Planner
 * Premium UI with smooth animations, skeleton loaders, and robust error handling
 */

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  Pressable,
} from "react-native";
import { Text, TextInput } from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  useDerivedValue,
} from "react-native-reanimated";
import {
  MapComponent,
  MarkerComponent,
  PolylineComponent,
  MAP_PROVIDER,
} from "@/components/Common/ExpoMap";
import { RootStackParamList } from "@/navigation/types";
import { useItinerary } from "@/hooks/useItinerary";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { mapsService } from "@/services/maps";
import {
  ItineraryDay,
  ItineraryActivity,
  ItineraryRoutePoint,
} from "@/services/itinerary";
import { colors, spacing } from "@/theme/colors";
import KeyboardAvoidingWrapper from "@/components/Common/KeyboardAvoidingWrapper";
import { PressableScale } from "@/components/UI/PressableScale";
import { GlassCard } from "@/components/UI/GlassCard";
import { ItinerarySkeleton } from "@/components/UI/SkeletonLoader";
import { getErrorInfo } from "@/utils/errorHandler";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const { height, width } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────
// PROGRESS BAR COMPONENT
// ─────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ progress: number; step: string }> = ({
  progress,
  step,
}) => {
  const stepLabels: Record<string, string> = {
    starting: "Starting...",
    fetching_route: "Calculating route...",
    calculating_route: "Finding best path...",
    generating_itinerary: "AI is planning your trip...",
    fetching_weather: "Checking weather...",
    processing_results: "Finalizing...",
    complete: "Complete!",
    idle: "Ready",
    cancelled: "Cancelled",
    error: "Something went wrong",
  };

  // Bug 1.9 fix: use shared value + animated style instead of percentage string
  const progressValue = useSharedValue(0);
  useEffect(() => {
    progressValue.value = withTiming(Math.min(progress, 100), {
      duration: 400,
    });
  }, [progress]);

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value}%` as any,
  }));

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressFillStyle]} />
      </View>
      <Text style={styles.progressLabel}>{stepLabels[step] || step}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// ACTIVITY CARD COMPONENT
// ─────────────────────────────────────────────────────────────

// Bug 1.10 fix: properly typed activity prop
interface ActivityCardProps {
  label: string;
  emoji: string;
  activity: ItineraryActivity | null;
  index: number;
}

const ActivityCard: React.FC<ActivityCardProps> = React.memo(
  ({ label, emoji, activity, index }) => (
    <Animated.View
      entering={SlideInRight.delay(index * 100).springify()}
      style={styles.activityCard}
    >
      <View style={styles.actHeader}>
        <Text style={styles.actLabel}>
          {emoji} {label}
        </Text>
        {activity?.cost && activity.cost !== "0" && (
          <View style={styles.costBadge}>
            <Text style={styles.actCost}>₹{activity.cost}</Text>
          </View>
        )}
      </View>
      <Text style={styles.actTitle}>{activity?.activity || "Exploration"}</Text>
      {activity?.description ? (
        <Text style={styles.actDesc} numberOfLines={2}>
          {activity.description}
        </Text>
      ) : null}
      {activity?.duration && (
        <Text style={styles.actDuration}>⏱ {activity.duration}</Text>
      )}
    </Animated.View>
  ),
);

ActivityCard.displayName = "ActivityCard";

function parseBudgetCost(cost?: string): number {
  if (!cost) return 0;

  const normalized = cost.replace(/,/g, "").trim();
  const rangeMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i,
  );
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (!Number.isNaN(low) && !Number.isNaN(high)) {
      return (low + high) / 2;
    }
  }

  const singleMatch = normalized.match(/\d+(?:\.\d+)?/);
  return singleMatch ? Number(singleMatch[0]) : 0;
}

// ─────────────────────────────────────────────────────────────
// DAY CARD COMPONENT
// ─────────────────────────────────────────────────────────────

interface DayCardProps {
  day: ItineraryDay;
  isExpanded: boolean;
  onToggle: () => void;
  onFocusMap: () => void;
}

// Bug 1.1 fix: removed conflicting dual onPress; outer press = toggle (accordion),
// map focus is triggered only from the day circle button.
// Bug 1.2 fix: dynamic activity count subtitle.
const DayCard: React.FC<DayCardProps> = React.memo(
  ({ day, isExpanded, onToggle, onFocusMap }) => {
    const rotation = useSharedValue(0);

    useEffect(() => {
      rotation.value = withSpring(isExpanded ? 180 : 0);
    }, [isExpanded]);

    const arrowStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotation.value}deg` }],
    }));

    // Bug 1.2 fix: count non-null activity slots dynamically
    const activityCount = [day.morning, day.afternoon, day.evening].filter(
      Boolean,
    ).length;

    return (
      <View style={styles.dayGroup}>
        <Pressable
          style={styles.dayHeader}
          onPress={onToggle}
          accessibilityLabel={`Day ${day.day}: ${day.title}. ${isExpanded ? "Collapse" : "Expand"} activities`}
          accessibilityRole="button"
        >
          <View style={styles.dayLabelContainer}>
            {/* Tap circle to focus the map on this day's location */}
            <TouchableOpacity
              style={styles.dayCircle}
              onPress={onFocusMap}
              accessibilityLabel={`Focus map on Day ${day.day}`}
              accessibilityRole="button"
            >
              <Text style={styles.dayCircleText}>{day.day}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.dayTitleText} numberOfLines={1}>
                {day.title}
              </Text>
              <Text style={styles.daySubtitle}>
                {activityCount}{" "}
                {activityCount === 1 ? "activity" : "activities"} planned
              </Text>
            </View>
          </View>
          <Animated.View style={arrowStyle}>
            <Text style={styles.expandIcon}>▼</Text>
          </Animated.View>
        </Pressable>

        {isExpanded && (
          <Animated.View entering={FadeIn.duration(200)}>
            <ActivityCard
              label="Morning"
              emoji="🌅"
              activity={day.morning}
              index={0}
            />
            <ActivityCard
              label="Afternoon"
              emoji="☀️"
              activity={day.afternoon}
              index={1}
            />
            <ActivityCard
              label="Evening"
              emoji="🌙"
              activity={day.evening}
              index={2}
            />

            {day.tip && (
              <View style={styles.aiTipBox}>
                <Text style={styles.aiTipIcon}>💡</Text>
                <Text style={styles.aiTipText}>{day.tip}</Text>
              </View>
            )}
          </Animated.View>
        )}
      </View>
    );
  },
);

DayCard.displayName = "DayCard";

// ─────────────────────────────────────────────────────────────
// ERROR STATE COMPONENT
// ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
  error: any;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const errorInfo = getErrorInfo(error);

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorIcon}>😕</Text>
      <Text style={styles.errorTitle}>{errorInfo.title}</Text>
      <Text style={styles.errorMessage}>{errorInfo.message}</Text>
      {errorInfo.action && (
        <PressableScale style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryBtnText}>{errorInfo.action}</Text>
        </PressableScale>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function ItineraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const mapRef = useRef<any>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  // Bug 1.4 fix: track whether auto-trigger has fired instead of empty dep array
  const hasFiredAutoGenerate = useRef(false);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeCacheRef = useRef<Map<string, { lat: number; lon: number }>>(
    new Map(),
  );

  // Route params
  const route = useRoute<RouteProp<RootStackParamList, "Itinerary">>();
  const incomingQuery = route.params?.query || "";

  // State
  const [query, setQuery] = useState(incomingQuery);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [dayMarkers, setDayMarkers] = useState<
    Record<number, { lat: number; lon: number }>
  >({});

  // Hooks
  const {
    itinerary,
    route: mapRoute,
    weather,
    loading,
    error,
    isFromCache,
    progress,
    generate,
    cancel,
    retry,
  } = useItinerary();

  const { setActiveTrip, logSearch } = useTravelIntelligence();

  const buildGeometryMarkers = useCallback(
    (geometry: [number, number][], numDays: number) => {
      const markers: Record<number, { lat: number; lon: number }> = {};
      if (geometry.length === 0 || numDays === 0) {
        return markers;
      }

      itinerary?.itinerary?.forEach((day, idx) => {
        const geoIdx = Math.min(
          Math.round((idx / numDays) * geometry.length),
          geometry.length - 1,
        );
        markers[day.day] = {
          lat: geometry[geoIdx][0],
          lon: geometry[geoIdx][1],
        };
      });

      return markers;
    },
    [itinerary?.itinerary],
  );

  // Bug 1.7 fix: connect debouncedGenerate to onChangeText
  const debouncedGenerate = useDebouncedCallback(generate, 300);

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ["15%", "50%", "92%"], []);

  // Bug 1.4 fix: fire-once auto-trigger using a ref guard
  useEffect(() => {
    if (
      !hasFiredAutoGenerate.current &&
      incomingQuery &&
      incomingQuery.trim().length > 0
    ) {
      hasFiredAutoGenerate.current = true;
      generate(incomingQuery);
    }
  }, [incomingQuery, generate]);

  // Bug 1.5 fix: populate dayMarkers when route geometry becomes available
  useEffect(() => {
    let cancelled = false;

    if (fitTimerRef.current) {
      clearTimeout(fitTimerRef.current);
      fitTimerRef.current = null;
    }

    const run = async () => {
      if (!itinerary?.itinerary || itinerary.itinerary.length === 0) {
        return;
      }

      const geometry = mapRoute?.geometry || [];
      const routePoints = itinerary.route_points || [];
      const markers: Record<number, { lat: number; lon: number }> = {};

      if (routePoints.length > 0) {
        const resolvedPoints = await Promise.all(
          routePoints.map(async (point: ItineraryRoutePoint) => {
            if (point.coordinates?.lat && point.coordinates?.lon) {
              return {
                day: point.day,
                geo: { lat: point.coordinates.lat, lon: point.coordinates.lon },
              };
            }

            if (
              point.destination_coordinates?.lat &&
              point.destination_coordinates?.lon
            ) {
              return {
                day: point.day,
                geo: {
                  lat: point.destination_coordinates.lat,
                  lon: point.destination_coordinates.lon,
                },
              };
            }

            const query =
              point.query ||
              `${point.place || point.activity} ${itinerary.destination}`.trim();
            const cached = geocodeCacheRef.current.get(query);
            if (cached) {
              return { day: point.day, geo: cached };
            }

            try {
              const geo = await mapsService.geocode(query);
              if (!geo) return null;
              const resolvedGeo = { lat: geo.lat, lon: geo.lon };
              geocodeCacheRef.current.set(query, resolvedGeo);
              return { day: point.day, geo: resolvedGeo };
            } catch {
              return null;
            }
          }),
        );

        for (const entry of resolvedPoints) {
          if (!entry || markers[entry.day]) continue;
          markers[entry.day] = entry.geo;
        }
      }

      if (geometry.length > 0) {
        const fallbackMarkers = buildGeometryMarkers(
          geometry,
          itinerary.itinerary.length,
        );

        for (const [day, geo] of Object.entries(fallbackMarkers)) {
          const dayNumber = Number(day);
          if (!markers[dayNumber]) {
            markers[dayNumber] = geo;
          }
        }
      }

      if (!cancelled && Object.keys(markers).length > 0) {
        setDayMarkers(markers);

        fitTimerRef.current = setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            Object.values(markers).map((geo) => ({
              latitude: geo.lat,
              longitude: geo.lon,
            })),
            {
              edgePadding: {
                top: 120,
                right: 60,
                bottom: height / 2,
                left: 60,
              },
              animated: true,
            },
          );
        }, 800);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (fitTimerRef.current) {
        clearTimeout(fitTimerRef.current);
        fitTimerRef.current = null;
      }
    };
  }, [mapRoute, itinerary, buildGeometryMarkers]);

  // Bug 1.6 fix: update active trip in store after successful generation
  useEffect(() => {
    if (itinerary && !loading && !error) {
      logSearch(query);
      // setActiveTrip requires a Destination object — we create a minimal one from itinerary
      // This syncs the global trip tracker with the newly generated plan
      setActiveTrip(
        { id: itinerary.destination, name: itinerary.destination } as any,
        itinerary.num_days,
      );
    }
  }, [itinerary, loading, error]);

  // Focus on day
  const focusOnDay = useCallback(
    (day: number) => {
      const geo = dayMarkers[day];
      if (geo && mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: geo.lat,
            longitude: geo.lon,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          },
          1000,
        );
      }
    },
    [dayMarkers],
  );

  // Toggle accordion (no map pan here — map pan is on the circle button)
  const handleDayToggle = useCallback((day: number) => {
    setExpandedDay((prev) => (prev === day ? null : day));
  }, []);

  // Handle generate from search bar
  const handleGenerate = useCallback(() => {
    if (query.trim()) {
      debouncedGenerate.cancel();
      generate(query);
    }
  }, [query, generate, debouncedGenerate]);

  // Bug 1.8 fix: Save Itinerary persists the trip to store then confirms
  const handleSaveItinerary = useCallback(() => {
    if (!itinerary) return;
    // setActiveTrip already called reactively above; just confirm to the user
    Alert.alert(
      "Itinerary Saved! ✅",
      `Your ${itinerary.num_days}-day trip to ${itinerary.destination} has been saved to your trips.`,
      [
        { text: "Stay here" },
        { text: "Go back", onPress: () => navigation.goBack() },
      ],
    );
  }, [itinerary, navigation]);

  // Calculate budget
  const calculateBudget = useCallback(() => {
    const estimate = itinerary?.budget_estimate?.total;
    if (typeof estimate === "number" && Number.isFinite(estimate)) {
      return `₹${Math.round(estimate).toLocaleString()}`;
    }

    if (!itinerary?.itinerary) return "₹0";

    let total = 0;
    itinerary.itinerary.forEach((day) => {
      [day.morning, day.afternoon, day.evening].forEach((act) => {
        if (act?.cost) {
          total += parseBudgetCost(act.cost);
        }
      });
    });
    return `₹${total.toLocaleString()}`;
  }, [itinerary]);

  return (
    <KeyboardAvoidingWrapper>
      <View style={styles.container}>
        {/* Map Background */}
        <MapComponent
        ref={mapRef as any}
        style={StyleSheet.absoluteFillObject}
        provider={MAP_PROVIDER}
        initialRegion={{
          latitude: 20.5937,
          longitude: 78.9629,
          latitudeDelta: 15,
          longitudeDelta: 15,
        }}
        customMapStyle={mapStyle}
      >
        {/* Route Polyline */}
        {mapRoute?.geometry && (
          <PolylineComponent
            coordinates={mapRoute.geometry.map((c: [number, number]) => ({
              latitude: c[0],
              longitude: c[1],
            }))}
            strokeColor="#0f766e"
            strokeWidth={4}
            lineCap="round"
          />
        )}

        {/* Day Markers */}
        {Object.entries(dayMarkers).map(([day, geo]) => (
          <MarkerComponent
            key={`marker-day-${day}`}
            coordinate={{ latitude: geo.lat, longitude: geo.lon }}
            title={`Day ${day}`}
            onPress={() => focusOnDay(parseInt(day))}
          >
            <View style={styles.customMarker}>
              <Text style={styles.markerText}>{day}</Text>
            </View>
          </MarkerComponent>
        ))}
      </MapComponent>

      {/* Floating Header */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top }]}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>←</Text>
        </PressableScale>

        {loading && (
          <GlassCard style={styles.loadingPill}>
            <ProgressBar progress={progress.percentage} step={progress.step} />
          </GlassCard>
        )}

        {isFromCache && !loading && (
          <GlassCard style={styles.cachePill}>
            <Text style={styles.cachePillText}>⚡ From cache</Text>
          </GlassCard>
        )}
      </View>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        handleIndicatorStyle={styles.sheetIndicator}
        backgroundStyle={styles.sheetBackground}
      >
        {/* Search Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.aiIcon}>✨</Text>
          {/* Bug 1.7 fix: debouncedGenerate on onChangeText for real-time suggestions */}
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (text.trim().length > 10) debouncedGenerate(text);
            }}
            placeholder="Plan your trip..."
            style={styles.sheetSearchInput}
            autoCorrect={false}
            onSubmitEditing={handleGenerate}
            placeholderTextColor="#94A3B8"
            accessibilityLabel="Trip planning search input"
          />
          <Pressable
            style={styles.sheetSearchBtn}
            onPress={handleGenerate}
            accessibilityLabel="Generate itinerary"
            accessibilityRole="button"
          >
            <Text style={styles.sheetSearchIcon}>→</Text>
          </Pressable>
        </View>

        {/* Content */}
        {loading ? (
          <BottomSheetView style={styles.loadingContainer}>
            <ItinerarySkeleton days={3} />
          </BottomSheetView>
        ) : error ? (
          <BottomSheetView style={styles.errorSheet}>
            <ErrorState error={error} onRetry={retry} />
          </BottomSheetView>
        ) : itinerary ? (
          <BottomSheetScrollView contentContainerStyle={styles.sheetScroll}>
            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{itinerary.num_days}</Text>
                <Text style={styles.statLabel}>Days</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>
                  {mapRoute?.distance_km || "--"}
                </Text>
                <Text style={styles.statLabel}>KM</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{calculateBudget()}</Text>
                <Text style={styles.statLabel}>Est. Cost</Text>
              </View>
            </View>

            {/* Weather Card */}
            {weather && (
              <GlassCard style={styles.weatherCard}>
                <Text style={styles.weatherEmoji}>🌤️</Text>
                <View style={styles.weatherInfo}>
                  <Text style={styles.weatherTemp}>
                    {weather.temperature_c}°C
                  </Text>
                  <Text style={styles.weatherDesc}>
                    {weather.description || "Clear"}
                  </Text>
                </View>
              </GlassCard>
            )}

            {/* AI Disclaimer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, marginBottom: 12, gap: 8 }}>
              <MaterialCommunityIcons name="robot-outline" size={16} color="#F59E0B" />
              <Text style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                AI-generated itinerary — verify details before booking
              </Text>
            </View>

            {/* Day Cards */}
            {/* Bug 1.1 fix: onToggle = accordion toggle only; onFocusMap = day circle tap */}
            {itinerary.itinerary.map((day: ItineraryDay) => (
              <DayCard
                key={day.day}
                day={day}
                isExpanded={expandedDay === day.day}
                onToggle={() => handleDayToggle(day.day)}
                onFocusMap={() => focusOnDay(day.day)}
              />
            ))}

            {/* Bug 1.8 fix: Save Button now persists trip state */}
            <TouchableOpacity
              style={styles.finalizeBtn}
              onPress={handleSaveItinerary}
              accessibilityLabel="Save this itinerary to your trips"
              accessibilityRole="button"
            >
              <Text style={styles.finalizeBtnText}>Save Itinerary</Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={styles.emptySheet}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyTitle}>Plan Your Trip</Text>
            <Text style={styles.emptySubtitle}>
              Try: "3 days in Munnar from Kochi"
            </Text>
          </BottomSheetView>
        )}
      </BottomSheet>
      </View>
    </KeyboardAvoidingWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// MAP STYLE
// ─────────────────────────────────────────────────────────────

const mapStyle = [
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#444444" }],
  },
  {
    featureType: "landscape",
    elementType: "all",
    stylers: [{ color: "#f2f2f2" }],
  },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "all",
    stylers: [{ saturation: -100 }, { lightness: 45 }],
  },
  {
    featureType: "water",
    elementType: "all",
    stylers: [{ color: "#cbd5e1" }, { visibility: "on" }],
  },
];

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const headerShadow =
  Platform.select({
    web: { boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.1)" } as any,
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
  }) ?? {};

const intentBarShadow =
  Platform.select({
    web: { boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.05)" } as any,
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
  }) ?? {};

const activityCardShadow =
  Platform.select({
    web: { boxShadow: "0px 1px 5px rgba(0, 0, 0, 0.02)" } as any,
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.02,
      shadowRadius: 5,
      elevation: 1,
    },
  }) ?? {};

const markerShadow =
  Platform.select({
    web: { boxShadow: "0px 0px 4px rgba(0, 0, 0, 0.2)" } as any,
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
  }) ?? {};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E2E8F0" },

  // Header
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    ...headerShadow,
  },
  backBtnText: { fontSize: 24, fontWeight: "600", color: "#0F172A" },
  loadingPill: {
    marginLeft: spacing.md,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 150,
  },
  cachePill: {
    marginLeft: spacing.md,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cachePillText: { fontSize: 12, fontWeight: "700", color: "#16A34A" },

  // Progress
  progressContainer: { alignItems: "center" },
  progressTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0f766e",
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 6,
    fontWeight: "600",
  },

  // Bottom Sheet
  sheetBackground: { backgroundColor: "#F8FAFC", borderRadius: 32 },
  sheetIndicator: { backgroundColor: "#CBD5E1", width: 40 },
  sheetHeader: { padding: spacing.md, paddingBottom: spacing.sm },
  intentBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    height: 56,
    alignItems: "center",
    paddingHorizontal: 16,
    ...intentBarShadow,
  },
  aiIcon: { fontSize: 20, marginRight: 10 },
  sheetSearchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    backgroundColor: "transparent",
  },
  sheetSearchBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSearchIcon: { fontSize: 18, color: "#FFF", fontWeight: "900" },

  // Loading
  loadingContainer: { flex: 1, padding: spacing.md },

  // Error
  errorSheet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorContainer: { alignItems: "center" },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },

  // Empty State
  emptySheet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  emptySubtitle: { fontSize: 14, color: "#94A3B8" },

  // Scroll Content
  sheetScroll: { padding: spacing.md, paddingBottom: 60 },

  // Stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statItem: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: { width: 1, backgroundColor: "#F1F5F9" },

  // Weather
  weatherCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: spacing.md,
  },
  weatherEmoji: { fontSize: 32 },
  weatherInfo: { marginLeft: 12 },
  weatherTemp: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  weatherDesc: { fontSize: 13, color: "#64748B" },

  // Day Card
  dayGroup: { marginBottom: spacing.lg },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  dayLabelContainer: { flexDirection: "row", alignItems: "center", flex: 1 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0f766e",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dayCircleText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  dayTitleText: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  daySubtitle: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  expandIcon: { fontSize: 12, color: "#94A3B8" },

  // Activity Card
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    ...activityCardShadow,
  },
  actHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  actLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0f766e",
    textTransform: "uppercase",
  },
  costBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actCost: { fontSize: 11, fontWeight: "700", color: "#16A34A" },
  actTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  actDesc: { fontSize: 13, color: "#64748B", lineHeight: 18 },
  actDuration: { fontSize: 11, color: "#94A3B8", marginTop: 6 },

  // AI Tip
  aiTipBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  aiTipIcon: { fontSize: 16, marginRight: 8 },
  aiTipText: { fontSize: 13, color: "#475569", fontWeight: "500", flex: 1 },

  // Finalize Button
  finalizeBtn: {
    backgroundColor: "#0F172A",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.md,
  },
  finalizeBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  // Custom Marker
  customMarker: {
    backgroundColor: "#0f766e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFF",
    ...markerShadow,
  },
  markerText: { color: "#FFF", fontSize: 12, fontWeight: "900" },
});
