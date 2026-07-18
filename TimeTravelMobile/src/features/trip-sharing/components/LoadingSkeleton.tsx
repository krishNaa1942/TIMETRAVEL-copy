import React, { memo, useEffect, useRef } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { colors, spacing } from "@/theme/colors";

type LoadingSkeletonVariant = "trips" | "shares";

interface LoadingSkeletonProps {
  variant: LoadingSkeletonVariant;
  count?: number;
}

interface SkeletonBlockProps {
  style?: StyleProp<ViewStyle>;
}

const SkeletonBlock = memo(({ style }: SkeletonBlockProps) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, style, { opacity }]} />;
});

SkeletonBlock.displayName = "SkeletonBlock";

const TripSkeletonCard = memo(() => (
  <View style={styles.tripSkeletonCard}>
    <SkeletonBlock style={styles.tripSkeletonTitle} />
    <SkeletonBlock style={styles.tripSkeletonSubtitle} />
  </View>
));

TripSkeletonCard.displayName = "TripSkeletonCard";

const ShareSkeletonCard = memo(() => (
  <View style={styles.shareSkeletonCard}>
    <View style={styles.shareSkeletonTopRow}>
      <View style={styles.shareSkeletonContent}>
        <SkeletonBlock style={styles.shareSkeletonTitle} />
        <SkeletonBlock style={styles.shareSkeletonSubtitle} />
        <SkeletonBlock style={styles.shareSkeletonSubtitleShort} />
      </View>
      <SkeletonBlock style={styles.shareSkeletonQr} />
    </View>
    <View style={styles.shareSkeletonActions}>
      <SkeletonBlock style={styles.shareSkeletonAction} />
      <SkeletonBlock style={styles.shareSkeletonAction} />
      <SkeletonBlock style={styles.shareSkeletonAction} />
    </View>
  </View>
));

ShareSkeletonCard.displayName = "ShareSkeletonCard";

export const LoadingSkeleton = memo(
  ({ variant, count = 3 }: LoadingSkeletonProps) => {
    if (variant === "trips") {
      return (
        <View style={styles.tripSkeletonList} accessibilityRole="progressbar">
          {Array.from({ length: count }).map((_, index) => (
            <TripSkeletonCard key={`trip-skeleton-${index}`} />
          ))}
        </View>
      );
    }

    return (
      <View style={styles.shareSkeletonList} accessibilityRole="progressbar">
        {Array.from({ length: count }).map((_, index) => (
          <ShareSkeletonCard key={`share-skeleton-${index}`} />
        ))}
      </View>
    );
  },
);

LoadingSkeleton.displayName = "LoadingSkeleton";

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.border,
    borderRadius: 12,
  },
  tripSkeletonList: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tripSkeletonCard: {
    width: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(229, 231, 235, 0.85)",
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tripSkeletonTitle: {
    width: "72%",
    height: 18,
  },
  tripSkeletonSubtitle: {
    width: "48%",
    height: 12,
  },
  shareSkeletonList: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  shareSkeletonCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(229, 231, 235, 0.85)",
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  shareSkeletonTopRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  shareSkeletonContent: {
    flex: 1,
    gap: spacing.sm,
  },
  shareSkeletonTitle: {
    width: "84%",
    height: 18,
  },
  shareSkeletonSubtitle: {
    width: "66%",
    height: 12,
  },
  shareSkeletonSubtitleShort: {
    width: "48%",
    height: 12,
  },
  shareSkeletonQr: {
    width: 84,
    height: 84,
    borderRadius: 16,
  },
  shareSkeletonActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  shareSkeletonAction: {
    flex: 1,
    height: 36,
    borderRadius: 12,
  },
});
