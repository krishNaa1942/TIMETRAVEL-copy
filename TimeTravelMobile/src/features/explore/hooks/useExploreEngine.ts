/**
 * useExploreEngine — Core state and data management for the Explore screen.
 * Extracted from the 1735-line ExploreScreen monolith.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { Keyboard } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  useDestinations,
  useSearchDestinations,
} from "@/api/queries/useDestinations";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { destinationsService } from "@/services/destinations";
import { Destination, UnsplashImage } from "@/types";
import { RootStackParamList } from "@/navigation/types";
import {
  analyzeSearchIntent,
  calculateDestinationScore,
  matchesCategory,
  matchesSeason,
  FilterState,
  AIInsight,
} from "../utils/scoring";
import { CURRENT_SEASON } from "../constants/categories";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Destinations showcased by the featured carousel (mirrors server featured_ids)
const FEATURED_IDS = new Set([
  "goa",
  "kerala_backwaters",
  "jaipur",
  "varanasi",
  "andaman",
]);

const _hashId = (id: string): number =>
  id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

const _haversineKm = (
  a: { latitude: number; longitude: number },
  b: { lat: number; lon: number },
): number => {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.latitude);
  const dLon = toRad(b.lon - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export function useExploreEngine() {
  const navigation = useNavigation<NavProp>();
  const userLocation = useTravelIntelligence((s) => s.userLocation);

  // React Query for destinations
  const {
    data: destinationsData,
    isLoading: loading,
    isFetching,
    error: queryError,
    refetch,
  } = useDestinations();

  // Refreshing state for pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);

  // State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [filters, setFilters] = useState<FilterState>({
    budget: "all",
    duration: "all",
    vibe: "all",
    season: "all",
  });
  const [images, setImages] = useState<Record<string, UnsplashImage>>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "Goa",
    "Manali",
    "Kerala",
  ]);

  // Search query with React Query
  const { data: searchResults } = useSearchDestinations(debouncedSearch);

  // Extract destinations
  const destinations = useMemo(
    () => destinationsData?.destinations || [],
    [destinationsData],
  );

  // Load images
  useEffect(() => {
    if (destinations.length > 0) {
      destinationsService
        .getAllDestinationImages()
        .then(setImages)
        .catch(() => {});
    }
  }, [destinations.length]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Search intent analysis
  const searchIntent = useMemo(
    () =>
      debouncedSearch.length >= 2
        ? analyzeSearchIntent(debouncedSearch)
        : undefined,
    [debouncedSearch],
  );

  // Get image URL
  const getImageUrl = useCallback(
    (dest: Destination): string | undefined => {
      const img = images[dest.id];
      return img?.url_small || img?.url_thumb || img?.url_regular;
    },
    [images],
  );

  // AI Insights Engine
  const aiInsights = useMemo((): AIInsight[] => {
    if (destinations.length === 0) return [];

    const insights: AIInsight[] = [];

    // Personalized recommendations based on category
    const personalizedDest = destinations
      .filter((d) => {
        const destStr = `${d.label} ${d.region}`.toLowerCase();
        return matchesCategory(destStr, activeCategory);
      })
      .slice(0, 6);

    if (personalizedDest.length > 0) {
      insights.push({
        id: "personalized",
        type: "personalized",
        title: "Curated for You",
        subtitle: "Based on your interests",
        destinations: personalizedDest,
        reason:
          activeCategory === "all"
            ? "Trending with travelers like you"
            : `Because you love ${activeCategory}`,
      });
    }

    // Seasonal recommendations
    const seasonalDest = destinations
      .filter((d) => {
        const destStr = `${d.label} ${d.region}`.toLowerCase();
        return matchesSeason(destStr, CURRENT_SEASON);
      })
      .slice(0, 5);

    if (seasonalDest.length > 0) {
      insights.push({
        id: "seasonal",
        type: "seasonal",
        title: `${CURRENT_SEASON.charAt(0).toUpperCase() + CURRENT_SEASON.slice(1)} Escapes`,
        subtitle: "Perfect for this season",
        destinations: seasonalDest,
      });
    }

    // Hidden Gems — long-tail destinations not in the featured set,
    // deterministically ranked (stable id-hash, like the trending section).
    const hiddenGems = [...destinations]
      .filter((d) => !FEATURED_IDS.has(d.id))
      .sort((a, b) => _hashId(a.id) - _hashId(b.id))
      .slice(0, 5);

    if (hiddenGems.length > 0) {
      insights.push({
        id: "hidden_gems",
        type: "hidden_gems",
        title: "Hidden Gems",
        subtitle: "Lesser-known destinations worth the detour",
        destinations: hiddenGems,
        reason: "Off the typical tourist trail",
      });
    }

    // Weekend Escapes — nearest destinations to the user's location
    // (skipped when no location is known yet).
    if (userLocation) {
      const weekendEscapes = [...destinations]
        .map((d) => ({ d, km: _haversineKm(userLocation, d) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 5)
        .map(({ d }) => d);

      if (weekendEscapes.length > 0) {
        insights.push({
          id: "weekend",
          type: "weekend",
          title: "Weekend Escapes",
          subtitle: "Close to you",
          destinations: weekendEscapes,
          reason: "Short drive from your location",
        });
      }
    }

    // Trending destinations — stable sort by ID hash
    const trendingDest = [...destinations]
      .sort((a, b) => _hashId(b.id) - _hashId(a.id))
      .slice(0, 5);

    if (trendingDest.length > 0) {
      insights.push({
        id: "trending",
        type: "trending",
        title: "Trending Now",
        subtitle: "Most booked this week",
        destinations: trendingDest,
      });
    }

    return insights;
  }, [destinations, activeCategory, userLocation]);

  // Filtered & scored destinations
  const filteredDestinations = useMemo(() => {
    let result = destinations;

    // Search results take priority
    if (debouncedSearch.trim().length >= 2 && searchResults) {
      return searchResults;
    }

    // Apply category filter
    if (activeCategory !== "all") {
      result = result.filter((d) => {
        const destStr =
          `${d.label} ${d.region} ${d.tagline || ""}`.toLowerCase();
        return matchesCategory(destStr, activeCategory);
      });
    }

    // Score and sort
    result = result
      .map((d) => ({
        ...d,
        _score: calculateDestinationScore(d, filters, searchIntent),
      }))
      .sort((a, b) => (b._score || 0) - (a._score || 0));

    return result;
  }, [
    destinations,
    debouncedSearch,
    searchResults,
    activeCategory,
    filters,
    searchIntent,
  ]);

  // Filter change handler
  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value as any }));
    },
    [],
  );

  // Destination press handler
  const handleDestinationPress = useCallback(
    (dest: Destination) => {
      // Add to recent searches
      setRecentSearches((prev) => {
        const filtered = prev.filter((s) => s !== dest.label);
        return [dest.label, ...filtered].slice(0, 5);
      });

      setIsSearchFocused(false);
      Keyboard.dismiss();
      navigation.navigate("DestinationDetail", { destination: dest });
    },
    [navigation],
  );

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return {
    // Data
    destinations,
    filteredDestinations,
    aiInsights,

    // State
    loading,
    refreshing,
    error: queryError ? (queryError as Error).message : null,
    search,
    setSearch,
    isSearchFocused,
    setIsSearchFocused,
    activeCategory,
    setActiveCategory,
    filters,
    recentSearches,

    // Handlers
    handleFilterChange,
    getImageUrl,
    handleDestinationPress,
    handleRefresh,
  };
}
