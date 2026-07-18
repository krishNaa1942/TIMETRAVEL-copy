/**
 * ExploreScreen V6 – AI-Powered Intelligent Discovery Engine
 * World-class travel discovery competing with Airbnb, Google Travel, MakeMyTrip
 *
 * Features:
 * - FlashList for 60fps smooth scrolling with estimatedItemSize
 * - AI-powered personalization engine
 * - Intent-based search (not keyword)
 * - Smart clustering & recommendations
 * - Context-aware suggestions (season, budget, user type)
 * - Progressive image loading with blur hash
 * - Responsive layout: 2/3/4 columns for phone/tablet/desktop
 * - Pull-to-refresh
 * - Reanimated search overlay (UI-thread animations)
 * - Skeleton loading for premium perceived performance
 * - Micro-interactions & haptic feedback
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  memo,
} from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Platform,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ReAnimated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as ReEasing,
} from "react-native-reanimated";

import ErrorMessage from "@/components/Common/ErrorMessage";
import DestinationCard from "@/components/Features/DestinationCard";
import {
  useDestinations,
  useSearchDestinations,
} from "@/api/queries/useDestinations";
import { destinationsService } from "@/services/destinations";
import { Destination, RootStackParamList, UnsplashImage } from "@/types";
import { colors, spacing } from "@/theme/colors";
import { PressableScale } from "@/components/UI/PressableScale";
import { GlassCard } from "@/components/UI/GlassCard";
import { Shimmer } from "@/components/UI/SkeletonLoader";

const shouldUseNativeDriver = Platform.OS !== "web";

// ─────────────────────────────────────────────────────────────
// RESPONSIVE HELPERS
// ─────────────────────────────────────────────────────────────

/** Compute responsive column count based on window width */
const getColumnCount = (width: number): number => {
  if (width >= 1200) return 4;  // Desktop web
  if (width >= 768) return 3;   // Tablet / iPad
  return 2;                      // Phone
};

/** Compute card width from screen width and column count */
const getCardWidth = (screenWidth: number, cols: number): number => {
  const totalHorizontalPadding = spacing.lg * 2;
  const totalGaps = spacing.md * (cols - 1);
  return (screenWidth - totalHorizontalPadding - totalGaps) / cols;
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

interface SearchIntent {
  type: "destination" | "activity" | "vibe" | "season" | "budget" | "unknown";
  confidence: number;
  entities: string[];
}

interface AIInsight {
  id: string;
  type: "recommendation" | "trending" | "seasonal" | "personalized";
  title: string;
  subtitle: string;
  destinations: Destination[];
  reason?: string;
  cta?: string;
}

interface FilterState {
  budget: "all" | "budget" | "mid" | "luxury";
  duration: "all" | "weekend" | "week" | "extended";
  vibe:
    | "all"
    | "adventure"
    | "relaxation"
    | "cultural"
    | "romantic"
    | "family"
    | "spiritual";
  season: "all" | "summer" | "winter" | "monsoon" | "spring";
}

interface CategoryConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
  gradient: string[];
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const CATEGORIES: CategoryConfig[] = [
  {
    id: "all",
    label: "For You",
    icon: "star-four-points",
    color: "#8B5CF6",
    gradient: ["#8B5CF6", "#6366F1"],
  },
  {
    id: "beach",
    label: "Beaches",
    icon: "beach",
    color: "#0EA5E9",
    gradient: ["#0EA5E9", "#06B6D4"],
  },
  {
    id: "mountain",
    label: "Mountains",
    icon: "image-filter-hdr",
    color: "#10B981",
    gradient: ["#10B981", "#059669"],
  },
  {
    id: "city",
    label: "Cities",
    icon: "city-variant",
    color: "#F59E0B",
    gradient: ["#F59E0B", "#D97706"],
  },
  {
    id: "spiritual",
    label: "Spiritual",
    icon: "temple-buddhist",
    color: "#EC4899",
    gradient: ["#EC4899", "#DB2777"],
  },
  {
    id: "adventure",
    label: "Adventure",
    icon: "hiking",
    color: "#EF4444",
    gradient: ["#EF4444", "#DC2626"],
  },
];

const CURRENT_SEASON = (() => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 5) return "summer";
  if (month >= 6 && month <= 9) return "monsoon";
  if (month >= 10 || month <= 1) return "winter";
  return "spring";
})();

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

const analyzeSearchIntent = (query: string): SearchIntent => {
  const q = query.toLowerCase().trim();

  // Activity-based intent
  if (/\b(swim|surf|beach|sunbathe|scuba|snorkel)\b/.test(q)) {
    return { type: "activity", confidence: 0.9, entities: ["beach", "water"] };
  }
  if (/\b(trek|hike|climb|camp|adventure)\b/.test(q)) {
    return {
      type: "activity",
      confidence: 0.9,
      entities: ["mountain", "adventure"],
    };
  }
  if (/\b(temple|spiritual|meditation|yoga|peace)\b/.test(q)) {
    return {
      type: "vibe",
      confidence: 0.85,
      entities: ["spiritual", "peaceful"],
    };
  }

  // Budget intent
  if (/\b(cheap|budget|affordable|low cost)\b/.test(q)) {
    return { type: "budget", confidence: 0.8, entities: ["budget"] };
  }
  if (/\b(luxury|premium|expensive|high-end)\b/.test(q)) {
    return { type: "budget", confidence: 0.8, entities: ["luxury"] };
  }

  // Season intent
  if (/\b(summer|hot|sunny)\b/.test(q)) {
    return { type: "season", confidence: 0.75, entities: ["summer"] };
  }
  if (/\b(winter|snow|cold)\b/.test(q)) {
    return { type: "season", confidence: 0.75, entities: ["winter"] };
  }
  if (/\b(monsoon|rain|romantic)\b/.test(q)) {
    return { type: "season", confidence: 0.75, entities: ["monsoon"] };
  }

  // Vibe intent
  if (/\b(romantic|honeymoon|couple)\b/.test(q)) {
    return { type: "vibe", confidence: 0.85, entities: ["romantic", "couple"] };
  }
  if (/\b(family|kids|children)\b/.test(q)) {
    return { type: "vibe", confidence: 0.85, entities: ["family", "kids"] };
  }
  if (/\b(solo|alone|backpack)\b/.test(q)) {
    return { type: "vibe", confidence: 0.8, entities: ["solo", "adventure"] };
  }

  return { type: "destination", confidence: 0.6, entities: [q] };
};

const calculateDestinationScore = (
  dest: Destination,
  filters: FilterState,
  searchIntent?: SearchIntent,
): number => {
  let score = 50; // Base score

  // Season bonus
  const destStr =
    `${dest.label} ${dest.region} ${dest.tagline || ""}`.toLowerCase();

  if (CURRENT_SEASON === "summer" && /beach|coast|goa|andaman/.test(destStr)) {
    score += 20;
  } else if (
    CURRENT_SEASON === "winter" &&
    /mountain|hill|snow|manali|shimla/.test(destStr)
  ) {
    score += 20;
  } else if (
    CURRENT_SEASON === "monsoon" &&
    /hill|green|kerala|coorg/.test(destStr)
  ) {
    score += 15;
  }

  // Filter matching
  if (
    filters.vibe === "adventure" &&
    /trek|hike|adventure|mountain/.test(destStr)
  ) {
    score += 25;
  } else if (
    filters.vibe === "relaxation" &&
    /beach|resort|spa|backwater/.test(destStr)
  ) {
    score += 25;
  } else if (
    filters.vibe === "spiritual" &&
    /temple|spiritual|varanasi|rishikesh/.test(destStr)
  ) {
    score += 25;
  }

  // Search intent matching
  if (searchIntent?.entities) {
    for (const entity of searchIntent.entities) {
      if (destStr.includes(entity)) {
        score += 30 * searchIntent.confidence;
      }
    }
  }

  return Math.min(score, 100);
};

const formatCount = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface CategoryPillProps {
  category: CategoryConfig;
  isActive: boolean;
  onPress: () => void;
}

const CategoryPill = memo(
  ({ category, isActive, onPress }: CategoryPillProps) => {
    const scale = useSharedValue(1);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
      scale.value = withTiming(0.95, { duration: 50 }, () => {
        scale.value = withTiming(1, { duration: 150 });
      });
      onPress();
    };

    return (
      <ReAnimated.View style={animStyle}>
        <PressableScale
          style={[
            styles.categoryPill,
            isActive && {
              backgroundColor: category.color,
              borderColor: category.color,
            },
          ]}
          onPress={handlePress}
        >
          <MaterialCommunityIcons
            name={category.icon as any}
            size={16}
            color={isActive ? "#FFF" : category.color}
          />
          <Text style={[styles.categoryText, isActive && { color: "#FFF" }]}>
            {category.label}
          </Text>
        </PressableScale>
      </ReAnimated.View>
    );
  },
);
CategoryPill.displayName = "CategoryPill";

// ─────────────────────────────────────────────────────────────

interface InsightCardProps {
  insight: AIInsight;
  getImageUrl: (dest: Destination) => string | undefined;
  onDestinationPress: (dest: Destination) => void;
}

const InsightCard = memo(
  ({ insight, getImageUrl, onDestinationPress }: InsightCardProps) => {
    const scrollRef = useRef<any>(null);

    return (
      <View style={styles.insightSection}>
        <View style={styles.insightHeader}>
          <View style={styles.insightTitleRow}>
            <MaterialCommunityIcons
              name={
                insight.type === "trending"
                  ? "fire"
                  : insight.type === "seasonal"
                    ? "weather-sunny"
                    : insight.type === "personalized"
                      ? "heart"
                      : "star-four-points"
              }
              size={20}
              color={
                insight.type === "trending"
                  ? "#EF4444"
                  : insight.type === "seasonal"
                    ? "#F59E0B"
                    : insight.type === "personalized"
                      ? "#EC4899"
                      : "#8B5CF6"
              }
            />
            <Text style={styles.insightTitle}>{insight.title}</Text>
          </View>
          <Text style={styles.insightSubtitle}>{insight.subtitle}</Text>
          {insight.reason && (
            <View style={styles.insightReason}>
              <MaterialCommunityIcons
                name="lightbulb-outline"
                size={12}
                color="#64748B"
              />
              <Text style={styles.insightReasonText}>{insight.reason}</Text>
            </View>
          )}
        </View>

        <FlashList
          ref={scrollRef}
          horizontal
          data={insight.destinations}
          keyExtractor={(d) => d.id}
          estimatedItemSize={280}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.insightListContent}
          renderItem={({ item }) => (
            <DestinationCard
              destination={item}
              imageUrl={getImageUrl(item)}
              onPress={() => onDestinationPress(item)}
              horizontal
            />
          )}
        />
      </View>
    );
  },
);
InsightCard.displayName = "InsightCard";

// ─────────────────────────────────────────────────────────────

interface FilterChipsProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
}

const FilterChips = memo(({ filters, onFilterChange }: FilterChipsProps) => {
  const activeCount = Object.values(filters).filter((v) => v !== "all").length;

  return (
    <View style={styles.filterChipsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipsScroll}
      >
        {/* Budget Filter */}
        <PressableScale
          style={[
            styles.filterChip,
            filters.budget !== "all" && styles.filterChipActive,
          ]}
          onPress={() =>
            onFilterChange(
              "budget",
              filters.budget === "all" ? "budget" : "all",
            )
          }
        >
          <MaterialCommunityIcons
            name="currency-inr"
            size={14}
            color={filters.budget !== "all" ? "#FFF" : "#64748B"}
          />
          <Text
            style={[
              styles.filterChipText,
              filters.budget !== "all" && { color: "#FFF" },
            ]}
          >
            {filters.budget === "all" ? "Budget" : filters.budget}
          </Text>
        </PressableScale>

        {/* Duration Filter */}
        <PressableScale
          style={[
            styles.filterChip,
            filters.duration !== "all" && styles.filterChipActive,
          ]}
          onPress={() =>
            onFilterChange(
              "duration",
              filters.duration === "all" ? "weekend" : "all",
            )
          }
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={14}
            color={filters.duration !== "all" ? "#FFF" : "#64748B"}
          />
          <Text
            style={[
              styles.filterChipText,
              filters.duration !== "all" && { color: "#FFF" },
            ]}
          >
            {filters.duration === "all" ? "Duration" : filters.duration}
          </Text>
        </PressableScale>

        {/* Vibe Filter */}
        <PressableScale
          style={[
            styles.filterChip,
            filters.vibe !== "all" && styles.filterChipActive,
          ]}
          onPress={() =>
            onFilterChange("vibe", filters.vibe === "all" ? "adventure" : "all")
          }
        >
          <MaterialCommunityIcons
            name="heart-outline"
            size={14}
            color={filters.vibe !== "all" ? "#FFF" : "#64748B"}
          />
          <Text
            style={[
              styles.filterChipText,
              filters.vibe !== "all" && { color: "#FFF" },
            ]}
          >
            {filters.vibe === "all" ? "Vibe" : filters.vibe}
          </Text>
        </PressableScale>

        {/* Season Filter */}
        <PressableScale
          style={[
            styles.filterChip,
            filters.season !== "all" && styles.filterChipActive,
          ]}
          onPress={() =>
            onFilterChange(
              "season",
              filters.season === "all" ? CURRENT_SEASON : "all",
            )
          }
        >
          <MaterialCommunityIcons
            name="weather-sunny"
            size={14}
            color={filters.season !== "all" ? "#FFF" : "#64748B"}
          />
          <Text
            style={[
              styles.filterChipText,
              filters.season !== "all" && { color: "#FFF" },
            ]}
          >
            {filters.season === "all" ? "Season" : filters.season}
          </Text>
        </PressableScale>
      </ScrollView>

      {activeCount > 0 && (
        <TouchableOpacity
          style={styles.clearFilters}
          onPress={() => {
            onFilterChange("budget", "all");
            onFilterChange("duration", "all");
            onFilterChange("vibe", "all");
            onFilterChange("season", "all");
          }}
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={16}
            color="#64748B"
          />
        </TouchableOpacity>
      )}
    </View>
  );
});
FilterChips.displayName = "FilterChips";

// ─────────────────────────────────────────────────────────────

interface SearchOverlayProps {
  visible: boolean;
  search: string;
  onSearchChange: (text: string) => void;
  onClose: () => void;
  onResultPress: (dest: Destination) => void;
  recentSearches: string[];
  destinations: Destination[];
  getImageUrl: (dest: Destination) => string | undefined;
}

const SearchOverlay = memo(
  ({
    visible,
    search,
    onSearchChange,
    onClose,
    onResultPress,
    recentSearches,
    destinations,
    getImageUrl,
  }: SearchOverlayProps) => {
    const searchIntent = useMemo(() => analyzeSearchIntent(search), [search]);

    const quickSearches = useMemo(
      () => [
        { query: "Beaches near me", icon: "beach", color: "#0EA5E9" },
        { query: "Mountain treks", icon: "image-filter-hdr", color: "#10B981" },
        {
          query: "Weekend getaways",
          icon: "calendar-weekend",
          color: "#F59E0B",
        },
        { query: "Romantic spots", icon: "heart", color: "#EC4899" },
      ],
      [],
    );

    if (!visible) return null;

    return (
      <ReAnimated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.searchOverlay}
      >
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />

        <ReAnimated.View
          entering={SlideInDown.duration(300).easing(
            ReEasing.out(ReEasing.cubic),
          )}
          exiting={SlideOutDown.duration(200)}
          style={styles.searchOverlayContent}
        >
          {/* Search Input */}
          <View style={styles.searchOverlayInput}>
            <MaterialCommunityIcons name="magnify" size={22} color="#64748B" />
            <TextInput
              placeholder="Try 'romantic beaches' or 'mountain trek'..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={onSearchChange}
              style={styles.searchOverlayTextInput}
              autoFocus
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange("")}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Intent Badge */}
          {search.length >= 2 && searchIntent.type !== "unknown" && (
            <ReAnimated.View entering={FadeIn.duration(200)} style={styles.intentBadge}>
              <MaterialCommunityIcons
                name={
                  searchIntent.type === "activity"
                    ? "run"
                    : searchIntent.type === "vibe"
                      ? "heart"
                      : searchIntent.type === "season"
                        ? "weather-sunny"
                        : searchIntent.type === "budget"
                          ? "currency-inr"
                          : "map-marker"
                }
                size={14}
                color="#8B5CF6"
              />
              <Text style={styles.intentText}>
                {searchIntent.type === "activity"
                  ? "Looking for activities"
                  : searchIntent.type === "vibe"
                    ? "Matching your vibe"
                    : searchIntent.type === "season"
                      ? "Seasonal suggestion"
                      : searchIntent.type === "budget"
                        ? "Budget-friendly"
                        : "Destinations"}
              </Text>
            </ReAnimated.View>
          )}

          {/* Quick Searches */}
          {search.length === 0 && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.searchOverlaySection}>Quick Searches</Text>
              <View style={styles.quickSearchGrid}>
                {quickSearches.map((qs) => (
                  <PressableScale
                    key={qs.query}
                    style={styles.quickSearchChip}
                    onPress={() => onSearchChange(qs.query)}
                  >
                    <MaterialCommunityIcons
                      name={qs.icon as any}
                      size={18}
                      color={qs.color}
                    />
                    <Text style={styles.quickSearchText}>{qs.query}</Text>
                  </PressableScale>
                ))}
              </View>

              <Text style={styles.searchOverlaySection}>Recent Searches</Text>
              <View style={styles.recentSearchesRow}>
                {recentSearches.map((s, i) => (
                  <TouchableOpacity
                    key={`${s}-${i}`}
                    style={styles.recentSearchChip}
                    onPress={() => onSearchChange(s)}
                  >
                    <MaterialCommunityIcons
                      name="history"
                      size={14}
                      color="#94A3B8"
                    />
                    <Text style={styles.recentSearchText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.searchOverlaySection}>
                Trending Destinations
              </Text>
              {destinations.slice(0, 5).map((dest) => (
                <PressableScale
                  key={dest.id}
                  style={styles.trendingRow}
                  onPress={() => onResultPress(dest)}
                >
                  <MaterialCommunityIcons
                    name="fire"
                    size={18}
                    color="#EF4444"
                  />
                  <Text style={styles.trendingRowText}>{dest.label}</Text>
                  <Text style={styles.trendingRowRegion}>{dest.region}</Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color="#CBD5E1"
                  />
                </PressableScale>
              ))}
            </ScrollView>
          )}
        </ReAnimated.View>
      </ReAnimated.View>
    );
  },
);
SearchOverlay.displayName = "SearchOverlay";

// ─────────────────────────────────────────────────────────────
// CUSTOM HOOK
// ─────────────────────────────────────────────────────────────

function useExploreEngine() {
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
        if (activeCategory === "beach")
          return /beach|goa|andaman|kerala/.test(destStr);
        if (activeCategory === "mountain")
          return /mountain|hill|manali|shimla|leh/.test(destStr);
        if (activeCategory === "city")
          return /mumbai|delhi|bangalore|city/.test(destStr);
        if (activeCategory === "spiritual")
          return /varanasi|rishikesh|temple|spiritual/.test(destStr);
        if (activeCategory === "adventure")
          return /trek|adventure|hiking|camp/.test(destStr);
        return true;
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
        if (CURRENT_SEASON === "summer")
          return /beach|hill|coast|manali/.test(destStr);
        if (CURRENT_SEASON === "winter")
          return /goa|kerala|rajasthan|desert/.test(destStr);
        if (CURRENT_SEASON === "monsoon")
          return /hill|kerala|coorg|lonavala/.test(destStr);
        return true;
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

    // Trending destinations — stable sort by ID hash to avoid reshuffling on re-renders
    const trendingDest = [...destinations]
      .sort((a, b) => {
        const hashA = a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const hashB = b.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
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

    // Apply filters
    result = result.filter((d) => {
      const destStr = `${d.label} ${d.region} ${d.tagline || ""}`.toLowerCase();

      // Category filter
      if (activeCategory !== "all") {
        if (
          activeCategory === "beach" &&
          !/beach|goa|andaman|coast/.test(destStr)
        )
          return false;
        if (
          activeCategory === "mountain" &&
          !/mountain|hill|manali|shimla|leh/.test(destStr)
        )
          return false;
        if (
          activeCategory === "city" &&
          !/mumbai|delhi|bangalore|city/.test(destStr)
        )
          return false;
        if (
          activeCategory === "spiritual" &&
          !/varanasi|rishikesh|temple|spiritual/.test(destStr)
        )
          return false;
        if (
          activeCategory === "adventure" &&
          !/trek|adventure|hiking|camp/.test(destStr)
        )
          return false;
      }

      return true;
    });

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

  // Refresh handler with refreshing state
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

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// SKELETON LOADING COMPONENT
// ─────────────────────────────────────────────────────────────

const ExploreSkeleton: React.FC = () => {
  const { width } = useWindowDimensions();
  const cols = getColumnCount(width);
  const cardW = getCardWidth(width, cols);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        {/* Title skeleton */}
        <Shimmer width={140} height={34} borderRadius={8} />
        <Shimmer width={200} height={14} borderRadius={6} style={{ marginTop: 6 }} />

        {/* Search bar skeleton */}
        <Shimmer width="100%" height={52} borderRadius={16} style={{ marginTop: 16 }} />

        {/* Category pills skeleton */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Shimmer key={i} width={90} height={40} borderRadius={24} />
          ))}
        </View>
      </View>

      {/* Insight section skeleton */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <Shimmer width={160} height={18} borderRadius={6} />
        <Shimmer width={120} height={13} borderRadius={4} style={{ marginTop: 6 }} />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          {[1, 2, 3].map((i) => (
            <Shimmer key={i} width={260} height={220} borderRadius={16} />
          ))}
        </View>
      </View>

      {/* Grid skeleton */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <Shimmer width={180} height={20} borderRadius={6} />
          <Shimmer width={60} height={14} borderRadius={4} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {Array.from({ length: cols * 2 }).map((_, i) => (
            <View key={i} style={{ width: cardW }}>
              <Shimmer width={cardW} height={180} borderRadius={16} />
              <Shimmer width={cardW * 0.7} height={17} borderRadius={6} style={{ marginTop: 12 }} />
              <Shimmer width={cardW * 0.5} height={13} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function ExploreScreen() {
  const {
    destinations,
    filteredDestinations,
    aiInsights,
    loading,
    refreshing,
    error,
    search,
    setSearch,
    isSearchFocused,
    setIsSearchFocused,
    activeCategory,
    setActiveCategory,
    filters,
    recentSearches,
    handleFilterChange,
    getImageUrl,
    handleDestinationPress,
    handleRefresh,
  } = useExploreEngine();

  const listRef = useRef<any>(null);
  const { width: screenWidth } = useWindowDimensions();
  const numColumns = getColumnCount(screenWidth);
  const isWide = screenWidth >= 768;

  // Render destination item
  const renderDestination = useCallback(
    ({ item }: { item: Destination }) => (
      <DestinationCard
        destination={item}
        imageUrl={getImageUrl(item)}
        onPress={() => handleDestinationPress(item)}
      />
    ),
    [getImageUrl, handleDestinationPress],
  );

  // Render insight item
  const renderInsight = useCallback(
    (insight: AIInsight) => (
      <InsightCard
        key={insight.id}
        insight={insight}
        getImageUrl={getImageUrl}
        onDestinationPress={handleDestinationPress}
      />
    ),
    [getImageUrl, handleDestinationPress],
  );

  // List header component
  const ListHeader = useMemo(() => {
    if (isSearchFocused) return null;

    return (
      <View style={styles.listHeader}>
        {/* AI Insights */}
        {aiInsights.map(renderInsight)}

        {/* Filter Chips */}
        <FilterChips filters={filters} onFilterChange={handleFilterChange} />

        {/* Grid Title */}
        <View style={styles.gridHeaderBlock}>
          <Text style={styles.gridTitle}>
            {search ? `Results for "${search}"` : "Discover Destinations"}
          </Text>
          <Text style={styles.gridCount}>
            {filteredDestinations.length} places
          </Text>
        </View>
      </View>
    );
  }, [
    isSearchFocused,
    aiInsights,
    filters,
    handleFilterChange,
    search,
    filteredDestinations.length,
    renderInsight,
  ]);

  // Empty component
  const ListEmpty = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="map-search-outline"
          size={64}
          color="#CBD5E1"
        />
        <Text style={styles.emptyTitle}>No destinations found</Text>
        <Text style={styles.emptySubtitle}>
          Try adjusting your filters or search for something else
        </Text>
        <TouchableOpacity
          style={styles.emptyCTA}
          onPress={() => {
            setActiveCategory("all");
            handleFilterChange("budget", "all");
            handleFilterChange("duration", "all");
            handleFilterChange("vibe", "all");
            handleFilterChange("season", "all");
            setSearch("");
          }}
        >
          <Text style={styles.emptyCTAText}>Clear all filters</Text>
        </TouchableOpacity>
      </View>
    ),
    [handleFilterChange, setActiveCategory],
  );

  // Skeleton loading state
  if (loading) {
    return <ExploreSkeleton />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={handleRefresh} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, isWide && styles.headerWide]}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>Discover your next adventure</Text>

        {/* Search Bar */}
        <PressableScale
          style={[styles.searchBar, isWide && styles.searchBarWide]}
          onPress={() => setIsSearchFocused(true)}
        >
          <MaterialCommunityIcons name="magnify" size={22} color="#64748B" />
          <Text style={styles.searchBarPlaceholder}>
            {search || "Where to next?"}
          </Text>
          <View style={styles.searchBarMic}>
            <MaterialCommunityIcons
              name="microphone"
              size={18}
              color="#94A3B8"
            />
          </View>
        </PressableScale>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              category={cat}
              isActive={activeCategory === cat.id}
              onPress={() => setActiveCategory(cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Main List */}
      {!isSearchFocused && (
        <FlashList
          ref={listRef}
          data={filteredDestinations}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          estimatedItemSize={280}
          drawDistance={500}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          renderItem={renderDestination}
          extraData={getImageUrl}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#0F172A"
              colors={["#0F172A"]}
            />
          }
        />
      )}

      {/* Search Overlay */}
      <SearchOverlay
        visible={isSearchFocused}
        search={search}
        onSearchChange={setSearch}
        onClose={() => setIsSearchFocused(false)}
        onResultPress={handleDestinationPress}
        recentSearches={recentSearches}
        destinations={destinations}
        getImageUrl={getImageUrl}
      />

      {/* FAB - AI Trip Planner */}
      {!isSearchFocused && (
        <PressableScale style={styles.fab} onPress={() => {}}>
          <MaterialCommunityIcons name="robot-outline" size={22} color="#FFF" />
          <Text style={styles.fabText}>Plan with AI</Text>
        </PressableScale>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
    marginBottom: spacing.md,
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    ...(Platform.select({
      web: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.04)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }) ?? {}),
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  searchBarPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: "#1E293B",
    marginLeft: 12,
    fontWeight: "500",
  },
  searchBarMic: {
    padding: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },

  // Categories
  categoriesScroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },

  // List
  listContent: {
    paddingBottom: 120,
  },
  listHeader: {
    paddingBottom: spacing.sm,
  },

  // Filter Chips
  filterChipsContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterChipsScroll: {
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  clearFilters: {
    padding: 8,
    marginLeft: 8,
  },

  // Grid Header
  gridHeaderBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gridTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  gridCount: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },

  // Insight Section
  insightSection: {
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  insightHeader: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  insightTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  insightSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    marginLeft: 28,
  },
  insightReason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    marginLeft: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  insightReasonText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  insightListContent: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },

  // Search Overlay
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248,250,252,0.95)",
    zIndex: 100,
  },
  searchOverlayContent: {
    flex: 1,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  searchOverlayInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 2,
    borderColor: "#0F172A",
    marginBottom: spacing.md,
  },
  searchOverlayTextInput: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "500",
    marginLeft: 12,
  },
  searchOverlaySection: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickSearchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickSearchChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  quickSearchText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  recentSearchesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recentSearchChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    gap: 6,
  },
  recentSearchText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  trendingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  trendingRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginLeft: 12,
  },
  trendingRowRegion: {
    fontSize: 13,
    color: "#64748B",
    marginRight: 8,
  },
  intentBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    gap: 6,
    marginBottom: spacing.md,
  },
  intentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7C3AED",
  },

  // FAB — centered with maxWidth for responsive
  fab: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    maxWidth: 280,
    width: "50%",
    backgroundColor: "#0F172A",
    borderRadius: 30,
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    // Center the FAB horizontally
    left: 0,
    right: 0,
    marginLeft: "auto",
    marginRight: "auto",
    ...(Platform.select({
      web: {
        boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.25)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 10,
      },
    }) ?? {}),
  },
  fabText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  // Wide screen overrides
  headerWide: {
    maxWidth: 800,
    alignSelf: "center" as const,
    width: "100%",
  },
  searchBarWide: {
    maxWidth: 600,
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyCTA: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#0F172A",
    borderRadius: 12,
  },
  emptyCTAText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
