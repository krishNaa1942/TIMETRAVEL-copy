import React, { memo } from "react";
import { View, StyleSheet } from "react-native";

import { GlassCard } from "@/components/UI/GlassCard";
import { Shimmer } from "@/components/UI/SkeletonLoader";

export const CompareSkeleton = memo(() => {
  return (
    <View style={styles.container}>
      <GlassCard style={styles.card}>
        <Shimmer width={220} height={28} borderRadius={8} />
        <Shimmer
          width={280}
          height={16}
          borderRadius={6}
          style={styles.spacing}
        />
        <View style={styles.pillRow}>
          <Shimmer width={100} height={32} borderRadius={16} />
          <Shimmer width={90} height={32} borderRadius={16} />
          <Shimmer width={110} height={32} borderRadius={16} />
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Shimmer width={160} height={22} borderRadius={6} />
        <Shimmer
          width="100%"
          height={220}
          borderRadius={20}
          style={styles.spacing}
        />
      </GlassCard>

      {[1, 2, 3, 4].map((item) => (
        <GlassCard key={item} style={styles.card}>
          <Shimmer width={170} height={22} borderRadius={6} />
          <Shimmer
            width={240}
            height={14}
            borderRadius={6}
            style={styles.spacing}
          />
          <Shimmer
            width="100%"
            height={12}
            borderRadius={999}
            style={styles.barSpacing}
          />
          <Shimmer
            width="82%"
            height={12}
            borderRadius={999}
            style={styles.barSpacing}
          />
          <Shimmer
            width="68%"
            height={12}
            borderRadius={999}
            style={styles.barSpacing}
          />
        </GlassCard>
      ))}
    </View>
  );
});

CompareSkeleton.displayName = "CompareSkeleton";

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  card: {
    padding: 16,
    borderRadius: 22,
  },
  spacing: {
    marginTop: 12,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  barSpacing: {
    marginTop: 10,
  },
});
