/**
 * Skeleton Loader Components
 * Premium shimmer loading states for better UX
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// ─────────────────────────────────────────────────────────────
// SHIMMER EFFECT
// ─────────────────────────────────────────────────────────────

interface ShimmerProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Shimmer: React.FC<ShimmerProps> = ({ width, height, borderRadius = 8, style }) => {
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const translateX = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-350, 350],
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: "#E2E8F0",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          transform: [{ translateX }],
          width: "100%",
          height: "100%",
        }}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.4)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// ITINERARY SKELETON
// ─────────────────────────────────────────────────────────────

export const ItineraryDaySkeleton: React.FC = () => (
  <View style={styles.daySkeleton}>
    <View style={styles.dayHeader}>
      <Shimmer width={32} height={32} borderRadius={16} />
      <Shimmer width={180} height={24} borderRadius={8} style={{ marginLeft: 12 }} />
    </View>
    
    <View style={styles.activitySkeleton}>
      <Shimmer width={80} height={12} borderRadius={4} />
      <Shimmer width="100%" height={20} borderRadius={6} style={{ marginTop: 8 }} />
      <Shimmer width="80%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
    </View>
    
    <View style={styles.activitySkeleton}>
      <Shimmer width={80} height={12} borderRadius={4} />
      <Shimmer width="100%" height={20} borderRadius={6} style={{ marginTop: 8 }} />
      <Shimmer width="70%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
    </View>
    
    <View style={styles.activitySkeleton}>
      <Shimmer width={80} height={12} borderRadius={4} />
      <Shimmer width="100%" height={20} borderRadius={6} style={{ marginTop: 8 }} />
      <Shimmer width="85%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
    </View>
  </View>
);

export const ItinerarySkeleton: React.FC<{ days?: number }> = ({ days = 3 }) => (
  <View style={styles.container}>
    {/* Stats row skeleton */}
    <View style={styles.statsSkeleton}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.statItem}>
          <Shimmer width={40} height={24} borderRadius={6} />
          <Shimmer width={50} height={12} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
    
    {/* Day skeletons */}
    {Array.from({ length: days }).map((_, i) => (
      <ItineraryDaySkeleton key={i} />
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────
// DESTINATION CARD SKELETON
// ─────────────────────────────────────────────────────────────

export const DestinationCardSkeleton: React.FC<{ horizontal?: boolean }> = ({ horizontal }) => {
  if (horizontal) {
    return (
      <View style={styles.horizontalCardSkeleton}>
        <Shimmer width={260} height={180} borderRadius={20} />
        <View style={{ marginTop: 12, paddingHorizontal: 4 }}>
          <Shimmer width={160} height={20} borderRadius={6} />
          <View style={{ flexDirection: "row", marginTop: 8, alignItems: "center" }}>
            <Shimmer width={12} height={12} borderRadius={2} />
            <Shimmer width={80} height={14} borderRadius={4} style={{ marginLeft: 6 }} />
          </View>
          <Shimmer width={100} height={16} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.verticalCardSkeleton}>
      <Shimmer width="100%" height={200} borderRadius={20} />
      <View style={styles.cardContent}>
        <Shimmer width="70%" height={22} borderRadius={6} />
        <View style={{ flexDirection: "row", marginTop: 8, alignItems: "center" }}>
          <Shimmer width={14} height={14} borderRadius={2} />
          <Shimmer width={100} height={14} borderRadius={4} style={{ marginLeft: 6 }} />
        </View>
        <View style={{ flexDirection: "row", marginTop: 12, alignItems: "center" }}>
          <Shimmer width={16} height={16} borderRadius={4} />
          <Shimmer width={80} height={16} borderRadius={4} style={{ marginLeft: 6 }} />
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// HOME SCREEN SKELETON
// ─────────────────────────────────────────────────────────────

export const HomeScreenSkeleton: React.FC = () => (
  <View style={styles.homeContainer}>
    {/* Hero skeleton */}
    <View style={styles.heroSkeleton}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Shimmer width={200} height={28} borderRadius={6} />
          <Shimmer width={180} height={16} borderRadius={4} style={{ marginTop: 8 }} />
        </View>
        <Shimmer width={52} height={52} borderRadius={26} />
      </View>
      
      {/* Search bar skeleton */}
      <View style={styles.searchSkeleton}>
        <Shimmer width={24} height={24} borderRadius={4} />
        <Shimmer width={180} height={20} borderRadius={4} style={{ marginLeft: 12 }} />
        <Shimmer width={44} height={44} borderRadius={22} style={{ marginLeft: "auto" }} />
      </View>
      
      {/* Filters skeleton */}
      <View style={styles.filtersSkeleton}>
        {[1, 2, 3, 4].map(i => (
          <Shimmer key={i} width={100} height={36} borderRadius={18} />
        ))}
      </View>
    </View>
    
    {/* Context actions skeleton */}
    <View style={styles.contextActionsSkeleton}>
      <Shimmer width={150} height={48} borderRadius={16} />
      <Shimmer width={120} height={48} borderRadius={16} style={{ marginLeft: 10 }} />
    </View>
    
    {/* Carousel skeletons */}
    {["Recommended", "Trending", "Budget"].map((section, idx) => (
      <View key={idx} style={styles.carouselSectionSkeleton}>
        <Shimmer width={200} height={24} borderRadius={6} />
        <Shimmer width={150} height={14} borderRadius={4} style={{ marginTop: 6 }} />
        <View style={styles.horizontalListSkeleton}>
          {[1, 2, 3].map(i => (
            <DestinationCardSkeleton key={i} horizontal />
          ))}
        </View>
      </View>
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────
// MAP SKELETON
// ─────────────────────────────────────────────────────────────

export const MapSkeleton: React.FC = () => (
  <View style={styles.mapSkeleton}>
    <Shimmer width="100%" height={600} borderRadius={0} />
    <View style={styles.mapOverlay}>
      <Shimmer width={44} height={44} borderRadius={22} />
      <View style={styles.mapPills}>
        <Shimmer width={120} height={40} borderRadius={20} />
      </View>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────
// DESTINATION DETAIL SKELETON
// ─────────────────────────────────────────────────────────────

export const DestinationDetailSkeleton: React.FC = () => (
  <View style={styles.detailContainer}>
    {/* Hero skeleton */}
    <View style={styles.detailHeroSkeleton}>
      <Shimmer width="100%" height={280} borderRadius={0} />
      <View style={styles.detailHeroContent}>
        <Shimmer width={200} height={34} borderRadius={6} />
        <Shimmer width={120} height={16} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    </View>
    
    {/* Chips skeleton */}
    <View style={styles.detailChipsSkeleton}>
      <Shimmer width={100} height={32} borderRadius={16} />
      <Shimmer width={80} height={32} borderRadius={16} style={{ marginLeft: 8 }} />
      <Shimmer width={90} height={32} borderRadius={16} style={{ marginLeft: 8 }} />
    </View>
    
    {/* Highlight text skeleton */}
    <View style={styles.detailSectionSkeleton}>
      <Shimmer width="90%" height={14} borderRadius={4} />
      <Shimmer width="80%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
      <Shimmer width="60%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
    </View>
    
    {/* Weather card skeleton */}
    <View style={styles.detailSectionSkeleton}>
      <Shimmer width={150} height={20} borderRadius={6} />
      <View style={styles.weatherCardSkeleton}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Shimmer width={64} height={64} borderRadius={32} />
          <View style={{ marginLeft: 16 }}>
            <Shimmer width={80} height={28} borderRadius={6} />
            <Shimmer width={120} height={14} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        </View>
      </View>
    </View>
    
    {/* Safety skeleton */}
    <View style={styles.detailSectionSkeleton}>
      <Shimmer width={130} height={20} borderRadius={6} />
      <View style={styles.safetyCardSkeleton}>
        <Shimmer width={60} height={60} borderRadius={30} />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Shimmer width="60%" height={16} borderRadius={4} />
          <Shimmer width="80%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      </View>
    </View>
    
    {/* Gallery skeleton */}
    <View style={styles.detailSectionSkeleton}>
      <Shimmer width={120} height={20} borderRadius={6} />
      <View style={styles.gallerySkeleton}>
        <Shimmer width={220} height={150} borderRadius={12} />
        <Shimmer width={220} height={150} borderRadius={12} style={{ marginLeft: 8 }} />
        <Shimmer width={220} height={150} borderRadius={12} style={{ marginLeft: 8 }} />
      </View>
    </View>
    
    {/* Actions skeleton */}
    <View style={styles.detailActionsSkeleton}>
      <Shimmer width={44} height={44} borderRadius={22} />
      <Shimmer width={120} height={48} borderRadius={14} style={{ marginLeft: 8, flex: 1 }} />
      <Shimmer width={120} height={48} borderRadius={14} style={{ marginLeft: 8, flex: 1 }} />
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  
  // Day skeleton
  daySkeleton: {
    marginBottom: 24,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  activitySkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  
  // Stats skeleton
  statsSkeleton: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  
  // Card skeletons
  horizontalCardSkeleton: {
    width: 260,
    marginRight: 16,
  },
  verticalCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
  },
  cardContent: {
    padding: 16,
  },
  
  // Home skeleton
  homeContainer: {
    flex: 1,
  },
  heroSkeleton: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#0F172A",
  },
  searchSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    height: 64,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  filtersSkeleton: {
    flexDirection: "row",
    marginTop: 16,
    gap: 10,
  },
  contextActionsSkeleton: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  carouselSectionSkeleton: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  horizontalListSkeleton: {
    flexDirection: "row",
    marginTop: 16,
  },
  
  // Map skeleton
  mapSkeleton: {
    flex: 1,
    position: "relative",
  },
  mapOverlay: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  mapPills: {
    marginLeft: 12,
  },
  
  // Destination Detail skeleton
  detailContainer: {
    flex: 1,
  },
  detailHeroSkeleton: {
    height: 280,
    position: "relative",
  },
  detailHeroContent: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
  },
  detailChipsSkeleton: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  detailSectionSkeleton: {
    paddingHorizontal: 16,
    paddingTop: 20,
    marginBottom: 8,
  },
  weatherCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  safetyCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  gallerySkeleton: {
    flexDirection: "row",
    marginTop: 12,
  },
  detailActionsSkeleton: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
});

export default {
  Shimmer,
  ItinerarySkeleton,
  ItineraryDaySkeleton,
  DestinationCardSkeleton,
  HomeScreenSkeleton,
  MapSkeleton,
};