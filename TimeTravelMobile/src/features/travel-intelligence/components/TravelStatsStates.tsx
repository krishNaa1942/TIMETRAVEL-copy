import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text } from "react-native-paper";

import { GlassCard } from "@/components/UI/GlassCard";
import { Shimmer } from "@/components/UI/SkeletonLoader";

interface EmptyProps {
  onRefresh: () => void;
}

interface ErrorProps {
  message: string;
  onRetry: () => void;
}

export const TravelStatsSkeleton = memo(() => {
  return (
    <View style={styles.skeletonWrapper}>
      <GlassCard style={styles.skeletonCard}>
        <Shimmer width={180} height={26} borderRadius={8} />
        <Shimmer
          width={260}
          height={16}
          borderRadius={6}
          style={styles.skeletonSpacing}
        />
        <View style={styles.skeletonActionRow}>
          <Shimmer width={110} height={40} borderRadius={14} />
          <Shimmer
            width={110}
            height={40}
            borderRadius={14}
            style={styles.skeletonActionGap}
          />
        </View>
      </GlassCard>

      {[1, 2, 3].map((item) => (
        <GlassCard key={item} style={styles.skeletonCard}>
          <Shimmer width={140} height={20} borderRadius={8} />
          <Shimmer
            width="100%"
            height={110}
            borderRadius={16}
            style={styles.skeletonSpacing}
          />
          <View style={styles.skeletonGrid}>
            <Shimmer width="48%" height={64} borderRadius={16} />
            <Shimmer width="48%" height={64} borderRadius={16} />
            <Shimmer width="48%" height={64} borderRadius={16} />
            <Shimmer width="48%" height={64} borderRadius={16} />
          </View>
        </GlassCard>
      ))}
    </View>
  );
});

export const TravelStatsEmptyState = memo(({ onRefresh }: EmptyProps) => {
  return (
    <GlassCard style={styles.messageCard}>
      <Text variant="headlineSmall" style={styles.messageTitle}>
        No travel history yet
      </Text>
      <Text variant="bodyMedium" style={styles.messageBody}>
        Start adding trips and destinations to unlock your travel DNA,
        predictions, and financial insights.
      </Text>
      <Button mode="contained" onPress={onRefresh} style={styles.messageButton}>
        Refresh
      </Button>
    </GlassCard>
  );
});

export const TravelStatsErrorState = memo(
  ({ message, onRetry }: ErrorProps) => {
    return (
      <GlassCard style={styles.messageCard}>
        <Text variant="headlineSmall" style={styles.messageTitle}>
          We could not load travel intelligence
        </Text>
        <Text variant="bodyMedium" style={styles.messageBody}>
          {message}
        </Text>
        <Button mode="contained" onPress={onRetry} style={styles.messageButton}>
          Try again
        </Button>
      </GlassCard>
    );
  },
);

const styles = StyleSheet.create({
  skeletonWrapper: {
    gap: 16,
  },
  skeletonCard: {
    padding: 18,
  },
  skeletonSpacing: {
    marginTop: 14,
  },
  skeletonActionRow: {
    flexDirection: "row",
    marginTop: 16,
  },
  skeletonActionGap: {
    marginLeft: 10,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  messageCard: {
    padding: 20,
    alignItems: "center",
    marginTop: 20,
  },
  messageTitle: {
    color: "#0F172A",
    fontWeight: "800",
    textAlign: "center",
  },
  messageBody: {
    color: "#475569",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
  },
  messageButton: {
    marginTop: 18,
    minWidth: 140,
  },
});

TravelStatsSkeleton.displayName = "TravelStatsSkeleton";
TravelStatsEmptyState.displayName = "TravelStatsEmptyState";
TravelStatsErrorState.displayName = "TravelStatsErrorState";
