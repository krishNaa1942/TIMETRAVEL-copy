/**
 * ExploreSkeleton — Premium shimmer loading state
 */

import React from "react";
import { View, StatusBar, StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Shimmer } from "@/components/UI/SkeletonLoader";
import { spacing } from "@/theme/colors";
import { getColumnCount, getCardWidth } from "../utils/responsive";

const ExploreSkeleton: React.FC = () => {
  const { width } = useWindowDimensions();
  const cols = getColumnCount(width);
  const cardW = getCardWidth(width, cols);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        {/* Title skeleton */}
        <Shimmer width={140} height={34} borderRadius={8} />
        <Shimmer width={200} height={14} borderRadius={6} style={{ marginTop: 6 }} />

        {/* Search bar skeleton */}
        <Shimmer width="100%" height={52} borderRadius={16} style={{ marginTop: 16 }} />

        {/* Category pills skeleton */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Shimmer key={i} width={90} height={40} borderRadius={24} />
          ))}
        </View>
      </View>

      {/* Insight section skeleton */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <Shimmer width={160} height={18} borderRadius={6} />
        <Shimmer width={120} height={13} borderRadius={4} style={{ marginTop: 6 }} />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          {[1, 2, 3].map((i) => (
            <Shimmer key={i} width={260} height={220} borderRadius={16} />
          ))}
        </View>
      </View>

      {/* Grid skeleton */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <Shimmer width={180} height={20} borderRadius={6} />
          <Shimmer width={60} height={14} borderRadius={4} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {Array.from({ length: cols * 2 }).map((_, i) => (
            <View key={i} style={{ width: cardW }}>
              <Shimmer width={cardW} height={180} borderRadius={16} />
              <Shimmer width={cardW * 0.7} height={17} borderRadius={6} style={{ marginTop: 12 }} />
              <Shimmer width={cardW * 0.5} height={13} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ExploreSkeleton;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
});
