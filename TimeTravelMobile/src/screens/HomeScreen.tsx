/**
 * HomeScreen V5 – AI Travel Command Center
 * Billion-dollar startup-level product competing with Airbnb, Google Travel, MakeMyTrip
 *
 * Features:
 * - FlashList for 60fps smooth scrolling
 * - AI-powered personalized recommendations
 * - Animated hero with premium UI
 * - Today's Travel Insight card
 * - Smart quick actions
 * - Promotional banners (monetization ready)
 * - Skeleton loading states
 * - Offline-first architecture
 * - Haptic feedback micro-interactions
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
  RefreshControl,
  ScrollView,
  Image,
  TextInput,
  useWindowDimensions,
  StatusBar,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import ReAnimated, { FadeInDown, FadeInRight } from "react-native-reanimated";

import KeyboardAvoidingWrapper from "@/components/Common/KeyboardAvoidingWrapper";
import ErrorMessage from "@/components/Common/ErrorMessage";
import DestinationCard from "@/components/Features/DestinationCard";
import {
  useDestinations,
  useFeaturedDestinations,
  useTrendingDestinations,
} from "@/api/queries/useDestinations";
import { useRecommendations } from "@/api/queries/useRecommendations";
import { destinationsService } from "@/services/destinations";
import { weatherService } from "@/services/weather";
import { Shimmer } from "@/components/UI/SkeletonLoader";
import { Destination } from "@/types";
import { RootStackParamList } from "@/navigation/types";
import type { WeatherData } from "@/types";
import { colors, spacing } from "@/theme/colors";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { useAuthStore } from "@/stores/authStore";
import { usePreferenceStore } from "@/stores/preferenceStore";
import { PressableScale } from "@/components/UI/PressableScale";
import { GlassCard } from "@/components/UI/GlassCard";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const SMART_FILTERS = [
  { label: "For You", category: "personalized", icon: "star-four-points" },
  { label: "Budget", category: "budget", icon: "currency-inr" },
  { label: "Weekend", category: "weekend", icon: "calendar-weekend" },
  { label: "Adventure", category: "adventure", icon: "hiking" },
  { label: "Culture", category: "heritage", icon: "temple-buddhist" },
  { label: "Beaches", category: "beach", icon: "beach" },
  { label: "Nature", category: "nature", icon: "leaf" },
] as const;

const QUICK_ACTIONS = [
  {
    id: "plan",
    icon: "robot-outline",
    label: "AI Planner",
    gradient: ["#8B5CF6", "#6366F1"],
    route: "Itinerary",
  },
  {
    id: "trips",
    icon: "map-marker-path",
    label: "My Trips",
    gradient: ["#0EA5E9", "#06B6D4"],
    route: "Trips",
  },
  {
    id: "budget",
    icon: "wallet-outline",
    label: "Budget",
    gradient: ["#10B981", "#059669"],
    route: "Budget",
  },
  {
    id: "explore",
    icon: "compass-outline",
    label: "Explore",
    gradient: ["#F59E0B", "#D97706"],
    route: "Explore",
  },
] as const;

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

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 5) return "Night Owl";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Night Owl";
};

const getTravelInsight = (season: string, destinations: Destination[]) => {
  const insights = [
    {
      type: "tip" as const,
      title: `${season.charAt(0).toUpperCase() + season.slice(1)} Travel Tip`,
      description:
        season === "summer"
          ? "Hill stations like Manali and Munnar offer cool escapes"
          : season === "monsoon"
            ? "Kerala backwaters and Coorg are magical during rains"
            : "Goa beaches and Rajasthan deserts are at their best",
      icon:
        season === "summer"
          ? "white-balance-sunny"
          : season === "monsoon"
            ? "weather-rainy"
            : "weather-snowy",
      cta: "Explore",
    },
    {
      type: "trend" as const,
      title: "Trending Now",
      description: `${destinations[0]?.label || "Goa"} is the most searched this week`,
      icon: "trending-up",
      cta: "View",
    },
  ];
  return insights[Math.floor(Date.now() / 3600000) % insights.length];
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface QuickActionsRowProps {
  actions: typeof QUICK_ACTIONS;
  onPress: (action: (typeof QUICK_ACTIONS)[number]) => void;
}

const QuickActionsRow = memo(({ actions, onPress }: QuickActionsRowProps) => (
  <View style={styles.quickActionsContainer}>
    {actions.map((action) => (
      <PressableScale
        key={action.id}
        style={styles.quickActionCard}
        onPress={() => onPress(action)}
      >
        <LinearGradient
          colors={action.gradient as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quickActionGradient}
        >
          <MaterialCommunityIcons
            name={action.icon as any}
            size={24}
            color="#FFF"
          />
        </LinearGradient>
        <Text style={styles.quickActionLabel}>{action.label}</Text>
      </PressableScale>
    ))}
  </View>
));
QuickActionsRow.displayName = "QuickActionsRow";

// ─────────────────────────────────────────────────────────────

interface TravelInsightCardProps {
  insight: ReturnType<typeof getTravelInsight>;
  onPress: () => void;
}

const TravelInsightCard = memo(
  ({ insight, onPress }: TravelInsightCardProps) => {
    const bgColor = insight.type === "tip" ? "#EEF2FF" : "#FEF3C7";
    const iconColor = insight.type === "tip" ? "#4F46E5" : "#D97706";

    return (
      <PressableScale
        style={[styles.insightCard, { backgroundColor: bgColor }]}
        onPress={onPress}
      >
        <View
          style={[styles.insightIcon, { backgroundColor: `${iconColor}20` }]}
        >
          <MaterialCommunityIcons
            name={insight.icon as any}
            size={20}
            color={iconColor}
          />
        </View>
        <View style={styles.insightContent}>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <Text style={styles.insightDesc} numberOfLines={2}>
            {insight.description}
          </Text>
        </View>
        {insight.cta && (
          <View style={styles.insightCTA}>
            <Text style={[styles.insightCTAText, { color: iconColor }]}>
              {insight.cta}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={iconColor}
            />
          </View>
        )}
      </PressableScale>
    );
  },
);
TravelInsightCard.displayName = "TravelInsightCard";

// ─────────────────────────────────────────────────────────────

interface LiveTripCardProps {
  trip: any;
  weather: WeatherData | null;
  daysUntil: number | null;
  getImageUrl: (dest: Destination) => string | undefined;
  onPress: () => void;
}

const LiveTripCard = memo(
  ({ trip, weather, daysUntil, getImageUrl, onPress }: LiveTripCardProps) => {
    if (!trip) return null;
    const dest = trip.destination;
    const statusText = trip.status === "ongoing" ? "LIVE NOW" : "UPCOMING";
    const countdownText =
      daysUntil !== null && daysUntil > 0
        ? `${daysUntil} day${daysUntil !== 1 ? "s" : ""} away`
        : daysUntil === 0
          ? "Starts today!"
          : `${trip.days}-day trip`;

    return (
      <PressableScale style={styles.liveTripCard} onPress={onPress}>
        <Image
          source={{
            uri:
              dest?.imageUrl ||
              dest?.image ||
              getImageUrl(dest) ||
              "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2",
          }}
          style={styles.liveTripImage}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={styles.liveTripOverlay}
        >
          <View style={styles.liveTripHeader}>
            <View style={styles.liveBadge}>
              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor:
                      trip.status === "ongoing" ? "#22C55E" : "#F59E0B",
                  },
                ]}
              />
              <Text style={styles.liveBadgeText}>{statusText}</Text>
            </View>
            {weather && (
              <View style={styles.weatherBadge}>
                <MaterialCommunityIcons
                  name="weather-partly-cloudy"
                  size={14}
                  color="#FFF"
                />
                <Text style={styles.weatherText}>
                  {weather.temperature_c}°C
                </Text>
              </View>
            )}
          </View>
          <View style={styles.liveTripInfo}>
            <Text style={styles.liveTripDest}>{dest?.label}</Text>
            <Text style={styles.liveTripMeta}>
              {countdownText} • Budget on track
            </Text>
          </View>
          <View style={styles.resumeBtn}>
            <MaterialCommunityIcons
              name="arrow-right"
              size={20}
              color="#0F172A"
            />
          </View>
        </LinearGradient>
      </PressableScale>
    );
  },
);
LiveTripCard.displayName = "LiveTripCard";

// ─────────────────────────────────────────────────────────────

interface FilterChipsRowProps {
  activeFilter: string | null;
  onPress: (category: string) => void;
}

const FilterChipsRow = memo(
  ({ activeFilter, onPress }: FilterChipsRowProps) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterChipsScroll}
    >
      {SMART_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.category;
        return (
          <PressableScale
            key={filter.category}
            style={[styles.filterChip, isActive && styles.filterChipActive]}
            onPress={() => onPress(filter.category)}
          >
            <MaterialCommunityIcons
              name={filter.icon as any}
              size={14}
              color={isActive ? "#FFF" : "#64748B"}
            />
            <Text
              style={[
                styles.filterChipText,
                isActive && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  ),
);
FilterChipsRow.displayName = "FilterChipsRow";

// ─────────────────────────────────────────────────────────────

interface CarouselSectionProps {
  title: string;
  subtitle: string;
  data: Destination[];
  getImageUrl: (dest: Destination) => string | undefined;
  onItemPress: (dest: Destination) => void;
  onSeeAll?: () => void;
  matchPercentage?: number;
  icon: string;
}

const CarouselSection = memo(
  ({
    title,
    subtitle,
    data,
    getImageUrl,
    onItemPress,
    onSeeAll,
    matchPercentage,
    icon,
  }: CarouselSectionProps) => {
    if (data.length === 0) return null;

    return (
      <ReAnimated.View entering={FadeInDown.duration(400).delay(100)} style={styles.carouselSection}>
        <View style={styles.carouselHeader}>
          <View style={styles.carouselTitleRow}>
            <MaterialCommunityIcons
              name={icon as any}
              size={20}
              color="#667EEA"
            />
            <View>
              <Text style={styles.carouselTitle}>{title}</Text>
              <Text style={styles.carouselSubtitle}>
                {subtitle}
                {matchPercentage && (
                  <Text style={styles.matchText}>
                    {" "}
                    • {matchPercentage}% match
                  </Text>
                )}
              </Text>
            </View>
          </View>
          {onSeeAll && (
            <TouchableOpacity style={styles.seeAllBtn} onPress={onSeeAll}>
              <Text style={styles.seeAllText}>See All</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color="#667EEA"
              />
            </TouchableOpacity>
          )}
        </View>
        <FlashList
          horizontal
          data={data}
          keyExtractor={(item: Destination) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselList}
          drawDistance={300}
          renderItem={({ item }: { item: Destination }) => (
            <DestinationCard
              destination={item}
              imageUrl={getImageUrl(item)}
              onPress={() => onItemPress(item)}
              horizontal
            />
          )}
        />
      </ReAnimated.View>
    );
  },
);
CarouselSection.displayName = "CarouselSection";

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// SKELETON LOADING STATE
// ─────────────────────────────────────────────────────────────

const HomeSkeleton = memo(() => {
  const { width: screenWidth } = useWindowDimensions();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      {/* Hero skeleton */}
      <View style={[styles.heroGradient, { backgroundColor: "#1E293B" }]}>
        <View style={styles.headerRow}>
          <View style={styles.greetingBlock}>
            <Shimmer width={120} height={16} borderRadius={8} />
            <Shimmer width={180} height={28} borderRadius={8} style={{ marginTop: 8 }} />
            <Shimmer width={200} height={14} borderRadius={8} style={{ marginTop: 6 }} />
          </View>
          <Shimmer width={52} height={52} borderRadius={26} />
        </View>
        <Shimmer width="100%" height={56} borderRadius={16} style={{ marginTop: 8 }} />
      </View>

      {/* Quick actions skeleton */}
      <View style={[styles.quickActionsContainer, { marginTop: spacing.lg }]}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: "center", width: 72 }}>
            <Shimmer width={52} height={52} borderRadius={16} />
            <Shimmer width={48} height={10} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>

      {/* Insight skeleton */}
      <Shimmer width={screenWidth - spacing.lg * 2} height={64} borderRadius={16} style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }} />

      {/* Carousel skeleton */}
      <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
        <Shimmer width={160} height={20} borderRadius={8} />
        <Shimmer width={200} height={14} borderRadius={8} style={{ marginTop: 4 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: spacing.lg, paddingTop: 12, gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <Shimmer key={i} width={260} height={200} borderRadius={16} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
});
HomeSkeleton.displayName = "HomeSkeleton";

// ─────────────────────────────────────────────────────────────
// IMAGE CACHE HOOK (React Query)
// ─────────────────────────────────────────────────────────────

const useDestinationImages = (enabled: boolean) => {
  return useQuery({
    queryKey: ["destination-images", "all"],
    queryFn: () => destinationsService.getAllDestinationImages(),
    staleTime: 30 * 60 * 1000, // 30 min — images don't change often
    gcTime: 60 * 60 * 1000,
    enabled,
    retry: 2,
  });
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 768;
  const user = useAuthStore((s) => s.user);
  const { logSearch, activeTrip } = useTravelIntelligence();
  const userPreferences = useTravelIntelligence((s) => s.userPreferences);
  const setDestinationFilter = usePreferenceStore(
    (s) => s.setDestinationFilter,
  );

  const {
    data: destinationsData,
    isLoading,
    error,
    refetch,
  } = useDestinations();
  const { data: featuredDestinations } = useFeaturedDestinations();
  const { data: trendingDestinations } = useTrendingDestinations();

  const recommendationParams = useMemo(() => {
    const groupSizeMap: Record<string, number> = {
      solo: 1,
      couple: 2,
      family: 4,
      friends: 4,
    };
    return {
      season: userPreferences.preferredSeason,
      trip_duration: activeTrip?.days,
      group_size: groupSizeMap[userPreferences.groupType] ?? 2,
      limit: 10,
    };
  }, [userPreferences, activeTrip]);

  const {
    data: recsData,
    isLoading: recsLoading,
  } = useRecommendations(recommendationParams, { enabled: !!user });

  const [refreshing, setRefreshing] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [tripWeather, setTripWeather] = useState<WeatherData | null>(null);

  const destinations = useMemo(
    () => destinationsData?.destinations || [],
    [destinationsData],
  );

  // Images via React Query — cached, retried, deduplicated
  const { data: images = {} } = useDestinationImages(destinations.length > 0);

  useEffect(() => {
    if (activeTrip?.destination?.label) {
      weatherService
        .getWeather(activeTrip.destination.label)
        .then(setTripWeather)
        .catch(() => setTripWeather(null));
    } else {
      setTripWeather(null);
    }
  }, [activeTrip?.destination?.label]);

  const getImageUrl = useCallback(
    (dest: Destination): string | undefined => {
      const img = images[dest.id];
      return img?.url_small || img?.url_thumb || img?.url_regular;
    },
    [images],
  );

  const daysUntilTrip = useMemo(() => {
    if (!activeTrip?.startDate) return null;
    const start = new Date(activeTrip.startDate).getTime();
    const diff = Math.ceil((start - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [activeTrip?.startDate]);

  const apiRecommended = useMemo(() => {
    const recs = recsData?.recommendations || [];
    return recs.map((r) => {
      const match = destinations.find(
        (d) => d.label.toLowerCase() === r.name.toLowerCase(),
      );
      return {
        id: match?.id || r.id,
        label: r.name,
        region: r.region || r.country,
        best_season: "",
        highlight: r.tags?.[0] || "",
        tagline: r.explanations?.[0] || "",
        category: r.categories || [],
        lat: match?.lat || 0,
        lon: match?.lon || 0,
        rating: r.rating || match?.rating,
        imageUrl: match?.imageUrl,
      } as Destination;
    });
  }, [recsData, destinations]);

  const recMatchPercentage = useMemo(() => {
    const scores = (recsData?.recommendations || [])
      .slice(0, 6)
      .map((r) => r.score);
    if (scores.length === 0) return undefined;
    return Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length,
    );
  }, [recsData]);

  const recommended = useMemo(() => {
    const data =
      apiRecommended.length > 0
        ? apiRecommended
        : featuredDestinations || destinations;
    if (!activeFilter) return data.slice(0, 6);
    return data
      .filter((d) => {
        const destStr =
          `${d.label} ${d.region} ${(d.category || []).join(" ")}`.toLowerCase();
        return destStr.includes(activeFilter);
      })
      .slice(0, 6);
  }, [apiRecommended, featuredDestinations, destinations, activeFilter]);

  const trending = useMemo(
    () => (trendingDestinations || destinations).slice(0, 6),
    [trendingDestinations, destinations],
  );

  const budgetPicks = useMemo(() => {
    const budgetKeywords = ["budget", "affordable", "backpacker", "offbeat"];
    return destinations
      .filter(
        (d) =>
          d.category?.some((c) =>
            budgetKeywords.some((kw) => c.toLowerCase().includes(kw)),
          ),
      )
      .slice(0, 6);
  }, [destinations]);

  const travelInsight = useMemo(
    () => getTravelInsight(CURRENT_SEASON, destinations),
    [destinations],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAiSubmit = useCallback(() => {
    if (aiQuery.trim()) {
      logSearch(aiQuery);
      navigation.navigate("Itinerary", { query: aiQuery });
    }
  }, [aiQuery, logSearch, navigation]);

  const handleFilterPress = useCallback(
    (category: string) => {
      setActiveFilter(activeFilter === category ? null : category);
      setDestinationFilter({
        category: activeFilter === category ? null : category,
      });
    },
    [activeFilter, setDestinationFilter],
  );

  const handleDestinationPress = useCallback(
    (dest: Destination) => {
      navigation.navigate("DestinationDetail", { destination: dest });
    },
    [navigation],
  );

  const handleQuickAction = useCallback(
    (action: (typeof QUICK_ACTIONS)[number]) => {
      navigation.navigate("MainTabs", { screen: action.route as any, params: {} });
    },
    [navigation],
  );

  // Navigation helpers for "See All" buttons
  const handleSeeAllRecommended = useCallback(() => {
    navigation.navigate("MainTabs", {
      screen: "ExploreTab",
      params: { filter: activeFilter || "featured" },
    });
  }, [navigation, activeFilter]);

  const handleSeeAllTrending = useCallback(() => {
    navigation.navigate("MainTabs", {
      screen: "ExploreTab",
      params: { filter: "trending" },
    });
  }, [navigation]);

  const handleSeeAllBudget = useCallback(() => {
    navigation.navigate("MainTabs", {
      screen: "ExploreTab",
      params: { filter: "budget" },
    });
  }, [navigation]);

  const handleInsightPress = useCallback(() => {
    if (travelInsight.type === "tip") {
      navigation.navigate("MainTabs", {
        screen: "ExploreTab",
        params: { season: CURRENT_SEASON },
      });
    } else if (destinations.length > 0) {
      handleDestinationPress(destinations[0]);
    }
  }, [travelInsight, destinations, navigation, handleDestinationPress]);

  if (isLoading) return <HomeSkeleton />;
  if (error)
    return (
      <ErrorMessage
        message={(error as Error).message}
        onRetry={handleRefresh}
      />
    );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingWrapper scrollable={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#667EEA"
            />
          }
        >
        {/* Hero Section */}
        <LinearGradient
          colors={["#0F172A", "#1E293B", "#334155"]}
          locations={[0, 0.6, 1]}
          style={styles.heroGradient}
        >
          <View style={styles.heroGlow} />
          <View style={styles.headerRow}>
            <View style={styles.greetingBlock}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.userName}>
                {user?.name?.split(" ")[0] || "Traveler"}
              </Text>
              <Text style={styles.subtitle}>
                Your AI travel companion awaits
              </Text>
            </View>
            <PressableScale
              onPress={() =>
                navigation.navigate("MainTabs", { screen: "ProfileTab" })
              }
              style={styles.avatarContainer}
              accessibilityLabel="Profile settings"
              accessibilityRole="button"
            >
              <Image
                source={{
                  uri:
                    user?.avatar_url ||
                    user?.avatar ||
                    `https://i.pravatar.cc/150?u=${user?.email || "guest"}`,
                }}
                style={styles.avatar}
              />
              <View style={styles.avatarBadge}>
                <MaterialCommunityIcons name="crown" size={10} color="#FFF" />
              </View>
            </PressableScale>
          </View>

          <GlassCard intensity={30} tint="light" style={styles.aiSearchCard}>
            <View style={styles.aiSearchRow}>
              <View style={styles.aiSearchIconWrap}>
                <MaterialCommunityIcons
                  name="robot-outline"
                  size={22}
                  color="#667EEA"
                />
              </View>
              <TextInput
                style={styles.aiSearchInput}
                placeholder="Where do you want to escape to?"
                placeholderTextColor="#94A3B8"
                value={aiQuery}
                onChangeText={setAiQuery}
                onSubmitEditing={handleAiSubmit}
                returnKeyType="go"
                accessibilityLabel="Search destinations"
                accessibilityHint="Type a destination or travel idea and press go"
              />
              {aiQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setAiQuery("")}
                  style={styles.clearBtn}
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              )}
              <PressableScale style={styles.aiGoBtn} onPress={handleAiSubmit} accessibilityLabel="Search" accessibilityRole="button">
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={20}
                  color="#FFF"
                />
              </PressableScale>
            </View>
            <View style={styles.quickPromptsRow}>
              {["Beach getaway", "Mountain trek", "Weekend trip"].map(
                (prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.quickPromptChip}
                    onPress={() => setAiQuery(prompt)}
                    accessibilityLabel={`Quick search: ${prompt}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.quickPromptText}>{prompt}</Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          </GlassCard>
        </LinearGradient>

        {/* Main Content */}
        <View style={[styles.mainContent, isWide && styles.mainContentWide]}>
          <QuickActionsRow
            actions={QUICK_ACTIONS}
            onPress={handleQuickAction}
          />
          {activeTrip && (
            <LiveTripCard
              trip={activeTrip}
              weather={tripWeather}
              daysUntil={daysUntilTrip}
              getImageUrl={getImageUrl}
              onPress={() =>
                navigation.navigate("MainTabs", { screen: "TripsTab" })
              }
            />
          )}
          <TravelInsightCard insight={travelInsight} onPress={handleInsightPress} />
          <FilterChipsRow
            activeFilter={activeFilter}
            onPress={handleFilterPress}
          />
          <CarouselSection
            title="Recommended for You"
            subtitle="Based on your preferences"
            data={recommended}
            getImageUrl={getImageUrl}
            onItemPress={handleDestinationPress}
            onSeeAll={handleSeeAllRecommended}
            matchPercentage={recMatchPercentage}
            icon="star-four-points"
          />
          {recsLoading && !recsData && (
            <View style={styles.recsSkeletonRow}>
              {[1, 2, 3].map((i) => (
                <Shimmer key={i} width={260} height={200} borderRadius={16} />
              ))}
            </View>
          )}
          <CarouselSection
            title="Trending Now"
            subtitle="Most popular this season"
            data={trending}
            getImageUrl={getImageUrl}
            onItemPress={handleDestinationPress}
            onSeeAll={handleSeeAllTrending}
            icon="fire"
          />

          {/* Promo Banner */}
          <PressableScale
            style={styles.promoBanner}
            onPress={() => navigation.navigate("Itinerary", {})}
          >
            <LinearGradient
              colors={["#667EEA", "#764BA2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.promoGradient}
            >
              <View style={styles.promoContent}>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>PRO</Text>
                </View>
                <Text style={styles.promoTitle}>Unlock AI Travel Pro</Text>
                <Text style={styles.promoSubtitle}>
                  Unlimited itineraries & exclusive deals
                </Text>
              </View>
              <View style={styles.promoCTA}>
                <Text style={styles.promoCTAText}>Try Free</Text>
              </View>
            </LinearGradient>
          </PressableScale>

          <CarouselSection
            title="Budget-Friendly"
            subtitle="Great value under ₹10,000"
            data={budgetPicks}
            getImageUrl={getImageUrl}
            onItemPress={handleDestinationPress}
            onSeeAll={handleSeeAllBudget}
            icon="currency-inr"
          />
        </View>
        </ScrollView>
      </KeyboardAvoidingWrapper>

      {/* FAB */}
      <PressableScale
        style={styles.fab}
        onPress={() => navigation.navigate("Itinerary", {})}
      >
        <LinearGradient
          colors={["#667EEA", "#764BA2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <MaterialCommunityIcons name="robot-outline" size={22} color="#FFF" />
          <Text style={styles.fabText}>Plan with AI</Text>
        </LinearGradient>
      </PressableScale>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { paddingBottom: 120 },

  // Hero
  heroGradient: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroGlow: {
    position: "absolute",
    top: -100,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(102,126,234,0.3)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  greetingBlock: { flex: 1 },
  greeting: { fontSize: 16, color: "rgba(255,255,255,0.7)", fontWeight: "500" },
  userName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  avatarContainer: { position: "relative" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0F172A",
  },

  // AI Search
  aiSearchCard: { borderRadius: 20, padding: 4, overflow: "hidden" },
  aiSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 56,
  },
  aiSearchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  aiSearchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#0F172A",
    paddingVertical: 0,
  },
  clearBtn: { padding: 4 },
  aiGoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  quickPromptsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  quickPromptChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(102,126,234,0.1)",
    borderRadius: 12,
  },
  quickPromptText: { fontSize: 12, fontWeight: "600", color: "#667EEA" },

  // Quick Actions
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  quickActionCard: { alignItems: "center", width: 72 },
  quickActionGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    ...(Platform.select({
      web: {
        boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.15)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    }) ?? {}),
  },
  quickActionLabel: { fontSize: 11, fontWeight: "600", color: "#475569" },

  // Live Trip
  liveTripCard: {
    marginHorizontal: spacing.lg,
    height: 180,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  liveTripImage: { width: "100%", height: "100%" },
  liveTripOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing.md,
    justifyContent: "space-between",
  },
  liveTripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  weatherBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  weatherText: { fontSize: 12, fontWeight: "600", color: "#FFF" },
  liveTripInfo: { flex: 1, justifyContent: "flex-end" },
  liveTripDest: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: -0.5,
  },
  liveTripMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    marginTop: 2,
  },
  resumeBtn: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },

  // Insight Card
  insightCard: {
    marginHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  insightDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
  insightCTA: { flexDirection: "row", alignItems: "center" },
  insightCTAText: { fontSize: 12, fontWeight: "600" },

  // Filter Chips
  filterChipsScroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FFF",
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  filterChipTextActive: { color: "#FFF" },

  // Carousel
  carouselSection: { marginBottom: spacing.lg },
  recsSkeletonRow: {
    flexDirection: "row",
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  carouselHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  carouselTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  carouselTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  carouselSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  matchText: { color: "#10B981", fontWeight: "600" },
  seeAllBtn: { flexDirection: "row", alignItems: "center" },
  seeAllText: { fontSize: 13, fontWeight: "600", color: "#667EEA" },
  carouselList: { paddingLeft: spacing.lg, paddingRight: spacing.sm },

  // Promo
  promoBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: 20,
    overflow: "hidden",
  },
  promoGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  promoContent: { flex: 1 },
  promoBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    marginBottom: 6,
  },
  promoBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  promoTitle: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  promoSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  promoCTA: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  promoCTAText: { fontSize: 13, fontWeight: "700", color: "#667EEA" },

  mainContent: { paddingTop: spacing.lg },
  mainContentWide: { maxWidth: 800, alignSelf: "center" as const, width: "100%" as any },

  // FAB
  fab: {
    position: "absolute" as const,
    bottom: 24,
    alignSelf: "center" as const,
    width: "60%" as any,
    maxWidth: 280,
    height: 56,
    borderRadius: 28,
    overflow: "hidden" as const,
    // Center the FAB horizontally
    left: 0,
    right: 0,
    marginLeft: "auto" as any,
    marginRight: "auto" as any,
    ...(Platform.select({
      web: {
        boxShadow: "0px 8px 16px rgba(102, 126, 234, 0.4)",
      } as any,
      default: {
        shadowColor: "#667EEA",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
      },
    }) ?? {}),
  },
  fabGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  fabText: { fontSize: 16, fontWeight: "800", color: "#FFF" },
});
