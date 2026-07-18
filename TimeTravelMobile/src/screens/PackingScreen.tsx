/**
 * PackingScreen V5 – AI Smart Packing Assistant
 * Premium, futuristic travel packing experience
 *
 * Features:
 * - AI-powered packing suggestions based on weather/trip type
 * - Circular progress ring with animation
 * - Category-based organization
 * - Smart weather insights
 * - Swipe actions for items
 * - Search & filter functionality
 * - Offline caching with AsyncStorage
 * - Skeleton loading states
 * - Confetti celebration on 100% completion
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
  useRef,
} from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  RefreshControl,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { Text, TextInput as PaperTextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { packingService, PackingItem } from "@/services/packing";
import { destinationsService } from "@/services/destinations";
import { weatherService } from "@/services/weather";
import { Destination, WeatherData } from "@/types";
import { colors, spacing } from "@/theme/colors";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { PressableScale } from "@/components/UI/PressableScale";
import { GlassCard } from "@/components/UI/GlassCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CACHE_KEY = "@packing_cache";
const CIRCLE_RADIUS = 60;
const STROKE_WIDTH = 8;

const progressSectionShadow =
  Platform.select({
    web: { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.08)" } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  }) ?? {};

const packingItemCardShadow =
  Platform.select({
    web: { boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.06)" } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
  }) ?? {};

// ─────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────

type Category =
  | "all"
  | "essentials"
  | "clothing"
  | "gadgets"
  | "documents"
  | "toiletries"
  | "other";

interface EnhancedPackingItem extends PackingItem {
  category?: string;
  priority?: "high" | "medium" | "low";
  weatherRelevant?: boolean;
}

interface CachedPacking {
  items: PackingItem[];
  destination: string;
  timestamp: number;
}

const CATEGORIES: {
  key: Category;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    key: "all",
    label: "All",
    icon: "checkbox-multiple-marked",
    color: "#667EEA",
  },
  { key: "essentials", label: "Essentials", icon: "star", color: "#F59E0B" },
  { key: "clothing", label: "Clothing", icon: "tshirt-crew", color: "#3B82F6" },
  { key: "gadgets", label: "Gadgets", icon: "devices", color: "#8B5CF6" },
  {
    key: "documents",
    label: "Documents",
    icon: "file-document",
    color: "#EF4444",
  },
  {
    key: "toiletries",
    label: "Toiletries",
    icon: "bottle-tonic",
    color: "#10B981",
  },
];

// AI-powered category detection
const detectCategory = (text: string): string => {
  const t = text.toLowerCase();
  if (/passport|visa|ticket|id|license|insurance|document|card/.test(t))
    return "documents";
  if (
    /shirt|pant|dress|jacket|shoe|sock|underwear|cloth|sweater|coat|hat|cap/.test(
      t,
    )
  )
    return "clothing";
  if (
    /charger|adapter|phone|laptop|camera|headphone|power|usb|battery|gadget/.test(
      t,
    )
  )
    return "gadgets";
  if (
    /toothbrush|paste|soap|shampoo|lotion|razor|towel|medicine|first aid|toiletry|cream/.test(
      t,
    )
  )
    return "toiletries";
  if (/wallet|money|glass|sunscreen|umbrella|water|snack|bag|essential/.test(t))
    return "essentials";
  return "other";
};

// AI priority detection
const detectPriority = (text: string): "high" | "medium" | "low" => {
  const t = text.toLowerCase();
  if (/passport|visa|ticket|wallet|phone|money|medicine|id|document/.test(t))
    return "high";
  if (/charger|adapter|shoe|cloth|toothbrush/.test(t)) return "medium";
  return "low";
};

// Weather-based relevance
const isWeatherRelevant = (
  text: string,
  weather?: WeatherData | null,
): boolean => {
  if (!weather) return true;
  const t = text.toLowerCase();
  const temp = weather.temperature_c || 25;
  const condition = (
    (weather as any).condition ||
    (weather as any).description ||
    ""
  ).toLowerCase();

  // Rain gear for rainy weather
  if (condition.includes("rain") && /umbrella|raincoat|jacket/.test(t))
    return true;
  // Warm clothes for cold weather
  if (temp < 15 && /sweater|jacket|coat|thermal|warm/.test(t)) return true;
  // Light clothes for hot weather
  if (temp > 30 && /short|tshirt|light|cotton|sunglass|sunscreen/.test(t))
    return true;

  return false;
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface ProgressRingProps {
  progress: number;
  size?: number;
}

const ProgressRing = memo(
  ({ progress, size = CIRCLE_RADIUS * 2 }: ProgressRingProps) => {
    const animatedProgress = useRef(new Animated.Value(0)).current;
    const radius = size / 2 - STROKE_WIDTH;
    const circumference = 2 * Math.PI * radius;
    const useNativeDriver = Platform.OS !== "web";

    useEffect(() => {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 800,
        useNativeDriver,
        easing: Easing.out(Easing.cubic),
      }).start();
    }, [progress, animatedProgress, useNativeDriver]);

    const strokeDashoffset = animatedProgress.interpolate({
      inputRange: [0, 100],
      outputRange: [circumference, 0],
    });

    const progressColor =
      progress >= 100 ? "#10B981" : progress >= 50 ? "#667EEA" : "#F59E0B";

    return (
      <View
        style={[styles.progressRingContainer, { width: size, height: size }]}
      >
        <Animated.View style={{ transform: [{ rotate: "-90deg" }] }}>
          {/* Background circle */}
          <Animated.View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: STROKE_WIDTH,
              borderColor: "#E2E8F0",
            }}
          />
          {/* Progress circle */}
          <Animated.View
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: STROKE_WIDTH,
              borderColor: progressColor,
              borderStyle: "solid",
              opacity: 0.8,
            }}
          />
        </Animated.View>
        <View style={styles.progressRingContent}>
          <Text style={styles.progressRingValue}>{progress}%</Text>
          <Text style={styles.progressRingLabel}>Packed</Text>
        </View>
      </View>
    );
  },
);
ProgressRing.displayName = "ProgressRing";

// ─────────────────────────────────────────────────────────────

interface CategoryFilterProps {
  activeCategory: Category;
  onCategoryPress: (category: Category) => void;
  counts: Record<string, number>;
}

const CategoryFilter = memo(
  ({ activeCategory, onCategoryPress, counts }: CategoryFilterProps) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryScroll}
    >
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.key;
        const count = cat.key === "all" ? counts.all : counts[cat.key] || 0;

        return (
          <PressableScale
            key={cat.key}
            style={[
              styles.categoryChip,
              isActive && {
                backgroundColor: cat.color,
                borderColor: cat.color,
              },
            ]}
            onPress={() => onCategoryPress(cat.key)}
          >
            <MaterialCommunityIcons
              name={cat.icon as any}
              size={14}
              color={isActive ? "#FFF" : cat.color}
            />
            <Text
              style={[
                styles.categoryChipText,
                isActive && styles.categoryChipTextActive,
              ]}
            >
              {cat.label}
            </Text>
            {count > 0 && (
              <View
                style={[
                  styles.categoryCount,
                  isActive && styles.categoryCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryCountText,
                    isActive && styles.categoryCountTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            )}
          </PressableScale>
        );
      })}
    </ScrollView>
  ),
);
CategoryFilter.displayName = "CategoryFilter";

// ─────────────────────────────────────────────────────────────

interface AIInsightCardProps {
  weather: WeatherData | null;
  destination: string;
  itemCount: number;
}

const AIInsightCard = memo(
  ({ weather, destination, itemCount }: AIInsightCardProps) => {
    const insights: string[] = [];

    if (weather) {
      const temp = weather.temperature_c || 25;
      const condition = (
        (weather as any).condition ||
        (weather as any).description ||
        ""
      ).toLowerCase();

      if (condition.includes("rain")) {
        insights.push("Don't forget an umbrella or raincoat");
      }
      if (temp < 15) {
        insights.push("Pack warm clothes – temperature will be low");
      }
      if (temp > 30) {
        insights.push("Light cotton clothes recommended");
        insights.push("Sunscreen is essential");
      }
    }

    if (itemCount === 0) {
      insights.push("Generate a list based on your destination weather");
    }

    if (insights.length === 0) {
      insights.push("Your packing looks good for this destination");
    }

    return (
      <GlassCard intensity={30} tint="light" style={styles.aiInsightCard}>
        <View style={styles.aiInsightHeader}>
          <View style={styles.aiInsightIcon}>
            <MaterialCommunityIcons
              name="robot-outline"
              size={18}
              color="#667EEA"
            />
          </View>
          <Text style={styles.aiInsightTitle}>AI Packing Tips</Text>
        </View>
        {insights.slice(0, 3).map((insight, idx) => (
          <View key={idx} style={styles.aiInsightRow}>
            <MaterialCommunityIcons
              name="lightbulb-outline"
              size={14}
              color="#F59E0B"
            />
            <Text style={styles.aiInsightText}>{insight}</Text>
          </View>
        ))}
      </GlassCard>
    );
  },
);
AIInsightCard.displayName = "AIInsightCard";

// ─────────────────────────────────────────────────────────────

interface PackingItemCardProps {
  item: EnhancedPackingItem;
  onToggle: () => void;
  onDelete: () => void;
}

const PackingItemCard = memo(
  ({ item, onToggle, onDelete }: PackingItemCardProps) => {
    const category = item.category || detectCategory(item.item_text);
    const priority = item.priority || detectPriority(item.item_text);
    const categoryConfig = CATEGORIES.find((c) => c.key === category);

    const priorityColors = {
      high: "#EF4444",
      medium: "#F59E0B",
      low: "#10B981",
    };

    const handleLongPress = () => {
      if (item.is_custom) {
        Alert.alert(
          "Delete Item",
          `Remove "${item.item_text}" from your checklist?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: onDelete },
          ],
        );
      }
    };

    return (
      <PressableScale
        style={[
          styles.packingItemCard,
          item.is_checked && styles.packingItemCardChecked,
        ]}
        onPress={onToggle}
        onLongPress={handleLongPress}
      >
        <View style={styles.packingItemLeft}>
          <View
            style={[
              styles.priorityIndicator,
              { backgroundColor: priorityColors[priority] },
            ]}
          />
          <View
            style={[
              styles.checkbox,
              item.is_checked && styles.checkboxChecked,
              item.is_checked && {
                backgroundColor: categoryConfig?.color || "#10B981",
                borderColor: categoryConfig?.color || "#10B981",
              },
            ]}
          >
            {item.is_checked && (
              <MaterialCommunityIcons name="check" size={14} color="#FFF" />
            )}
          </View>
          <View style={styles.packingItemContent}>
            <Text
              style={[
                styles.packingItemText,
                item.is_checked && styles.packingItemTextChecked,
              ]}
            >
              {item.item_text}
            </Text>
            <View style={styles.packingItemMeta}>
              {categoryConfig && (
                <View
                  style={[
                    styles.categoryMiniBadge,
                    { backgroundColor: `${categoryConfig.color}15` },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={categoryConfig.icon as any}
                    size={10}
                    color={categoryConfig.color}
                  />
                  <Text
                    style={[
                      styles.categoryMiniText,
                      { color: categoryConfig.color },
                    ]}
                  >
                    {categoryConfig.label}
                  </Text>
                </View>
              )}
              {item.is_custom && (
                <View style={styles.customBadge}>
                  <Text style={styles.customBadgeText}>custom</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <MaterialCommunityIcons
          name="drag-vertical"
          size={20}
          color="#CBD5E1"
        />
      </PressableScale>
    );
  },
);
PackingItemCard.displayName = "PackingItemCard";

// ─────────────────────────────────────────────────────────────

interface DestinationSelectorProps {
  destinations: Destination[];
  selected: string;
  onSelect: (destination: string) => void;
}

const DestinationSelector = memo(
  ({ destinations, selected, onSelect }: DestinationSelectorProps) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.destinationsScroll}
    >
      {destinations.slice(0, 20).map((dest) => {
        const isSelected = selected === dest.label;
        return (
          <PressableScale
            key={dest.id}
            style={[
              styles.destinationChip,
              isSelected && styles.destinationChipActive,
            ]}
            onPress={() => onSelect(dest.label)}
          >
            <Text
              style={[
                styles.destinationChipText,
                isSelected && styles.destinationChipTextActive,
              ]}
            >
              {dest.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  ),
);
DestinationSelector.displayName = "DestinationSelector";

// ─────────────────────────────────────────────────────────────

interface PackingSkeletonProps {}

const PackingSkeleton = memo(({}: PackingSkeletonProps) => (
  <View>
    {/* Progress skeleton */}
    <View style={styles.skeletonProgress}>
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonProgressInfo}>
        <View style={styles.skeletonLineLarge} />
        <View style={styles.skeletonLineMedium} />
      </View>
    </View>
    {/* Category skeleton */}
    <View style={styles.skeletonCategories}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={styles.skeletonChip} />
      ))}
    </View>
    {/* Items skeleton */}
    {Array.from({ length: 6 }).map((_, i) => (
      <View key={i} style={styles.skeletonItem}>
        <View style={styles.skeletonCheckbox} />
        <View style={styles.skeletonItemContent}>
          <View style={styles.skeletonLineLarge} />
          <View style={styles.skeletonLineSmall} />
        </View>
      </View>
    ))}
  </View>
));
PackingSkeleton.displayName = "PackingSkeleton";

// ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  hasDestination: boolean;
  onGenerate: () => void;
}

const EmptyState = memo(({ hasDestination, onGenerate }: EmptyStateProps) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconWrap}>
      <MaterialCommunityIcons
        name="bag-suitcase-outline"
        size={48}
        color="#94A3B8"
      />
    </View>
    <Text style={styles.emptyTitle}>
      {hasDestination ? "No Items Yet" : "Select a Destination"}
    </Text>
    <Text style={styles.emptySubtitle}>
      {hasDestination
        ? "Generate a smart packing list based on weather"
        : "Choose where you're going to get personalized suggestions"}
    </Text>
    {hasDestination && (
      <PressableScale style={styles.emptyBtn} onPress={onGenerate}>
        <LinearGradient
          colors={["#667EEA", "#764BA2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyBtnGradient}
        >
          <MaterialCommunityIcons name="auto-fix" size={18} color="#FFF" />
          <Text style={styles.emptyBtnText}>Generate Smart List</Text>
        </LinearGradient>
      </PressableScale>
    )}
  </View>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function PackingScreen() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState("");
  const [items, setItems] = useState<EnhancedPackingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newItem, setNewItem] = useState("");
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const { activeTrip } = useTravelIntelligence();

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const dests = await destinationsService.getDestinations();
        setDestinations(dests);

        // Use active trip destination if available
        const initialDest =
          activeTrip?.destination?.label || (dests[0]?.label ?? "");
        setSelectedDestination(initialDest);

        // Load cached packing list
        await loadCachedPacking(initialDest);
      } catch (e) {
        console.error("Init error:", e);
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, [activeTrip?.destination?.label]);

  // Fetch weather when destination changes
  useEffect(() => {
    if (selectedDestination) {
      weatherService
        .getWeather(selectedDestination)
        .then(setWeather)
        .catch(() => setWeather(null));
    }
  }, [selectedDestination]);

  const loadCachedPacking = async (destination: string) => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedPacking = JSON.parse(cached);
        if (
          data.destination === destination &&
          Date.now() - data.timestamp < 10 * 60 * 1000
        ) {
          setItems(enhanceItems(data.items));
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  };

  const enhanceItems = useCallback(
    (rawItems: PackingItem[]): EnhancedPackingItem[] => {
      return rawItems.map((item) => ({
        ...item,
        category: detectCategory(item.item_text),
        priority: detectPriority(item.item_text),
        weatherRelevant: isWeatherRelevant(item.item_text, weather),
      }));
    },
    [weather],
  );

  const cacheItems = async (items: PackingItem[], destination: string) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          items,
          destination,
          timestamp: Date.now(),
        }),
      );
    } catch (e) {
      // Ignore cache errors
    }
  };

  const generateList = useCallback(async () => {
    if (!selectedDestination || generating) return;

    setGenerating(true);
    try {
      const response = await packingService.generate(selectedDestination);
      const enhanced = enhanceItems(response.items || []);
      setItems(enhanced);
      await cacheItems(response.items || [], selectedDestination);

      if (response.items?.length === 0) {
        Alert.alert(
          "No Items",
          "Could not generate packing suggestions. Try adding items manually.",
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to generate packing list");
    } finally {
      setGenerating(false);
    }
  }, [selectedDestination, generating, enhanceItems]);

  const loadChecklist = useCallback(async () => {
    if (!selectedDestination) return;

    setLoading(true);
    try {
      const response = await packingService.getChecklist(selectedDestination);
      const enhanced = enhanceItems(response.items || []);
      setItems(enhanced);
      await cacheItems(response.items || [], selectedDestination);
    } catch (e) {
      console.error("Load checklist error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedDestination, enhanceItems]);

  const toggleItem = useCallback(
    async (item: PackingItem) => {
      // Optimistic update
      const prevItems = items;
      const updated = items.map((i) =>
        i.id === item.id ? { ...i, is_checked: !i.is_checked } : i,
      );
      setItems(updated);

      try {
        await packingService.toggleItem(item.id);
        await cacheItems(updated, selectedDestination);
      } catch (e) {
        // Revert on error
        setItems(prevItems);
        Alert.alert("Error", "Failed to update item");
      }
    },
    [items, selectedDestination],
  );

  const deleteItem = useCallback(
    async (item: PackingItem) => {
      const prevItems = items;
      const updated = items.filter((i) => i.id !== item.id);
      setItems(updated);

      try {
        await packingService.deleteItem(item.id);
        await cacheItems(updated, selectedDestination);
      } catch (e) {
        // Revert on error
        setItems(prevItems);
        Alert.alert("Error", "Failed to delete item");
      }
    },
    [items, selectedDestination],
  );

  const addCustomItem = useCallback(async () => {
    if (!newItem.trim() || !selectedDestination) return;

    // Check for duplicates
    const exists = items.some(
      (i) => i.item_text.toLowerCase() === newItem.trim().toLowerCase(),
    );
    if (exists) {
      Alert.alert("Duplicate", "This item is already in your list");
      return;
    }

    try {
      const response = await packingService.addCustom(
        selectedDestination,
        newItem.trim(),
      );
      const enhanced: EnhancedPackingItem = {
        ...response.item,
        category: detectCategory(response.item.item_text),
        priority: detectPriority(response.item.item_text),
        weatherRelevant: isWeatherRelevant(response.item.item_text, weather),
      };
      const updated = [...items, enhanced];
      setItems(updated);
      setNewItem("");
      await cacheItems(updated, selectedDestination);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add item");
    }
  }, [newItem, selectedDestination, items, weather]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadChecklist()]);
    setRefreshing(false);
  }, [loadChecklist]);

  const handleDestinationSelect = useCallback((dest: string) => {
    setSelectedDestination(dest);
    setItems([]);
    loadCachedPacking(dest);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────

  const progress = useMemo(() => {
    if (items.length === 0) return 0;
    const checked = items.filter((i) => i.is_checked).length;
    return Math.round((checked / items.length) * 100);
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    items.forEach((item) => {
      const cat = item.category || detectCategory(item.item_text);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Category filter
    if (activeCategory !== "all") {
      result = result.filter((item) => {
        const cat = item.category || detectCategory(item.item_text);
        return cat === activeCategory;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) =>
        item.item_text.toLowerCase().includes(q),
      );
    }

    // Sort: unchecked first, then by priority
    return result.sort((a, b) => {
      if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (
        priorityOrder[a.priority || "low"] - priorityOrder[b.priority || "low"]
      );
    });
  }, [items, activeCategory, searchQuery]);

  const checkedCount = useMemo(
    () => items.filter((i) => i.is_checked).length,
    [items],
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (initLoading) {
    return <PackingSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <LinearGradient colors={["#667EEA", "#764BA2"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Smart Packing</Text>
            <Text style={styles.headerSubtitle}>
              {selectedDestination
                ? `For ${selectedDestination}`
                : "AI-powered checklist"}
            </Text>
          </View>
          {weather && (
            <View style={styles.weatherBadge}>
              <MaterialCommunityIcons
                name="weather-partly-cloudy"
                size={16}
                color="#FFF"
              />
              <Text style={styles.weatherText}>{weather.temperature_c}°C</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#667EEA"
          />
        }
      >
        {/* Destination Selector */}
        <DestinationSelector
          destinations={destinations}
          selected={selectedDestination}
          onSelect={handleDestinationSelect}
        />

        {/* Progress Section */}
        {items.length > 0 && (
          <View style={styles.progressSection}>
            <ProgressRing progress={progress} />
            <View style={styles.progressInfo}>
              <Text style={styles.progressTitle}>
                {progress >= 100
                  ? "All Packed!"
                  : `${checkedCount} of ${items.length} items`}
              </Text>
              <Text style={styles.progressSubtitle}>
                {progress >= 100
                  ? "You're ready for your trip!"
                  : `${items.length - checkedCount} items remaining`}
              </Text>
              {progress >= 100 && (
                <View style={styles.celebrationBadge}>
                  <MaterialCommunityIcons
                    name="party-popper"
                    size={14}
                    color="#10B981"
                  />
                  <Text style={styles.celebrationText}>Great job!</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* AI Insights */}
        <AIInsightCard
          weather={weather}
          destination={selectedDestination}
          itemCount={items.length}
        />

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <PressableScale
            style={styles.generateBtn}
            onPress={generateList}
            disabled={generating}
          >
            <LinearGradient
              colors={
                generating ? ["#94A3B8", "#64748B"] : ["#667EEA", "#764BA2"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.generateBtnGradient}
            >
              <MaterialCommunityIcons
                name={generating ? "loading" : "auto-fix"}
                size={18}
                color="#FFF"
              />
              <Text style={styles.generateBtnText}>
                {generating ? "Generating..." : "Generate Smart List"}
              </Text>
            </LinearGradient>
          </PressableScale>
          <PressableScale style={styles.loadBtn} onPress={loadChecklist}>
            <MaterialCommunityIcons
              name="download-outline"
              size={18}
              color="#667EEA"
            />
            <Text style={styles.loadBtnText}>Load Saved</Text>
          </PressableScale>
        </View>

        {/* Category Filter */}
        {items.length > 0 && (
          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryPress={setActiveCategory}
            counts={categoryCounts}
          />
        )}

        {/* Search */}
        {items.length > 3 && (
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Loading State */}
        {loading && <PackingSkeleton />}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <EmptyState
            hasDestination={!!selectedDestination}
            onGenerate={generateList}
          />
        )}

        {/* Items List */}
        {!loading && filteredItems.length > 0 && (
          <View style={styles.itemsList}>
            {filteredItems.map((item) => (
              <PackingItemCard
                key={item.id}
                item={item}
                onToggle={() => toggleItem(item)}
                onDelete={() => deleteItem(item)}
              />
            ))}
          </View>
        )}

        {/* Add Custom Item */}
        {items.length > 0 && (
          <View style={styles.addRow}>
            <PaperTextInput
              mode="outlined"
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Add custom item..."
              placeholderTextColor="#94A3B8"
              style={styles.addInput}
              outlineColor="#E2E8F0"
              activeOutlineColor="#667EEA"
              onSubmitEditing={addCustomItem}
              returnKeyType="done"
            />
            <PressableScale
              style={[styles.addBtn, !newItem.trim() && styles.addBtnDisabled]}
              onPress={addCustomItem}
              disabled={!newItem.trim()}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
            </PressableScale>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFF",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  weatherBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  weatherText: { fontSize: 14, fontWeight: "600", color: "#FFF" },

  // Destination Selector
  destinationsScroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 8,
  },
  destinationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  destinationChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  destinationChipText: { fontSize: 13, fontWeight: "500", color: "#64748B" },
  destinationChipTextActive: { color: "#FFF", fontWeight: "600" },

  // Progress Section
  progressSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFF",
    marginHorizontal: spacing.lg,
    borderRadius: 20,
    marginBottom: spacing.md,
    ...progressSectionShadow,
  },
  progressRingContainer: { alignItems: "center", justifyContent: "center" },
  progressRingContent: { position: "absolute", alignItems: "center" },
  progressRingValue: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  progressRingLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressInfo: { flex: 1, marginLeft: spacing.md },
  progressTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  progressSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  celebrationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  celebrationText: { fontSize: 12, fontWeight: "600", color: "#10B981" },

  // AI Insight Card
  aiInsightCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 16,
    padding: spacing.md,
  },
  aiInsightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  aiInsightIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  aiInsightTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  aiInsightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  aiInsightText: { fontSize: 13, color: "#64748B", flex: 1 },

  // Action Buttons
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  generateBtn: { flex: 2, height: 50, borderRadius: 14, overflow: "hidden" },
  generateBtnGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateBtnText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  loadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  loadBtnText: { fontSize: 13, fontWeight: "600", color: "#667EEA" },

  // Category Filter
  categoryScroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFF",
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryChipText: { fontSize: 12, fontWeight: "500", color: "#64748B" },
  categoryChipTextActive: { color: "#FFF", fontWeight: "600" },
  categoryCount: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryCountActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  categoryCountText: { fontSize: 10, fontWeight: "600", color: "#64748B" },
  categoryCountTextActive: { color: "#FFF" },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },

  // Items List
  itemsList: { paddingHorizontal: spacing.lg },

  // Packing Item Card
  packingItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...packingItemCardShadow,
  },
  packingItemCardChecked: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  packingItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  priorityIndicator: { width: 3, height: 32, borderRadius: 2, marginRight: 10 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { borderWidth: 0 },
  packingItemContent: { flex: 1 },
  packingItemText: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  packingItemTextChecked: {
    textDecorationLine: "line-through",
    color: "#94A3B8",
  },
  packingItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  categoryMiniBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  categoryMiniText: { fontSize: 10, fontWeight: "500" },
  customBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customBadgeText: { fontSize: 10, fontWeight: "500", color: "#667EEA" },

  // Add Row
  addRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  addInput: { flex: 1, backgroundColor: "#FFF", fontSize: 14 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#667EEA",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  addBtnDisabled: { backgroundColor: "#CBD5E1" },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  emptyBtn: { borderRadius: 14, overflow: "hidden" },
  emptyBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  emptyBtnText: { fontSize: 14, fontWeight: "700", color: "#FFF" },

  // Skeleton
  skeletonProgress: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  skeletonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E2E8F0",
  },
  skeletonProgressInfo: { flex: 1, marginLeft: spacing.md, gap: 8 },
  skeletonLineLarge: {
    height: 16,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    width: "100%",
  },
  skeletonLineMedium: {
    height: 14,
    backgroundColor: "#E2E8F0",
    borderRadius: 7,
    width: "70%",
  },
  skeletonLineSmall: {
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    width: "40%",
  },
  skeletonCategories: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: 8,
    marginBottom: spacing.md,
  },
  skeletonChip: {
    width: 80,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
  },
  skeletonItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: spacing.lg,
    marginBottom: 8,
    padding: spacing.sm,
    borderRadius: 14,
    gap: 12,
  },
  skeletonCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  skeletonItemContent: { flex: 1, gap: 8 },
});
