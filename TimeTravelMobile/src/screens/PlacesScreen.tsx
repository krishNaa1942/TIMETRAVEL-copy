/**
 * PlacesScreen V7 - AI-Powered Map-First Discovery Engine
 * Production-grade place discovery with real-time location, AI scoring, and smart filters
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Animated,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useLocation, DEFAULT_CITIES } from "@/hooks/useLocation";
import { usePlaces, EnhancedPlace } from "@/hooks/usePlaces";
import { colors, spacing } from "@/theme/colors";
import { Shimmer } from "@/components/UI/SkeletonLoader";
import { PressableScale } from "@/components/UI/PressableScale";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const searchBtnShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 4px 8px rgba(59, 130, 246, 0.3)" }
    : { elevation: 4 }
) as any;

const placeCardShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)" }
    : { elevation: 2 }
) as any;

const placeCardSelectedShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 2px 8px rgba(59, 130, 246, 0.2)" }
    : { elevation: 3 }
) as any;

// ─────────────────────────────────────────────────────────────
// SITUATIONS CONFIG
// ─────────────────────────────────────────────────────────────

const SITUATIONS = [
  {
    key: "exploring",
    label: "Sightseeing",
    icon: "compass-outline",
    color: "#3B82F6",
  },
  {
    key: "hungry",
    label: "Food",
    icon: "restaurant-outline",
    color: "#F59E0B",
  },
  { key: "relaxing", label: "Relax", icon: "leaf-outline", color: "#10B981" },
  {
    key: "shopping",
    label: "Shopping",
    icon: "bag-handle-outline",
    color: "#EC4899",
  },
  {
    key: "nightlife",
    label: "Nightlife",
    icon: "moon-outline",
    color: "#8B5CF6",
  },
  { key: "family", label: "Family", icon: "people-outline", color: "#06B6D4" },
  {
    key: "emergency",
    label: "Emergency",
    icon: "medkit-outline",
    color: "#EF4444",
  },
];

// ─────────────────────────────────────────────────────────────
// TIME OF DAY GREETING
// ─────────────────────────────────────────────────────────────

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)
    return { text: "Good Morning", icon: "partly-sunny-outline" };
  if (hour >= 12 && hour < 17)
    return { text: "Good Afternoon", icon: "sunny-outline" };
  if (hour >= 17 && hour < 21)
    return { text: "Good Evening", icon: "moon-outline" };
  return { text: "Good Night", icon: "moon" };
};

// ─────────────────────────────────────────────────────────────
// PLACE CARD COMPONENT
// ─────────────────────────────────────────────────────────────

interface PlaceCardProps {
  place: EnhancedPlace;
  onPress: () => void;
  isSelected: boolean;
}

const PlaceCard = React.memo(
  ({ place, onPress, isSelected }: PlaceCardProps) => {
    const priceDisplay = place.price_level
      ? typeof place.price_level === "string"
        ? place.price_level
        : "💰".repeat(place.price_level)
      : "";

    return (
      <PressableScale
        onPress={onPress}
        style={[styles.placeCard, isSelected && styles.placeCardSelected]}
      >
        {/* AI Score Badge */}
        <View style={styles.aiScoreBadge}>
          <Ionicons name="sparkles" size={12} color="#FFF" />
          <Text style={styles.aiScoreText}>{place.aiScore}</Text>
        </View>

        {/* Content */}
        <View style={styles.placeHeader}>
          <Text style={styles.placeName} numberOfLines={1}>
            {place.name}
          </Text>
          {place.rating ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        {/* Category & Status Row */}
        <View style={styles.categoryRow}>
          <Text style={styles.categoryText} numberOfLines={1}>
            {place.category}
          </Text>
          {place.is_open !== undefined && (
            <View
              style={[
                styles.statusBadge,
                place.is_open ? styles.openBadge : styles.closedBadge,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: place.is_open ? "#10B981" : "#EF4444" },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: place.is_open ? "#10B981" : "#EF4444" },
                ]}
              >
                {place.is_open ? "Open" : "Closed"}
              </Text>
            </View>
          )}
        </View>

        {/* AI Reason */}
        <Text style={styles.aiReason} numberOfLines={2}>
          {place.aiReason}
        </Text>

        {/* Meta Info */}
        <View style={styles.placeMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color={colors.gray} />
            <Text style={styles.metaText}>{place.distanceKm} km</Text>
          </View>
          {place.etaMinutes && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.gray} />
              <Text style={styles.metaText}>{place.etaMinutes} min</Text>
            </View>
          )}
          {priceDisplay && <Text style={styles.priceText}>{priceDisplay}</Text>}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              const url =
                Platform.OS === "ios"
                  ? `maps://app?daddr=${place.lat},${place.lon}`
                  : `google.navigation:q=${place.lat},${place.lon}`;
              Linking.openURL(url).catch(() => {});
            }}
          >
            <Ionicons name="navigate" size={16} color={colors.primary} />
            <Text style={styles.actionBtnText}>Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="bookmark-outline" size={16} color={colors.gray} />
          </TouchableOpacity>
        </View>
      </PressableScale>
    );
  },
);

// ─────────────────────────────────────────────────────────────
// SITUATION CHIP
// ─────────────────────────────────────────────────────────────

interface SituationChipProps {
  situation: (typeof SITUATIONS)[0];
  isSelected: boolean;
  onPress: () => void;
}

const SituationChip = React.memo(
  ({ situation, isSelected, onPress }: SituationChipProps) => (
    <PressableScale
      onPress={onPress}
      style={[
        styles.situationChip,
        isSelected && {
          backgroundColor: situation.color,
          borderColor: situation.color,
        },
      ]}
    >
      <Ionicons
        name={situation.icon as any}
        size={16}
        color={isSelected ? "#FFF" : situation.color}
      />
      <Text
        style={[styles.situationText, isSelected && styles.situationTextActive]}
      >
        {situation.label}
      </Text>
    </PressableScale>
  ),
);

// ─────────────────────────────────────────────────────────────
// CITY SELECTOR
// ─────────────────────────────────────────────────────────────

interface CitySelectorProps {
  cities: string[];
  selectedCity: string;
  onSelect: (city: string) => void;
  currentLocation?: string;
}

const CitySelector = React.memo(
  ({ cities, selectedCity, onSelect, currentLocation }: CitySelectorProps) => (
    <View style={styles.citySection}>
      <Text style={styles.sectionLabel}>Location</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cityScroll}
      >
        {currentLocation && currentLocation !== selectedCity && (
          <PressableScale
            onPress={() => onSelect(currentLocation)}
            style={[styles.cityChip, styles.currentLocationChip]}
          >
            <Ionicons name="location" size={14} color="#FFF" />
            <Text style={styles.currentLocationText}>Current Location</Text>
          </PressableScale>
        )}
        {cities.map((city) => (
          <PressableScale
            key={city}
            onPress={() => onSelect(city)}
            style={[
              styles.cityChip,
              selectedCity === city && styles.cityChipActive,
            ]}
          >
            <Text
              style={[
                styles.cityText,
                selectedCity === city && styles.cityTextActive,
              ]}
            >
              {city}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  ),
);

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────

const EmptyState = React.memo(
  ({
    onSearch,
    hasSearched,
  }: {
    onSearch: () => void;
    hasSearched: boolean;
  }) => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons
          name={hasSearched ? "search-outline" : "map-outline"}
          size={48}
          color={colors.gray}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {hasSearched ? "No places found" : "Discover Amazing Places"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasSearched
          ? "Try adjusting your filters or search in a different area"
          : "Select your mood and tap search to find the best places nearby"}
      </Text>
      {!hasSearched && (
        <TouchableOpacity style={styles.emptySearchBtn} onPress={onSearch}>
          <Ionicons name="search" size={18} color="#FFF" />
          <Text style={styles.emptySearchBtnText}>Start Exploring</Text>
        </TouchableOpacity>
      )}
    </View>
  ),
);

// ─────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────

const PlacesSkeleton = React.memo(() => (
  <View style={styles.skeletonContainer}>
    {[1, 2, 3].map((i) => (
      <View key={i} style={styles.skeletonCard}>
        <Shimmer width="30%" height={20} borderRadius={10} />
        <View style={{ height: 8 }} />
        <Shimmer width="80%" height={16} borderRadius={8} />
        <View style={{ height: 4 }} />
        <Shimmer width="60%" height={12} borderRadius={6} />
      </View>
    ))}
  </View>
));

// ─────────────────────────────────────────────────────────────
// OFFLINE BANNER
// ─────────────────────────────────────────────────────────────

const OfflineBanner = React.memo(() => (
  <View style={styles.offlineBanner}>
    <Ionicons name="cloud-offline-outline" size={16} color="#F59E0B" />
    <Text style={styles.offlineText}>
      You're offline. Showing cached results.
    </Text>
  </View>
));

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function PlacesScreen() {
  const {
    location,
    loading: locationLoading,
    refreshLocation,
    hasPermission,
  } = useLocation();
  const {
    places,
    loading,
    refreshing,
    error,
    search,
    refresh,
    selectedPlace,
    selectPlace,
    serviceAvailable,
    isOffline,
  } = usePlaces();

  const [selectedCity, setSelectedCity] = useState("Goa");
  const [situation, setSituation] = useState("exploring");
  const [hasSearched, setHasSearched] = useState(false);

  // Get greeting based on time
  const greeting = useMemo(() => getTimeGreeting(), []);

  // Available cities list
  const cities = useMemo(() => Object.keys(DEFAULT_CITIES), []);

  // Handle search
  const handleSearch = useCallback(async () => {
    const coords = DEFAULT_CITIES[selectedCity];
    if (!coords) return;

    setHasSearched(true);
    await search(coords.lat, coords.lon, situation);
  }, [selectedCity, situation, search]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Handle place selection
  const handlePlacePress = useCallback(
    (place: EnhancedPlace) => {
      selectPlace(selectedPlace?.fsq_id === place.fsq_id ? null : place);
    },
    [selectedPlace, selectPlace],
  );

  // Render place item
  const renderPlace = useCallback(
    ({ item, index }: { item: EnhancedPlace; index: number }) => (
      <PlaceCard
        place={item}
        onPress={() => handlePlacePress(item)}
        isSelected={selectedPlace?.fsq_id === item.fsq_id}
      />
    ),
    [selectedPlace, handlePlacePress],
  );

  // Key extractor
  const keyExtractor = useCallback((item: EnhancedPlace) => item.fsq_id, []);

  // Service unavailable state
  if (!serviceAvailable) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.emptyContainer}>
          <View
            style={[styles.emptyIconContainer, { backgroundColor: "#FEF3C7" }]}
          >
            <Ionicons name="server-outline" size={48} color="#F59E0B" />
          </View>
          <Text style={styles.emptyTitle}>Places Service Unavailable</Text>
          <Text style={styles.emptySubtitle}>
            Foursquare API is not configured. Please contact support.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => {}}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{greeting.text}</Text>
            <Text style={styles.title}>Discover Places</Text>
          </View>
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={refreshLocation}
          >
            <Ionicons
              name="location-outline"
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* City Selector */}
      <CitySelector
        cities={cities}
        selectedCity={selectedCity}
        onSelect={(city) => {
          setSelectedCity(city);
          setHasSearched(false);
        }}
        currentLocation={location?.city}
      />

      {/* Situation Selector */}
      <View style={styles.situationSection}>
        <Text style={styles.sectionLabel}>What are you in the mood for?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.situationScroll}
          contentContainerStyle={styles.situationScrollContent}
        >
          {SITUATIONS.map((s) => (
            <SituationChip
              key={s.key}
              situation={s}
              isSelected={situation === s.key}
              onPress={() => {
                setSituation(s.key);
                setHasSearched(false);
              }}
            />
          ))}
        </ScrollView>
      </View>

      {/* Search Button */}
      <View style={styles.searchSection}>
        <PressableScale
          style={styles.searchBtn}
          onPress={handleSearch}
          disabled={loading}
        >
          {loading ? (
            <>
              <Ionicons name="search-outline" size={18} color="#FFF" />
              <Text style={styles.searchBtnText}>Searching...</Text>
            </>
          ) : (
            <>
              <Ionicons name="search" size={18} color="#FFF" />
              <Text style={styles.searchBtnText}>
                Find Places in {selectedCity}
              </Text>
            </>
          )}
        </PressableScale>
      </View>

      {/* Offline Banner */}
      {isOffline && <OfflineBanner />}

      {/* Error Message */}
      {error && !isOffline && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {loading ? (
        <PlacesSkeleton />
      ) : (
        <FlatList
          data={places}
          keyExtractor={keyExtractor}
          renderItem={renderPlace}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState onSearch={handleSearch} hasSearched={hasSearched} />
          }
          ListHeaderComponent={
            places.length > 0 ? (
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {places.length} places found
                </Text>
                <Text style={styles.resultsHint}>
                  Sorted by AI recommendations
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 13,
    color: colors.gray,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  // City Section
  citySection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cityScroll: {
    marginHorizontal: -spacing.md,
  },
  cityChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginLeft: spacing.md,
  },
  cityChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cityText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  cityTextActive: {
    color: "#FFF",
    fontWeight: "600",
  },
  currentLocationChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentLocationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },

  // Situation Section
  situationSection: {
    marginBottom: spacing.md,
  },
  situationScroll: {
    marginHorizontal: -spacing.md,
  },
  situationScrollContent: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  situationChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 8,
  },
  situationText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  situationTextActive: {
    color: "#FFF",
    fontWeight: "600",
  },

  // Search Section
  searchSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    ...searchBtnShadow,
  },
  searchBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },

  // Offline Banner
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3C7",
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  offlineText: {
    fontSize: 13,
    color: "#92400E",
    marginLeft: 8,
    fontWeight: "500",
  },

  // Error Banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: "#991B1B",
    marginLeft: 8,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 120,
  },
  resultsHeader: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  resultsHint: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },

  // Place Card
  placeCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...placeCardShadow,
  },
  placeCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    ...placeCardSelectedShadow,
  },
  aiScoreBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  aiScoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  placeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 50,
  },
  placeName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  categoryText: {
    fontSize: 13,
    color: colors.gray,
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  openBadge: {
    backgroundColor: "#D1FAE5",
  },
  closedBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  aiReason: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 10,
    lineHeight: 18,
    fontStyle: "italic",
  },
  placeMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.gray,
  },
  priceText: {
    fontSize: 12,
    color: "#F59E0B",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  emptySearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: spacing.lg,
    gap: 8,
  },
  emptySearchBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFF",
  },

  // Retry Button
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: spacing.md,
    gap: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },

  // Skeleton
  skeletonContainer: {
    padding: spacing.md,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
