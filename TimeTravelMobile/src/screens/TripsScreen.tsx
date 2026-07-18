/**
 * TripsScreen - Production-Grade Travel Hub
 * Premium, scalable, AI-first travel command center
 */

import React, { useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  useWindowDimensions,
  Alert,
  StatusBar,
  Pressable,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  Layout,
  SlideInRight,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

// Components
import FeatureCard, {
  FeatureCardSkeleton,
} from "@/components/Trips/FeatureCard";
import {
  FeatureConfig,
  FeatureCategory,
  QuickAction,
} from "@/components/Trips/types";
import { CATEGORY_CONFIG } from "@/components/Trips/featureConfig";

// Hooks & Store
import {
  useTripsFeatures,
  useFeatureRecommendations,
  useQuickActions,
  usePersonalizedGreeting,
} from "@/hooks/useTripsFeatures";
import { useTripsStore } from "@/stores/tripsStore";

// Navigation
import { CommonActions, useNavigation } from "@react-navigation/native";

const NAVIGABLE_ROUTES = new Set([
  "MainTabs",
  "HomeTab",
  "ExploreTab",
  "ChatTab",
  "TripsTab",
  "ProfileTab",
  "DestinationDetail",
  "Budget",
  "Itinerary",
  "Packing",
  "Favorites",
  "Currency",
  "Compare",
  "Places",
  "RoutePlanner",
  "TripWorkspace",
  "Expenses",
  "TravelJournal",
  "Reservations",
  "TripSharing",
  "NewsFeed",
  "TravelStats",
  "Phrasebook",
]);

const navigateFeature = (navigation: any, feature: FeatureConfig) => {
  if (!feature.screen) return;

  if (!NAVIGABLE_ROUTES.has(feature.screen)) {
    Alert.alert(
      "Coming soon",
      `${feature.title} is not available in this build yet.`,
    );
    return;
  }

  navigation.dispatch(
    CommonActions.navigate({
      name: feature.screen as string,
      params: feature.params,
    }),
  );
};

// ─────────────────────────────────────────────────────────────
// HEADER SECTION COMPONENT
// ─────────────────────────────────────────────────────────────

const HeaderSection: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { greeting, emoji, streakMessage, levelMessage, xpProgress } =
    usePersonalizedGreeting();
  const { travelProgress } = useTripsStore();

  return (
    <Animated.View
      entering={FadeInDown.delay(100).springify()}
      style={[styles.headerSection, { paddingTop: insets.top + 16 }]}
    >
      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={styles.greetingEmoji}>{emoji}</Text>
        <View style={styles.greetingTextContainer}>
          <Text style={styles.greetingText}>{greeting}, Traveler!</Text>
          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>{levelMessage}</Text>
            {streakMessage ? (
              <Text style={styles.streakText}>{streakMessage}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* XP Progress Bar */}
      <View style={styles.xpContainer}>
        <View style={styles.xpBar}>
          <Animated.View style={[styles.xpFill, { width: `${xpProgress}%` }]} />
        </View>
      </View>

      {/* Travel Stats Mini */}
      {travelProgress && (
        <View style={styles.statsRow}>
          <StatItem
            emoji="🌍"
            value={travelProgress.countriesVisited}
            label="Countries"
          />
          <StatItem
            emoji="✈️"
            value={travelProgress.totalTrips}
            label="Trips"
          />
          <StatItem
            emoji="📍"
            value={travelProgress.citiesVisited}
            label="Cities"
          />
          <StatItem
            emoji="📅"
            value={travelProgress.upcomingTrips}
            label="Upcoming"
          />
        </View>
      )}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// STAT ITEM COMPONENT
// ─────────────────────────────────────────────────────────────

const StatItem: React.FC<{ emoji: string; value: number; label: string }> = ({
  emoji,
  value,
  label,
}) => (
  <View style={styles.statItem}>
    <Text style={styles.statEmoji}>{emoji}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
// QUICK ACTIONS COMPONENT
// ─────────────────────────────────────────────────────────────

const QuickActionsSection: React.FC = () => {
  const navigation = useNavigation();

  const handleAction = useCallback(
    (type: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Handle quick action navigation using CommonActions
      switch (type) {
        case "resume_trip":
          navigation.dispatch(
            CommonActions.navigate({ name: "TripWorkspace", params: {} }),
          );
          break;
        case "check_weather":
          // Navigate to Explore tab
          navigation.dispatch(
            CommonActions.navigate({
              name: "MainApp",
              params: { screen: "ExploreTab" },
            }),
          );
          break;
        case "add_expense":
          navigation.dispatch(
            CommonActions.navigate({ name: "Expenses", params: {} }),
          );
          break;
        case "add_note":
          navigation.dispatch(
            CommonActions.navigate({ name: "TravelJournal", params: {} }),
          );
          break;
      }
    },
    [navigation],
  );

  // Static quick actions for display
  const quickActions = [
    {
      id: "1",
      type: "resume_trip" as const,
      title: "Resume Trip",
      subtitle: "Paris 2024",
      emoji: "✈️",
      urgency: "high" as const,
    },
    {
      id: "2",
      type: "check_weather" as const,
      title: "Weather",
      subtitle: "Check forecast",
      emoji: "🌤️",
      urgency: "low" as const,
    },
    {
      id: "3",
      type: "add_expense" as const,
      title: "Add Expense",
      subtitle: "Track spending",
      emoji: "💰",
      urgency: "medium" as const,
    },
    {
      id: "4",
      type: "add_note" as const,
      title: "Add Note",
      subtitle: "Journal entry",
      emoji: "📝",
      urgency: "low" as const,
    },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(200).springify()}
      style={styles.quickActionsSection}
    >
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsRow}>
        {quickActions.slice(0, 4).map((action, index) => (
          <Animated.View
            key={action.id}
            entering={SlideInRight.delay(250 + index * 50).springify()}
            style={styles.quickActionWrapper}
          >
            <QuickActionCard
              action={action}
              onPress={() => handleAction(action.type)}
            />
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};

const QuickActionCard: React.FC<{
  action: { title: string; subtitle: string; emoji: string; urgency: string };
  onPress: () => void;
}> = ({ action, onPress }) => {
  const urgencyColors: Record<string, string> = {
    high: "#EF4444",
    medium: "#F59E0B",
    low: "#10B981",
  };

  return (
    <Pressable onPress={onPress} style={styles.quickActionCard}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.quickActionContent}>
        <Text style={styles.quickActionEmoji}>{action.emoji}</Text>
        <Text style={styles.quickActionTitle} numberOfLines={1}>
          {action.title}
        </Text>
        <Text style={styles.quickActionSubtitle} numberOfLines={1}>
          {action.subtitle}
        </Text>
        <View
          style={[
            styles.urgencyDot,
            { backgroundColor: urgencyColors[action.urgency] || "#10B981" },
          ]}
        />
      </View>
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────
// CATEGORY FILTER COMPONENT
// ─────────────────────────────────────────────────────────────

const CategoryFilter: React.FC = () => {
  const { selectedCategory, setSelectedCategory } = useTripsStore();
  const { features } = useTripsFeatures();

  // Calculate category counts
  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    features.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return Object.entries(CATEGORY_CONFIG).map(([key, config]) => ({
      key,
      label: config.label,
      emoji: config.emoji,
      count: counts[key] || 0,
    }));
  }, [features]);

  const handleSelect = useCallback(
    (category: FeatureCategory | "all") => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCategory(category);
    },
    [setSelectedCategory],
  );

  const allCategory = {
    key: "all",
    label: "All",
    emoji: "✨",
    count: features.length,
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(300).springify()}
      style={styles.categoryFilterSection}
    >
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[allCategory, ...categoriesWithCounts]}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.categoryFilterContent}
        renderItem={({ item, index }) => {
          const isSelected = selectedCategory === item.key;
          return (
            <Animated.View
              entering={FadeIn.delay(350 + index * 30).springify()}
            >
              <CategoryChip
                emoji={item.emoji}
                label={item.label}
                count={item.count}
                isSelected={isSelected}
                onPress={() =>
                  handleSelect(item.key as FeatureCategory | "all")
                }
              />
            </Animated.View>
          );
        }}
      />
    </Animated.View>
  );
};

const CategoryChip: React.FC<{
  emoji: string;
  label: string;
  count: number;
  isSelected: boolean;
  onPress: () => void;
}> = ({ emoji, label, count, isSelected, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
  >
    <BlurView
      intensity={isSelected ? 60 : 30}
      tint={isSelected ? "light" : "dark"}
      style={StyleSheet.absoluteFill}
    />
    <Text style={styles.categoryChipEmoji}>{emoji}</Text>
    <Text
      style={[
        styles.categoryChipLabel,
        isSelected && styles.categoryChipLabelSelected,
      ]}
    >
      {label}
    </Text>
    {count > 0 && (
      <View style={styles.categoryCount}>
        <Text style={styles.categoryCountText}>{count}</Text>
      </View>
    )}
  </Pressable>
);

// ─────────────────────────────────────────────────────────────
// RECOMMENDATIONS SECTION
// ─────────────────────────────────────────────────────────────

const RecommendationsSection: React.FC = () => {
  const recommendations = useFeatureRecommendations();
  const { trackFeatureClick } = useTripsFeatures();
  const navigation = useNavigation();

  const handlePress = useCallback(
    (feature: FeatureConfig) => {
      trackFeatureClick(feature.id);
      navigateFeature(navigation, feature);
    },
    [trackFeatureClick, navigation],
  );

  if (recommendations.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(400).springify()}
      style={styles.recommendationsSection}
    >
      <Text style={styles.sectionTitle}>Recommended for You</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={recommendations}
        keyExtractor={(item) => item.feature.id}
        contentContainerStyle={styles.recommendationsContent}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={SlideInRight.delay(450 + index * 50).springify()}
          >
            <RecommendationCard
              recommendation={item}
              onPress={() => handlePress(item.feature)}
            />
          </Animated.View>
        )}
      />
    </Animated.View>
  );
};

const RecommendationCard: React.FC<{
  recommendation: { feature: FeatureConfig; reason: string; score: number };
  onPress: () => void;
}> = ({ recommendation, onPress }) => (
  <Pressable onPress={onPress} style={styles.recommendationCard}>
    <LinearGradient
      colors={["#667EEA", "#764BA2"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
    <View style={styles.recommendationContent}>
      <Text style={styles.recommendationEmoji}>
        {recommendation.feature.emoji}
      </Text>
      <Text style={styles.recommendationTitle}>
        {recommendation.feature.title}
      </Text>
      <Text style={styles.recommendationReason}>{recommendation.reason}</Text>
    </View>
  </Pressable>
);

// ─────────────────────────────────────────────────────────────
// FEATURE GRID COMPONENT
// ─────────────────────────────────────────────────────────────

const FeatureGrid: React.FC = () => {
  const { features, isLoading, isFavorite, trackFeatureClick } =
    useTripsFeatures();
  const { isRefreshing, refresh } = useTripsStore();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const columns = width >= 768 ? 3 : 2;

  const handleFeaturePress = useCallback(
    (feature: FeatureConfig) => {
      trackFeatureClick(feature.id);
      navigateFeature(navigation, feature);
    },
    [trackFeatureClick, navigation],
  );

  const handleLongPress = useCallback((feature: FeatureConfig) => {
    // Toggle favorite
    useTripsStore.getState().toggleFavorite(feature.id);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: FeatureConfig; index: number }) => (
      <Animated.View
        entering={FadeInUp.delay(500 + index * 30).springify()}
        layout={Layout.springify()}
        style={styles.featureCardWrapper}
      >
        <FeatureCard
          feature={item}
          onPress={handleFeaturePress}
          onLongPress={handleLongPress}
          isFavorite={isFavorite(item.id)}
        />
      </Animated.View>
    ),
    [handleFeaturePress, handleLongPress, isFavorite],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 150,
      offset: 150 * Math.floor(index / columns),
      index,
    }),
    [columns],
  );

  const keyExtractor = useCallback((item: FeatureConfig) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.featureGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={styles.featureCardWrapper}>
            <FeatureCardSkeleton />
          </View>
        ))}
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.delay(500)}
      style={styles.featureGridSection}
    >
      <Text style={styles.sectionTitle}>All Features</Text>
      <FlatList
        key={`feature-grid-${columns}`}
        data={features}
        keyExtractor={keyExtractor}
        numColumns={columns}
        columnWrapperStyle={styles.featureGridRow}
        contentContainerStyle={styles.featureGridContent}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor="#fff"
            titleColor="#fff"
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
        scrollEnabled={false}
      />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN COMPONENT
// ─────────────────────────────────────────────────────────────

const TripsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { refresh, setLoading } = useTripsStore();

  useEffect(() => {
    refresh();
    setLoading(false);
  }, []);

  const renderEmptyItem = useCallback(() => null, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f3460"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Main Content */}
      <FlatList
        data={[]}
        keyExtractor={() => "empty"}
        renderItem={renderEmptyItem}
        ListHeaderComponent={
          <>
            <HeaderSection />
            <QuickActionsSection />
            <CategoryFilter />
            <RecommendationsSection />
          </>
        }
        ListFooterComponent={<FeatureGrid />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        removeClippedSubviews={true}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // Header
  headerSection: {
    marginBottom: 20,
  },
  greetingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  greetingEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  levelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  levelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
  },
  streakText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F59E0B",
    marginLeft: 8,
  },
  xpContainer: {
    marginBottom: 16,
  },
  xpBar: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: "#8B5CF6",
    borderRadius: 2,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },

  // Section titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },

  // Quick Actions
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickActionWrapper: {
    flex: 1,
    marginHorizontal: 4,
  },
  quickActionCard: {
    height: 80,
    borderRadius: 16,
    overflow: "hidden",
  },
  quickActionContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  quickActionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  quickActionSubtitle: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  urgencyDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Category Filter
  categoryFilterSection: {
    marginBottom: 24,
  },
  categoryFilterContent: {
    paddingRight: 16,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    overflow: "hidden",
  },
  categoryChipSelected: {
    backgroundColor: "rgba(139, 92, 246, 0.3)",
  },
  categoryChipEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  categoryChipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  categoryChipLabelSelected: {
    color: "#fff",
  },
  categoryCount: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  categoryCountText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },

  // Recommendations
  recommendationsSection: {
    marginBottom: 24,
  },
  recommendationsContent: {
    paddingRight: 16,
  },
  recommendationCard: {
    width: 140,
    height: 100,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 12,
  },
  recommendationContent: {
    flex: 1,
    padding: 12,
    justifyContent: "flex-end",
  },
  recommendationEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  recommendationReason: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  // Feature Grid
  featureGridSection: {
    paddingBottom: 100,
  },
  featureGridContent: {
    paddingBottom: 20,
  },
  featureGridRow: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  featureCardWrapper: {
    flex: 1,
    marginHorizontal: 8,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});

export default TripsScreen;
