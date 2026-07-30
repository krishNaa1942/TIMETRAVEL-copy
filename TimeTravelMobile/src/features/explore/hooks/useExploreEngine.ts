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
import { destinationsService } from "@/services/destinations";
import { Destination, RootStackParamList, UnsplashImage } from "@/types";
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

export function useExploreEngine() {
  const navigation = useNavigation<NavProp>();

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

    // Trending destinations — stable sort by ID hash
    const trendingDest = [...destinations]
      .sort((a, b) => {
        const hashA = a.id
          .split("")
          .reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const hashB = b.id
          .split("")
          .reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return hashB - hashA;
      })
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
  }, [destinations, activeCategory]);

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
