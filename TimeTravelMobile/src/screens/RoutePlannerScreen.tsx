/**
 * Route Intelligence Platform V2
 * Production-grade routing with AI scoring, real-time traffic, and smart stops
 * Inspired by Google Maps, Apple Maps, and Waze UX patterns
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
  Animated,
  TextInput,
  FlatList,
  Keyboard,
  StatusBar,
  Image,
  Pressable,
  RefreshControl,
} from "react-native";
import { Text } from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  MapComponent,
  MarkerComponent,
  PolylineComponent,
  MAP_PROVIDER,
} from "@/components/Common/ExpoMap";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import {
  useRouteStore,
  selectSelectedRoute,
  selectCanCompute,
} from "@/stores/routeStore";
import { useLocation } from "@/hooks/useLocation";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import { colors, spacing } from "@/theme/colors";
import {
  Route,
  TravelMode,
  TrafficCondition,
  SmartStop,
  PlaceResult,
  RoutePreferences,
} from "@/types/route";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width - spacing.lg * 2;
const MAP_HEIGHT = height;

// ─────────────────────────────────────────────────────────────
// TRAVEL MODE CONFIG
// ─────────────────────────────────────────────────────────────

const TRAVEL_MODES: {
  key: TravelMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { key: "car", icon: "car", label: "Drive" },
  { key: "bike", icon: "bicycle", label: "Bike" },
  { key: "walk", icon: "walk", label: "Walk" },
  { key: "transit", icon: "bus", label: "Transit" },
];

const TRAFFIC_COLORS: Record<TrafficCondition, string> = {
  free: "#22C55E",
  light: "#84CC16",
  moderate: "#EAB308",
  heavy: "#F97316",
  congested: "#EF4444",
};

const TRAFFIC_LABELS: Record<TrafficCondition, string> = {
  free: "Clear",
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
  congested: "Congested",
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function RoutePlannerScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);

  // Store
  const {
    origin,
    destination,
    routes,
    selectedRouteId,
    recommendedRouteId,
    preferences,
    travelMode,
    traffic,
    smartStops,
    predictions,
    isLoading,
    isSearching,
    searchQuery,
    searchResults,
    activeInputField,
    error,
    recentPlaces,
    setOrigin,
    setDestination,
    swapOriginDestination,
    setSearchQuery,
    setActiveInputField,
    searchPlaces,
    selectSearchResult,
    computeRoutes,
    selectRoute,
    setPreferences,
    setTravelMode,
    loadRecentPlaces,
    clearError,
  } = useRouteStore();

  const selectedRoute = useRouteStore(selectSelectedRoute);
  const canCompute = useRouteStore(selectCanCompute);

  const alternatives = useMemo(() => {
    return routes
      .filter((route) => route.id !== selectedRouteId)
      .map((route) => {
        const selected = routes.find((r) => r.id === selectedRouteId);
        return {
          route,
          difference: {
            time_minutes:
              route.metrics.duration_minutes -
              (selected?.metrics.duration_minutes || 0),
            distance_km:
              route.metrics.distance_km - (selected?.metrics.distance_km || 0),
            cost_inr:
              route.metrics.total_cost_inr -
              (selected?.metrics.total_cost_inr || 0),
          },
          is_recommended: route.id === recommendedRouteId,
        };
      });
  }, [routes, selectedRouteId, recommendedRouteId]);

  // Location hook
  const { location: currentLocation, getCurrentPosition } = useLocation();

  // Local state
  const [showSearch, setShowSearch] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const searchSlideAnim = useRef(new Animated.Value(height)).current;
  const resultsSlideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Debounced search - with safe null/undefined handling
  const debouncedSearch = useDebouncedCallback((query?: string | null) => {
    // Safe guard: handle undefined, null, empty string, or whitespace-only strings
    const safeQuery = typeof query === "string" ? query.trim() : "";
    if (!safeQuery) return;

    // Convert location format from { latitude, longitude } to { lat, lng }
    const geoLocation = currentLocation
      ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
      : undefined;
    searchPlaces(safeQuery, geoLocation);
  }, 300);

  // ───────────────────────────────────────────────────────────
  // EFFECTS
  // ───────────────────────────────────────────────────────────

  useEffect(() => {
    loadRecentPlaces();
  }, []);

  useEffect(() => {
    if (showSearch) {
      Animated.spring(searchSlideAnim, {
        toValue: 0,
        tension: 60,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(searchSlideAnim, {
        toValue: height,
        tension: 60,
        friction: 11,
        useNativeDriver: true,
      }).start();
    }
  }, [showSearch]);

  useEffect(() => {
    if (routes.length > 0) {
      Animated.spring(resultsSlideAnim, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }).start();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [routes.length]);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // Fit map to route
  useEffect(() => {
    if (
      selectedRoute?.geometry &&
      selectedRoute.geometry.length > 0 &&
      mapRef.current
    ) {
      const coordinates = selectedRoute.geometry.map((coord) => ({
        latitude: coord.lat,
        longitude: coord.lng,
      }));

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 200, right: 60, bottom: 350, left: 60 },
          animated: true,
        });
      }, 300);
    }
  }, [selectedRouteId]);

  // ───────────────────────────────────────────────────────────
  // HANDLERS
  // ───────────────────────────────────────────────────────────

  const handlePlaceSelect = useCallback(
    (place: PlaceResult) => {
      selectSearchResult(place);
      setShowSearch(false);
      Keyboard.dismiss();
    },
    [selectSearchResult],
  );

  const handleComputeRoutes = useCallback(async () => {
    if (!canCompute) return;
    await computeRoutes();
  }, [canCompute, computeRoutes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await computeRoutes();
    setRefreshing(false);
  }, [computeRoutes]);

  const handleUseCurrentLocation = useCallback(async () => {
    const loc = await getCurrentPosition();
    if (loc) {
      const place: PlaceResult = {
        id: "current",
        name: "Current Location",
        address: `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`,
        location: loc,
      };
      if (activeInputField === "origin") {
        setOrigin(place);
      }
    }
  }, [getCurrentPosition, activeInputField, setOrigin]);

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ───────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ───────────────────────────────────────────────────────────

  const renderTrafficBadge = (condition: TrafficCondition) => {
    const color = TRAFFIC_COLORS[condition];
    const label = TRAFFIC_LABELS[condition];

    return (
      <View style={[styles.trafficBadge, { backgroundColor: `${color}20` }]}>
        <View style={[styles.trafficDot, { backgroundColor: color }]} />
        <Text style={[styles.trafficText, { color }]}>{label} traffic</Text>
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: PlaceResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handlePlaceSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.searchResultIcon}>
        <Ionicons name="location" size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.searchResultAddress} numberOfLines={1}>
          {item.address}
        </Text>
      </View>
      {item.distance_m && (
        <Text style={styles.searchResultDistance}>
          {formatDistance(item.distance_m / 1000)}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderRecentPlace = ({
    item,
  }: {
    item: PlaceResult & { last_used?: string };
  }) => (
    <TouchableOpacity
      style={styles.recentPlaceItem}
      onPress={() => handlePlaceSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.recentPlaceIcon}>
        <Ionicons name="time" size={18} color={colors.textTertiary} />
      </View>
      <Text style={styles.recentPlaceName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderAlternativeRoute = ({
    item,
  }: {
    item: (typeof alternatives)[number];
  }) => (
    <TouchableOpacity
      style={[
        styles.alternativeCard,
        item.route.id === selectedRouteId && styles.alternativeCardSelected,
      ]}
      onPress={() => selectRoute(item.route.id)}
      activeOpacity={0.8}
    >
      <View style={styles.alternativeHeader}>
        <Text style={styles.alternativeTime}>
          {formatDuration(item.route.metrics.duration_minutes)}
        </Text>
        {item.is_recommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>Best</Text>
          </View>
        )}
      </View>
      <Text style={styles.alternativeDetail}>
        {formatDistance(item.route.metrics.distance_km)} • ₹
        {item.route.metrics.total_cost_inr}
      </Text>
      <Text style={styles.alternativeDiff}>
        {item.difference.time_minutes > 0 ? "+" : ""}
        {item.difference.time_minutes} min vs selected
      </Text>
    </TouchableOpacity>
  );

  const renderSmartStop = ({ item }: { item: SmartStop }) => {
    const typeIcons: Record<string, string> = {
      fuel: "local-gas-station",
      restaurant: "restaurant",
      rest_stop: "hotel",
      atm: "atm",
      hospital: "local-hospital",
      ev_charging: "ev-station",
    };

    return (
      <View style={styles.smartStopCard}>
        <MaterialIcons
          name={typeIcons[item.type] as any}
          size={20}
          color={colors.primary}
        />
        <View style={styles.smartStopContent}>
          <Text style={styles.smartStopName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.smartStopDetail}>
            {item.distance_along_route_km.toFixed(0)}km •{" "}
            {item.detour_time_minutes}min detour
          </Text>
        </View>
        {item.rating && (
          <View style={styles.smartStopRating}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.smartStopRatingText}>
              {item.rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ───────────────────────────────────────────────────────────
  // MAIN RENDER
  // ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      {/* MAP LAYER */}
      <MapComponent
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={MAP_PROVIDER}
        initialRegion={{
          latitude: 20.5937,
          longitude: 78.9629,
          latitudeDelta: 15,
          longitudeDelta: 15,
        }}
        showsIndoors={false}
        showsTraffic={false}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Route Polyline */}
        {selectedRoute?.geometry && (
          <PolylineComponent
            coordinates={selectedRoute.geometry.map((c) => ({
              latitude: c.lat,
              longitude: c.lng,
            }))}
            strokeColor={colors.primary}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Origin Marker */}
        {selectedRoute?.geometry && selectedRoute.geometry.length > 0 && (
          <MarkerComponent
            coordinate={{
              latitude: selectedRoute.geometry[0].lat,
              longitude: selectedRoute.geometry[0].lng,
            }}
            title={origin?.name || "Origin"}
            description="Starting point"
            pinColor="#10B981"
          />
        )}

        {/* Destination Marker */}
        {selectedRoute?.geometry && selectedRoute.geometry.length > 0 && (
          <MarkerComponent
            coordinate={{
              latitude:
                selectedRoute.geometry[selectedRoute.geometry.length - 1].lat,
              longitude:
                selectedRoute.geometry[selectedRoute.geometry.length - 1].lng,
            }}
            title={destination?.name || "Destination"}
            description="End point"
            pinColor="#EF4444"
          />
        )}

        {/* Smart Stop Markers */}
        {smartStops.slice(0, 5).map((stop, index) => (
          <MarkerComponent
            key={stop.id}
            coordinate={{
              latitude: stop.location.lat,
              longitude: stop.location.lng,
            }}
            title={stop.name}
            description={`${stop.type} • ${stop.detour_time_minutes}min detour`}
            pinColor="#F59E0B"
          />
        ))}
      </MapComponent>

      {/* TOP SEARCH PANEL */}
      <View
        style={[styles.topContainer, { paddingTop: insets.top + spacing.sm }]}
      >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setShowSearch(false)}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Route Planner</Text>
          <TouchableOpacity
            style={styles.prefsBtn}
            onPress={() => setShowPreferences(!showPreferences)}
          >
            <Ionicons name="options" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search Card */}
        <View style={styles.searchCard}>
          {/* Origin Input */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => {
              setActiveInputField("origin");
              setShowSearch(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.locationDot}>
              <View style={[styles.dotInner, { backgroundColor: "#10B981" }]} />
            </View>
            <View style={styles.locationInput}>
              <Text
                style={[
                  styles.locationText,
                  !origin && styles.locationPlaceholder,
                ]}
              >
                {origin?.name || "Choose starting point"}
              </Text>
            </View>
            {origin && (
              <TouchableOpacity onPress={() => setOrigin(null)}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Connector Line */}
          <View style={styles.connectorLine}>
            <View style={styles.connectorDots}>
              <View style={styles.connectorDot} />
              <View style={styles.connectorDot} />
              <View style={styles.connectorDot} />
            </View>
          </View>

          {/* Destination Input */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => {
              setActiveInputField("destination");
              setShowSearch(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.locationDot}>
              <View style={[styles.dotInner, { backgroundColor: "#EF4444" }]} />
            </View>
            <View style={styles.locationInput}>
              <Text
                style={[
                  styles.locationText,
                  !destination && styles.locationPlaceholder,
                ]}
              >
                {destination?.name || "Choose destination"}
              </Text>
            </View>
            {destination && (
              <TouchableOpacity onPress={() => setDestination(null)}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Swap Button */}
          <TouchableOpacity
            style={styles.swapButton}
            onPress={swapOriginDestination}
            disabled={!origin && !destination}
          >
            <Ionicons name="swap-vertical" size={18} color={colors.primary} />
          </TouchableOpacity>

          {/* Travel Modes */}
          <View style={styles.modesRow}>
            {TRAVEL_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.key}
                style={[
                  styles.modeBtn,
                  travelMode === mode.key && styles.modeBtnActive,
                ]}
                onPress={() => setTravelMode(mode.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={mode.icon}
                  size={20}
                  color={
                    travelMode === mode.key ? "#fff" : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.modeLabel,
                    travelMode === mode.key && styles.modeLabelActive,
                  ]}
                >
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Compute Button */}
          <TouchableOpacity
            style={[
              styles.computeBtn,
              !canCompute && styles.computeBtnDisabled,
            ]}
            onPress={handleComputeRoutes}
            disabled={!canCompute || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContent}>
                <LoadingSpinner size="small" message="" />
                <Text style={styles.computeBtnText}>Computing...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.computeBtnText}>Get Directions</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={clearError}>
                <Ionicons name="close" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Preferences Panel */}
        {showPreferences && (
          <Animated.View style={[styles.prefsPanel, { opacity: fadeAnim }]}>
            <Text style={styles.prefsTitle}>Route Preferences</Text>
            <View style={styles.prefsGrid}>
              {[
                { key: "avoidTolls", icon: "cash", label: "Avoid Tolls" },
                {
                  key: "avoidHighways",
                  icon: "git-compare",
                  label: "Avoid Highways",
                },
                { key: "scenic", icon: "leaf", label: "Scenic Route" },
                { key: "ecoFriendly", icon: "earth", label: "Eco-Friendly" },
              ].map((pref) => (
                <TouchableOpacity
                  key={pref.key}
                  style={[
                    styles.prefItem,
                    preferences[pref.key as keyof RoutePreferences] &&
                      styles.prefItemActive,
                  ]}
                  onPress={() =>
                    setPreferences({
                      [pref.key]:
                        !preferences[pref.key as keyof RoutePreferences],
                    })
                  }
                >
                  <Ionicons
                    name={pref.icon as any}
                    size={18}
                    color={
                      preferences[pref.key as keyof RoutePreferences]
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.prefLabel,
                      preferences[pref.key as keyof RoutePreferences] &&
                        styles.prefLabelActive,
                    ]}
                  >
                    {pref.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}
      </View>

      {/* BOTTOM RESULTS PANEL */}
      {routes.length > 0 && selectedRoute && (
        <Animated.View
          style={[
            styles.resultsPanel,
            {
              transform: [{ translateY: resultsSlideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.resultsHandle} />

          {/* Route Summary */}
          <View style={styles.routeSummary}>
            <View style={styles.routeMainInfo}>
              <Text style={styles.routeDuration}>
                {formatDuration(selectedRoute.metrics.duration_minutes)}
              </Text>
              {traffic && renderTrafficBadge(traffic.condition)}
            </View>
            <Text style={styles.routeDetails}>
              {formatDistance(selectedRoute.metrics.distance_km)} • ₹
              {selectedRoute.metrics.total_cost_inr} total
            </Text>
            {selectedRoute.reasoning && (
              <Text style={styles.routeReason}>{selectedRoute.reasoning}</Text>
            )}
          </View>

          {/* Alternatives Toggle */}
          {alternatives.length > 0 && (
            <TouchableOpacity
              style={styles.alternativesToggle}
              onPress={() => setShowAlternatives(!showAlternatives)}
            >
              <Text style={styles.alternativesToggleText}>
                {alternatives.length} alternative route
                {alternatives.length > 1 ? "s" : ""}
              </Text>
              <Ionicons
                name={showAlternatives ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}

          {/* Alternatives List */}
          {showAlternatives && alternatives.length > 0 && (
            <FlatList
              data={alternatives}
              renderItem={renderAlternativeRoute}
              keyExtractor={(item) => item.route.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.alternativesList}
            />
          )}

          {/* Smart Stops */}
          {smartStops.length > 0 && (
            <View style={styles.smartStopsSection}>
              <Text style={styles.smartStopsTitle}>Smart Stops</Text>
              <FlatList
                data={smartStops.slice(0, 4)}
                renderItem={renderSmartStop}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.smartStopsList}
              />
            </View>
          )}

          {/* Predictive Timing */}
          {predictions && (
            <View style={styles.predictionsSection}>
              <View style={styles.predictionRow}>
                <Ionicons name="time" size={16} color={colors.textSecondary} />
                <Text style={styles.predictionLabel}>Best time to leave</Text>
                <Text style={styles.predictionValue}>
                  {formatTime(predictions.best_departure_time)}
                </Text>
              </View>
              <Text style={styles.predictionNote}>
                Arrive by {formatTime(predictions.current_eta)}
              </Text>
            </View>
          )}

          {/* Start Navigation */}
          <TouchableOpacity style={styles.startNavBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startNavGradient}
            >
              <Ionicons name="navigate" size={22} color="#fff" />
              <Text style={styles.startNavText}>Start Navigation</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* SEARCH MODAL */}
      <Animated.View
        style={[
          styles.searchModal,
          {
            transform: [{ translateY: searchSlideAnim }],
          },
        ]}
      >
        <SafeAreaView style={styles.searchModalContent}>
          {/* Search Header */}
          <View style={styles.searchHeader}>
            <TouchableOpacity onPress={() => setShowSearch(false)}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeInputField === "origin"
                  ? "Search origin..."
                  : "Search destination..."
              }
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Actions */}
          {activeInputField === "origin" && (
            <TouchableOpacity
              style={styles.currentLocationBtn}
              onPress={handleUseCurrentLocation}
            >
              <View style={styles.currentLocationIcon}>
                <Ionicons name="locate" size={20} color={colors.primary} />
              </View>
              <Text style={styles.currentLocationText}>
                Use Current Location
              </Text>
            </TouchableOpacity>
          )}

          {/* Recent Places */}
          {searchQuery.length === 0 && recentPlaces.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <FlatList
                data={recentPlaces.slice(0, 5)}
                renderItem={renderRecentPlace}
                keyExtractor={(item) => item.id}
              />
            </View>
          )}

          {/* Search Results */}
          {isSearching ? (
            <View style={styles.searchLoading}>
              <LoadingSpinner message="Searching..." />
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
            />
          ) : searchQuery.length > 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyStateText}>No results found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try a different search term
              </Text>
            </View>
          ) : null}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const topControlShadow =
  Platform.select({
    web: { boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)" } as any,
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
  }) ?? {};

const searchCardShadow =
  Platform.select({
    web: { boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.12)" } as any,
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  }) ?? {};

const prefsPanelShadow =
  Platform.select({
    web: { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.08)" } as any,
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  }) ?? {};

const resultsPanelShadow =
  Platform.select({
    web: { boxShadow: "0px -8px 20px rgba(0, 0, 0, 0.15)" } as any,
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: -8 },
      elevation: 12,
    },
  }) ?? {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Top Container
  topContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.md,
  },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...topControlShadow,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },

  prefsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...topControlShadow,
  },

  // Search Card
  searchCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: spacing.md,
    ...searchCardShadow,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
  },

  locationDot: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  dotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  locationInput: {
    flex: 1,
    marginLeft: spacing.xs,
  },

  locationText: {
    fontSize: 16,
    color: colors.text,
  },

  locationPlaceholder: {
    color: colors.textTertiary,
  },

  connectorLine: {
    position: "absolute",
    left: 15,
    top: 48,
    bottom: 48,
    width: 2,
    justifyContent: "center",
  },

  connectorDots: {
    alignItems: "center",
    gap: 4,
  },

  connectorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },

  swapButton: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  // Travel Modes
  modesRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: 8,
  },

  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    gap: 6,
  },

  modeBtnActive: {
    backgroundColor: colors.primary,
  },

  modeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  modeLabelActive: {
    color: "#fff",
  },

  // Compute Button
  computeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: spacing.sm,
    gap: 8,
  },

  computeBtnDisabled: {
    backgroundColor: colors.border,
  },

  computeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },

  loadingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginTop: spacing.sm,
    gap: 10,
  },

  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#B91C1C",
  },

  // Preferences Panel
  prefsPanel: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...prefsPanelShadow,
  },

  prefsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  prefsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  prefItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    gap: 6,
  },

  prefItemActive: {
    backgroundColor: `${colors.primary}15`,
  },

  prefLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
  },

  prefLabelActive: {
    color: colors.primary,
  },

  // Results Panel
  resultsPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...resultsPanelShadow,
  },

  resultsHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.md,
  },

  routeSummary: {
    marginBottom: spacing.md,
  },

  routeMainInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },

  routeDuration: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },

  trafficBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 6,
  },

  trafficDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  trafficText: {
    fontSize: 12,
    fontWeight: "600",
  },

  routeDetails: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 6,
  },

  routeReason: {
    fontSize: 13,
    color: colors.textTertiary,
    fontStyle: "italic",
  },

  // Alternatives
  alternativesToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 6,
  },

  alternativesToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },

  alternativesList: {
    paddingVertical: spacing.sm,
    gap: 10,
  },

  alternativeCard: {
    width: 140,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "transparent",
  },

  alternativeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },

  alternativeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  alternativeTime: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },

  recommendedBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },

  recommendedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },

  alternativeDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },

  alternativeDiff: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  // Smart Stops
  smartStopsSection: {
    marginTop: spacing.sm,
  },

  smartStopsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },

  smartStopsList: {
    gap: 10,
  },

  smartStopCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 12,
    minWidth: 160,
    gap: 10,
  },

  smartStopContent: {
    flex: 1,
  },

  smartStopName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },

  smartStopDetail: {
    fontSize: 11,
    color: colors.textTertiary,
  },

  smartStopRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  smartStopRatingText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  // Predictions
  predictionsSection: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 12,
    marginTop: spacing.sm,
  },

  predictionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  predictionLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },

  predictionValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },

  predictionNote: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },

  // Start Navigation
  startNavBtn: {
    marginTop: spacing.md,
    borderRadius: 16,
    overflow: "hidden",
  },

  startNavGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },

  startNavText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },

  // Search Modal
  searchModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
  },

  searchModalContent: {
    flex: 1,
  },

  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
  },

  currentLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },

  currentLocationText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },

  recentSection: {
    padding: spacing.md,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  recentPlaceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },

  recentPlaceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  recentPlaceName: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },

  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  searchResultContent: {
    flex: 1,
  },

  searchResultName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },

  searchResultAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  searchResultDistance: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  searchLoading: {
    padding: spacing.xl,
    alignItems: "center",
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },

  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 4,
  },
});
