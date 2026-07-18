/**
 * 🎨 SCREEN SKELETON LOADER
 * Animated skeleton UI for navigation transitions
 */

import React, { memo, useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions, Platform } from "react-native";

const { width } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────
// SHIMMER EFFECT
// ─────────────────────────────────────────────────────────────

function Shimmer({
  width: w,
  height,
  borderRadius,
}: {
  width: number;
  height: number;
  borderRadius?: number;
}) {
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver,
        }),
      ]),
    ).start();
  }, [shimmerValue, useNativeDriver]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.shimmer,
        { width: w, height, borderRadius: borderRadius || 8, opacity },
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// SCREEN SKELETON LOADER
// ─────────────────────────────────────────────────────────────

export const ScreenSkeletonLoader = memo(function ScreenSkeletonLoader() {
  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <Shimmer width={40} height={40} borderRadius={20} />
        <View style={styles.headerContent}>
          <Shimmer width={150} height={16} />
          <Shimmer width={100} height={12} />
        </View>
      </View>

      {/* Content Skeleton */}
      <View style={styles.content}>
        {/* Card Skeletons */}
        <View style={styles.cardRow}>
          <Shimmer width={(width - 48) / 2} height={120} />
          <Shimmer width={(width - 48) / 2} height={120} />
        </View>

        {/* List Skeletons */}
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.listItem}>
            <Shimmer width={60} height={60} borderRadius={12} />
            <View style={styles.listItemContent}>
              <Shimmer width={200} height={14} />
              <Shimmer width={150} height={10} />
            </View>
          </View>
        ))}

        {/* Featured Card */}
        <Shimmer width={width - 32} height={180} borderRadius={16} />
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  shimmer: {
    backgroundColor: "#1E293B",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  headerContent: {
    gap: 8,
  },
  content: {
    flex: 1,
    gap: 16,
  },
  cardRow: {
    flexDirection: "row",
    gap: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  listItemContent: {
    flex: 1,
    gap: 8,
  },
});

export default ScreenSkeletonLoader;
