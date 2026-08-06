/**
 * ExploreScreen — AI-Powered Intelligent Discovery Engine
 *
 * This is now a thin composition layer. All logic, sub-components,
 * constants, and utilities live in features/explore/.
 *
 * Architecture:
 *   features/explore/
 *   ├── components/     — CategoryPill, InsightCard, FilterChips, SearchOverlay, ExploreSkeleton
 *   ├── hooks/          — useExploreEngine (state + data)
 *   ├── utils/          — scoring, responsive
 *   └── constants/      — categories
 */

import React, { useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import ErrorMessage from "@/components/Common/ErrorMessage";
import DestinationCard from "@/components/Features/DestinationCard";
import { PressableScale } from "@/components/UI/PressableScale";
import { Destination } from "@/types";
import { colors, spacing } from "@/theme/colors";

import { useExploreEngine } from "@/features/explore/hooks/useExploreEngine";
import {
  CategoryPill,
  InsightCard,
  FilterChips,
  SearchOverlay,
  ExploreSkeleton,
} from "@/features/explore/components";
import { CATEGORIES } from "@/features/explore/constants/categories";
import { getColumnCount } from "@/features/explore/utils/responsive";
import { AIInsight } from "@/features/explore/utils/scoring";
import type { BottomTabParamList } from "@/navigation/BottomTabNavigator";
import { RootStackParamList } from "@/navigation/types";

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

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

  const route = useRoute<RouteProp<BottomTabParamList, "Explore">>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Apply navigation params (Home "See All" / insight card deep links)
  useEffect(() => {
    const { category, season } = route.params ?? {};
    if (category && category !== activeCategory) {
      setActiveCategory(category);
    }
    if (season) {
      handleFilterChange("season", season);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.category, route.params?.season]);

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
          color={colors.border}
        />
        <Text style={styles.emptyTitle}>No destinations found</Text>
        <Text style={styles.emptySubtitle}>
          Try adjusting your filters or search for something else
        </Text>
        <PressableScale
          style={styles.emptyCTA}
          onPress={() => {
            setActiveCategory("all");
            handleFilterChange("budget", "all");
            handleFilterChange("duration", "all");
            handleFilterChange("vibe", "all");
            handleFilterChange("season", "all");
            setSearch("");
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
        >
          <Text style={styles.emptyCTAText}>Clear all filters</Text>
        </PressableScale>
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
          accessibilityRole="search"
          accessibilityLabel="Search destinations"
        >
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={colors.textSecondary}
          />
          <Text style={styles.searchBarPlaceholder}>
            {search || "Where to next?"}
          </Text>
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
              tintColor={colors.darkBackground}
              colors={[colors.darkBackground]}
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
        <PressableScale
          style={styles.fab}
          onPress={() => navigation.navigate("Itinerary")}
          accessibilityRole="button"
          accessibilityLabel="Plan a trip with AI assistant"
        >
          <MaterialCommunityIcons
            name="robot-outline"
            size={22}
            color="#FFF"
          />
          <Text style={styles.fabText}>Plan with AI</Text>
        </PressableScale>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES (only screen-level styles remain here)
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
    color: colors.darkBackground,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
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
    color: colors.text,
    marginLeft: 12,
    fontWeight: "500",
  },

  // Categories
  categoriesScroll: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },

  // List
  listContent: {
    paddingBottom: 120,
  },
  listHeader: {
    paddingBottom: spacing.sm,
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
    color: colors.darkBackground,
    letterSpacing: -0.3,
  },
  gridCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    maxWidth: 280,
    width: "50%",
    backgroundColor: colors.darkBackground,
    borderRadius: 30,
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
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
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyCTA: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.darkBackground,
    borderRadius: 12,
  },
  emptyCTAText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
