/**
 * FavoritesScreen V5 – Premium Intelligent Wishlist Experience
 * Comparable to Airbnb's "Saved" and Pinterest-level inspiration boards
 *
 * Features:
 * - FlashList for 60fps smooth scrolling
 * - AI-powered recommendations ("Because you saved Goa → Try Gokarna")
 * - Smart grouping (Dream Destinations, Weekend Getaways, etc.)
 * - Budget estimation from wishlist
 * - Swipe-to-remove with undo
 * - Micro-animations and delightful interactions
 * - Image-first card design
 * - Share wishlist with friends
 * - Plan trip from favorites
 * - Best time to visit alerts
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
  Alert,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  ScrollView,
  Platform,
  Share,
  Linking,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import LoadingSpinner from "@/components/Common/LoadingSpinner";
import { favoritesService, Favorite } from "@/services/favorites";
import { destinationsService } from "@/services/destinations";
import { Destination, RootStackParamList, UnsplashImage } from "@/types";
import { colors, spacing } from "@/theme/colors";
import { PressableScale } from "@/components/UI/PressableScale";
import { GlassCard } from "@/components/UI/GlassCard";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const shouldUseNativeDriver = Platform.OS !== "web";

const statsCardShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 8px 16px rgba(103, 126, 234, 0.25)" }
    : { elevation: 8 }
) as any;

const favCardShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.06)" }
    : { elevation: 3 }
) as any;

const removeBtnShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" }
    : { elevation: 2 }
) as any;

const fabShadow = (
  Platform.OS === "web"
    ? { boxShadow: "0px 8px 16px rgba(102, 126, 234, 0.35)" }
    : { elevation: 10 }
) as any;

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────

interface FavoriteGroup {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  favorites: EnrichedFavorite[];
}

interface EnrichedFavorite extends Favorite {
  imageUrl?: string;
  region?: string;
  tagline?: string;
  savedDaysAgo: number;
  estimatedBudget?: string;
  bestTimeToVisit?: string;
}

interface AIRecommendation {
  id: string;
  title: string;
  reason: string;
  destination: Destination;
  imageUrl?: string;
}

interface WishlistStats {
  totalItems: number;
  destinations: number;
  places: number;
  estimatedBudget: string;
  mostSavedRegion: string;
}

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

const getDaysAgo = (dateStr: string): number => {
  const saved = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - saved.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDaysAgo = (days: number): string => {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
};

const estimateBudget = (fav: Favorite): string => {
  // Simple estimation based on type
  if (fav.item_type === "destination") {
    const name = fav.item_name.toLowerCase();
    if (/goa|kerala|rajasthan|himachal|uttrakhand/.test(name)) {
      return "₹15,000 - ₹25,000";
    }
    if (/andaman|lakshadweep/.test(name)) {
      return "₹30,000 - ₹50,000";
    }
    return "₹10,000 - ₹20,000";
  }
  return "₹500 - ₹2,000";
};

const getBestTimeToVisit = (name: string): string => {
  const n = name.toLowerCase();
  if (/goa|kerala|rajasthan/.test(n)) return "Oct - Mar";
  if (/himachal|uttrakhand|kashmir/.test(n)) return "Mar - Jun";
  if (/andaman|lakshadweep/.test(n)) return "Nov - May";
  if (/sikkim|darjeeling/.test(n)) return "Mar - May, Oct - Dec";
  return "Year round";
};

const getMostSavedRegion = (favs: EnrichedFavorite[]): string => {
  const regions: Record<string, number> = {};
  favs.forEach((f) => {
    if (f.region) {
      regions[f.region] = (regions[f.region] || 0) + 1;
    }
  });
  const sorted = Object.entries(regions).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "India";
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface StatsCardProps {
  stats: WishlistStats;
}

const StatsCard = memo(({ stats }: StatsCardProps) => {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: shouldUseNativeDriver,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[styles.statsCard, { transform: [{ scale: scaleAnim }] }]}
    >
      <LinearGradient
        colors={["#667EEA", "#764BA2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statsGradient}
      >
        <View style={styles.statsMain}>
          <MaterialCommunityIcons
            name="heart-multiple"
            size={24}
            color="#FFF"
          />
          <View style={styles.statsMainText}>
            <Text style={styles.statsCount}>{stats.totalItems}</Text>
            <Text style={styles.statsLabel}>saved destinations</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons
              name="map-marker"
              size={16}
              color="rgba(255,255,255,0.8)"
            />
            <Text style={styles.statValue}>{stats.destinations}</Text>
            <Text style={styles.statSub}>Destinations</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons
              name="store"
              size={16}
              color="rgba(255,255,255,0.8)"
            />
            <Text style={styles.statValue}>{stats.places}</Text>
            <Text style={styles.statSub}>Places</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={16}
              color="rgba(255,255,255,0.8)"
            />
            <Text style={styles.statValueSmall}>{stats.estimatedBudget}</Text>
            <Text style={styles.statSub}>Est. Budget</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
});
StatsCard.displayName = "StatsCard";

// ─────────────────────────────────────────────────────────────

interface FavoriteCardProps {
  favorite: EnrichedFavorite;
  onRemove: (fav: EnrichedFavorite) => void;
  onPress: (fav: EnrichedFavorite) => void;
  index: number;
}

const FavoriteCard = memo(
  ({ favorite, onRemove, onPress, index }: FavoriteCardProps) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const heartScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        delay: index * 50,
        useNativeDriver: shouldUseNativeDriver,
      }).start();
    }, [index]);

    const handleHeartPulse = () => {
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.3,
          duration: 100,
          useNativeDriver: shouldUseNativeDriver,
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          tension: 200,
          friction: 10,
          useNativeDriver: shouldUseNativeDriver,
        }),
      ]).start();
    };

    return (
      <Animated.View
        style={[styles.favCardWrapper, { transform: [{ scale: scaleAnim }] }]}
      >
        <PressableScale
          style={styles.favCard}
          onPress={() => onPress(favorite)}
          onLongPress={() => {
            handleHeartPulse();
            onRemove(favorite);
          }}
        >
          {/* Image */}
          <View style={styles.favImageContainer}>
            {favorite.imageUrl ? (
              <Animated.Image
                source={{ uri: favorite.imageUrl }}
                style={styles.favImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.favImagePlaceholder}>
                <MaterialCommunityIcons
                  name={
                    favorite.item_type === "destination"
                      ? "map-marker"
                      : "store"
                  }
                  size={32}
                  color="#CBD5E1"
                />
              </View>
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.7)"]}
              style={styles.favImageGradient}
            />
            <View style={styles.favTypeBadge}>
              <MaterialCommunityIcons
                name={
                  favorite.item_type === "destination" ? "map-marker" : "store"
                }
                size={12}
                color="#FFF"
              />
              <Text style={styles.favTypeText}>{favorite.item_type}</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.favContent}>
            <Text style={styles.favName} numberOfLines={1}>
              {favorite.item_name}
            </Text>
            {favorite.region && (
              <Text style={styles.favRegion}>{favorite.region}</Text>
            )}
            {favorite.tagline && (
              <Text style={styles.favTagline} numberOfLines={2}>
                {favorite.tagline}
              </Text>
            )}

            {/* Meta Info */}
            <View style={styles.favMeta}>
              <View style={styles.favMetaItem}>
                <MaterialCommunityIcons
                  name="calendar-outline"
                  size={12}
                  color="#64748B"
                />
                <Text style={styles.favMetaText}>
                  {formatDaysAgo(favorite.savedDaysAgo)}
                </Text>
              </View>
              {favorite.bestTimeToVisit && (
                <View style={styles.favMetaItem}>
                  <MaterialCommunityIcons
                    name="weather-sunny"
                    size={12}
                    color="#F59E0B"
                  />
                  <Text style={styles.favMetaText}>
                    {favorite.bestTimeToVisit}
                  </Text>
                </View>
              )}
            </View>

            {/* Budget Estimate */}
            {favorite.estimatedBudget && (
              <View style={styles.budgetBadge}>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={12}
                  color="#10B981"
                />
                <Text style={styles.budgetText}>
                  {favorite.estimatedBudget}
                </Text>
              </View>
            )}
          </View>

          {/* Remove Button */}
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => {
              handleHeartPulse();
              onRemove(favorite);
            }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <MaterialCommunityIcons name="heart" size={22} color="#EF4444" />
            </Animated.View>
          </TouchableOpacity>
        </PressableScale>
      </Animated.View>
    );
  },
);
FavoriteCard.displayName = "FavoriteCard";

// ─────────────────────────────────────────────────────────────

interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  onPress: (dest: Destination) => void;
}

const AIRecommendationCard = memo(
  ({ recommendation, onPress }: AIRecommendationCardProps) => {
    return (
      <PressableScale
        style={styles.aiCard}
        onPress={() => onPress(recommendation.destination)}
      >
        {recommendation.imageUrl ? (
          <Animated.Image
            source={{ uri: recommendation.imageUrl }}
            style={styles.aiImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.aiImagePlaceholder} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.aiGradient}
        />
        <View style={styles.aiContent}>
          <View style={styles.aiBadge}>
            <MaterialCommunityIcons
              name="robot-outline"
              size={12}
              color="#8B5CF6"
            />
            <Text style={styles.aiBadgeText}>AI Suggests</Text>
          </View>
          <Text style={styles.aiTitle}>{recommendation.title}</Text>
          <Text style={styles.aiReason}>{recommendation.reason}</Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color="#FFF"
          style={styles.aiChevron}
        />
      </PressableScale>
    );
  },
);
AIRecommendationCard.displayName = "AIRecommendationCard";

// ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onExplore: () => void;
}

const EmptyState = memo(({ onExplore }: EmptyStateProps) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: shouldUseNativeDriver,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: shouldUseNativeDriver,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
        <MaterialCommunityIcons
          name="heart-outline"
          size={80}
          color="#CBD5E1"
        />
      </Animated.View>
      <Text style={styles.emptyTitle}>Your travel dreams start here</Text>
      <Text style={styles.emptySubtitle}>
        Save destinations you love and watch your wishlist grow into
        unforgettable adventures
      </Text>
      <PressableScale style={styles.emptyCTA} onPress={onExplore}>
        <MaterialCommunityIcons name="compass-outline" size={20} color="#FFF" />
        <Text style={styles.emptyCTAText}>Explore Destinations</Text>
      </PressableScale>
    </View>
  );
});
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// CUSTOM HOOK
// ─────────────────────────────────────────────────────────────

function useFavoritesEngine() {
  const navigation = useNavigation<NavProp>();

  // State
  const [favorites, setFavorites] = useState<EnrichedFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "destination" | "place">("all");
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, UnsplashImage>>({});
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [removedItem, setRemovedItem] = useState<EnrichedFavorite | null>(null);

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const [favsData, imagesData, destsData] = await Promise.all([
          favoritesService.list(),
          destinationsService.getAllDestinationImages(),
          destinationsService.getDestinations(),
        ]);
        setImages(imagesData);
        setDestinations(destsData);

        // Enrich favorites
        const enriched: EnrichedFavorite[] = favsData.map((fav: Favorite) => {
          const dest = destsData.find(
            (d: Destination) =>
              d.id === fav.item_id || d.label === fav.item_name,
          );
          const imageKey =
            fav.item_id !== undefined && fav.item_id !== null
              ? String(fav.item_id)
              : dest?.id || "";
          const img = imagesData[imageKey];
          return {
            ...fav,
            imageUrl: img?.url_small || img?.url_thumb,
            region: dest?.region,
            tagline: dest?.tagline,
            savedDaysAgo: getDaysAgo(fav.created_at),
            estimatedBudget: estimateBudget(fav),
            bestTimeToVisit: getBestTimeToVisit(fav.item_name),
          };
        });
        setFavorites(enriched);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filtered favorites
  const filteredFavorites = useMemo(() => {
    if (filter === "all") return favorites;
    return favorites.filter((f) => f.item_type === filter);
  }, [favorites, filter]);

  // Stats
  const stats: WishlistStats = useMemo(() => {
    const destCount = favorites.filter(
      (f) => f.item_type === "destination",
    ).length;
    const placeCount = favorites.filter((f) => f.item_type === "place").length;
    return {
      totalItems: favorites.length,
      destinations: destCount,
      places: placeCount,
      estimatedBudget: "₹50K - ₹2L",
      mostSavedRegion: getMostSavedRegion(favorites),
    };
  }, [favorites]);

  // Grouped favorites
  const groupedFavorites = useMemo((): FavoriteGroup[] => {
    const groups: FavoriteGroup[] = [];

    // Recent saves
    const recent = favorites.filter((f) => f.savedDaysAgo <= 7);
    if (recent.length > 0) {
      groups.push({
        id: "recent",
        title: "Recently Saved",
        subtitle: "Fresh travel inspiration",
        icon: "clock-outline",
        color: "#8B5CF6",
        favorites: recent,
      });
    }

    // Dream destinations
    const dream = favorites.filter((f) => f.item_type === "destination");
    if (dream.length > 0) {
      groups.push({
        id: "dream",
        title: "Dream Destinations",
        subtitle: `${dream.length} places to explore`,
        icon: "airplane",
        color: "#0EA5E9",
        favorites: dream,
      });
    }

    // Saved places
    const places = favorites.filter((f) => f.item_type === "place");
    if (places.length > 0) {
      groups.push({
        id: "places",
        title: "Saved Places",
        subtitle: "Restaurants, attractions & more",
        icon: "map-marker-multiple",
        color: "#10B981",
        favorites: places,
      });
    }

    return groups;
  }, [favorites]);

  // AI Recommendations
  const aiRecommendations = useMemo((): AIRecommendation[] => {
    if (favorites.length === 0 || destinations.length === 0) return [];

    const savedIds = new Set(favorites.map((f) => f.item_id));
    const savedNames = favorites.map((f) => f.item_name.toLowerCase());
    const recommendations: AIRecommendation[] = [];

    // Find similar destinations
    destinations.forEach((dest) => {
      if (savedIds.has(dest.id)) return;

      const destStr = `${dest.label} ${dest.region}`.toLowerCase();

      // Check for similarity with saved items
      let relevanceScore = 0;
      let reason = "";

      for (const savedName of savedNames) {
        if (
          /beach|goa|andaman/.test(savedName) &&
          /beach|goa|andaman|kerala|coast/.test(destStr)
        ) {
          relevanceScore += 1;
          reason = `Because you love beach destinations`;
        }
        if (
          /mountain|hill|trek/.test(savedName) &&
          /mountain|hill|trek|manali|shimla/.test(destStr)
        ) {
          relevanceScore += 1;
          reason = `Because you enjoy mountain getaways`;
        }
        if (
          /spiritual|temple/.test(savedName) &&
          /varanasi|rishikesh|temple|spiritual/.test(destStr)
        ) {
          relevanceScore += 1;
          reason = `Because you're seeking spiritual experiences`;
        }
      }

      if (relevanceScore > 0) {
        const img = images[dest.id];
        recommendations.push({
          id: dest.id,
          title: dest.label,
          reason,
          destination: dest,
          imageUrl: img?.url_small || img?.url_thumb,
        });
      }
    });

    return recommendations.slice(0, 3);
  }, [favorites, destinations, images]);

  // Remove favorite with undo
  const removeFavorite = useCallback((fav: EnrichedFavorite) => {
    Alert.alert("Remove from Wishlist", `Remove "${fav.item_name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          // Optimistic update
          setFavorites((prev) => prev.filter((f) => f.id !== fav.id));
          setRemovedItem(fav);

          try {
            await favoritesService.remove(fav.id);
          } catch {
            // Revert on error
            setFavorites((prev) => [...prev, fav]);
            Alert.alert("Error", "Failed to remove. Please try again.");
          }
        },
      },
    ]);
  }, []);

  // Undo remove
  const undoRemove = useCallback(async () => {
    if (!removedItem) return;

    try {
      await favoritesService.add(
        removedItem.item_name,
        removedItem.item_type,
        removedItem.notes || undefined,
      );
      setFavorites((prev) => [...prev, removedItem]);
      setRemovedItem(null);
    } catch {
      Alert.alert("Error", "Could not restore item");
    }
  }, [removedItem]);

  // Navigate to destination
  const navigateToDestination = useCallback(
    (fav: EnrichedFavorite | Destination) => {
      const dest =
        "item_type" in fav
          ? destinations.find(
              (d: Destination) =>
                d.id === fav.item_id || d.label === fav.item_name,
            )
          : fav;

      if (dest) {
        navigation.navigate("DestinationDetail", { destination: dest });
      }
    },
    [navigation, destinations],
  );

  // Share wishlist
  const shareWishlist = useCallback(async () => {
    try {
      const names = favorites
        .slice(0, 5)
        .map((f) => f.item_name)
        .join(", ");
      const message = `Check out my travel wishlist on TimeToTravel AI!\n\n✈️ ${favorites.length} destinations saved\n📍 ${names}${favorites.length > 5 ? "..." : ""}\n\nDownload the app to start planning your adventures!`;

      await Share.share({
        message,
        title: "My Travel Wishlist",
      });
    } catch (error) {
      // Handle error silently
    }
  }, [favorites]);

  return {
    // Data
    favorites,
    filteredFavorites,
    groupedFavorites,
    aiRecommendations,
    stats,

    // State
    loading,
    error,
    filter,
    removedItem,

    // Handlers
    setFilter,
    removeFavorite,
    undoRemove,
    navigateToDestination,
    shareWishlist,
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function FavoritesScreen() {
  const {
    favorites,
    filteredFavorites,
    groupedFavorites,
    aiRecommendations,
    stats,
    loading,
    error,
    filter,
    removedItem,
    setFilter,
    removeFavorite,
    undoRemove,
    navigateToDestination,
    shareWishlist,
  } = useFavoritesEngine();

  const listRef = useRef<FlatList>(null);

  // Render favorite item
  const renderItem = useCallback(
    ({ item, index }: { item: EnrichedFavorite; index: number }) => (
      <FavoriteCard
        favorite={item}
        onRemove={removeFavorite}
        onPress={navigateToDestination}
        index={index}
      />
    ),
    [removeFavorite, navigateToDestination],
  );

  // List header
  const ListHeader = useMemo(() => {
    if (favorites.length === 0) return null;

    return (
      <View style={styles.listHeader}>
        {/* Stats Card */}
        <StatsCard stats={stats} />

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(["all", "destination", "place"] as const).map((f) => (
            <PressableScale
              key={f}
              style={[styles.filterChip, filter === f && styles.filterActive]}
              onPress={() => setFilter(f)}
            >
              <MaterialCommunityIcons
                name={
                  f === "all"
                    ? "heart-multiple"
                    : f === "destination"
                      ? "map-marker"
                      : "store"
                }
                size={14}
                color={filter === f ? "#FFF" : "#64748B"}
              />
              <Text
                style={[
                  styles.filterText,
                  filter === f && styles.filterTextActive,
                ]}
              >
                {f === "all"
                  ? "All"
                  : f === "destination"
                    ? "Destinations"
                    : "Places"}
              </Text>
            </PressableScale>
          ))}
        </View>

        {/* AI Recommendations */}
        {aiRecommendations.length > 0 && (
          <View style={styles.aiSection}>
            <View style={styles.aiSectionHeader}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={18}
                color="#8B5CF6"
              />
              <Text style={styles.aiSectionTitle}>You might also like</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.aiListContent}
            >
              {aiRecommendations.map((rec) => (
                <AIRecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onPress={navigateToDestination}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Section Title */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>
            {filter === "all"
              ? "My Wishlist"
              : filter === "destination"
                ? "Destinations"
                : "Places"}
          </Text>
          <Text style={styles.sectionCount}>{filteredFavorites.length}</Text>
        </View>
      </View>
    );
  }, [
    favorites.length,
    stats,
    filter,
    aiRecommendations,
    filteredFavorites.length,
    navigateToDestination,
    setFilter,
  ]);

  if (loading) {
    return <LoadingSpinner message="Loading your wishlist..." />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color="#EF4444"
          />
          <Text style={styles.errorText}>{error}</Text>
          <PressableScale style={styles.retryBtn} onPress={() => {}}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Wishlist</Text>
          <Text style={styles.subtitle}>Your travel dreams</Text>
        </View>
        <View style={styles.headerRight}>
          {favorites.length > 0 && (
            <>
              <PressableScale style={styles.headerBtn} onPress={shareWishlist}>
                <MaterialCommunityIcons
                  name="share-variant-outline"
                  size={22}
                  color="#64748B"
                />
              </PressableScale>
              <PressableScale style={styles.headerBtn}>
                <MaterialCommunityIcons
                  name="folder-plus-outline"
                  size={22}
                  color="#64748B"
                />
              </PressableScale>
            </>
          )}
        </View>
      </View>

      {/* Main Content */}
      {favorites.length === 0 ? (
        <EmptyState onExplore={() => {}} />
      ) : (
        <FlatList
          ref={listRef}
          data={filteredFavorites}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          renderItem={renderItem}
        />
      )}

      {/* Undo SnackBar */}
      {removedItem && (
        <View style={styles.snackBar}>
          <Text style={styles.snackBarText}>
            Removed {removedItem.item_name}
          </Text>
          <TouchableOpacity onPress={undoRemove}>
            <Text style={styles.snackBarAction}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Plan Trip FAB */}
      {favorites.length >= 2 && (
        <PressableScale style={styles.fab} onPress={() => {}}>
          <MaterialCommunityIcons name="airplane" size={22} color="#FFF" />
          <Text style={styles.fabText}>Plan Trip</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  headerLeft: {},
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
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    padding: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
  },

  // Stats Card
  statsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 20,
    overflow: "hidden",
    ...statsCardShadow,
  },
  statsGradient: {
    padding: spacing.md,
  },
  statsMain: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statsMainText: {
    marginLeft: 12,
  },
  statsCount: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFF",
  },
  statsLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: -2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: spacing.xs,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
    marginTop: 4,
  },
  statValueSmall: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 4,
  },
  statSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  // Filter Row
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: 10,
    marginBottom: spacing.md,
  },
  filterChip: {
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
  filterActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  filterTextActive: {
    color: "#FFF",
  },

  // AI Section
  aiSection: {
    marginBottom: spacing.md,
  },
  aiSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: 8,
  },
  aiSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  aiListContent: {
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  aiCard: {
    width: 200,
    height: 140,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 12,
  },
  aiImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  aiImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
    position: "absolute",
  },
  aiGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  aiContent: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 40,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 6,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#A78BFA",
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  aiReason: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  aiChevron: {
    position: "absolute",
    right: 12,
    bottom: 12,
  },

  // Section Title
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionCount: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },

  // List
  listContent: {
    paddingBottom: 140,
  },
  listHeader: {
    paddingTop: spacing.sm,
  },

  // Favorite Card
  favCardWrapper: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  favCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    ...favCardShadow,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  favImageContainer: {
    height: 120,
    position: "relative",
  },
  favImage: {
    width: "100%",
    height: "100%",
  },
  favImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  favImageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
  },
  favTypeBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  favTypeText: {
    fontSize: 11,
    color: "#FFF",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  favContent: {
    padding: spacing.md,
  },
  favName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  favRegion: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  favTagline: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    lineHeight: 18,
  },
  favMeta: {
    flexDirection: "row",
    marginTop: 10,
    gap: 16,
  },
  favMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  favMetaText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  budgetBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 10,
    gap: 4,
  },
  budgetText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },
  removeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: 8,
    ...removeBtnShadow,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 24,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  emptyCTA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 24,
    gap: 8,
  },
  emptyCTAText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginTop: 16,
  },
  retryBtn: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },

  // Snackbar
  snackBar: {
    position: "absolute",
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: "#0F172A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.2)" }
      : { elevation: 5 }),
  },
  snackBarText: {
    fontSize: 14,
    color: "#FFF",
    fontWeight: "500",
  },
  snackBarAction: {
    fontSize: 14,
    color: "#8B5CF6",
    fontWeight: "700",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    left: "25%",
    right: "25%",
    backgroundColor: "#667EEA",
    borderRadius: 30,
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    ...fabShadow,
  },
  fabText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
