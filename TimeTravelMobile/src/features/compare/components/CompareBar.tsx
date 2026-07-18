import React, { memo, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Chip, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GlassCard } from "@/components/UI/GlassCard";

import type {
  ComparisonCandidateScore,
  ComparisonFactorScore,
  ComparisonFactorSpec,
} from "../types";
import { getDestinationColor } from "../utils/formatters";
import type { ComparePalette } from "../utils/formatters";

interface CompareBarProps {
  factor: ComparisonFactorSpec;
  candidates: ComparisonCandidateScore[];
  palette: ComparePalette;
}

interface CompareBarRowProps {
  candidate: ComparisonCandidateScore;
  factorScore: ComparisonFactorScore | undefined;
  index: number;
  palette: ComparePalette;
}

const CompareBarRow = memo(
  ({ candidate, factorScore, index, palette }: CompareBarRowProps) => {
    const progress = useSharedValue(0);
    const destinationColor = getDestinationColor(index);

    useEffect(() => {
      progress.value = withTiming(factorScore?.normalizedValue ?? 0, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      });
    }, [factorScore?.normalizedValue, progress]);

    const animatedBarStyle = useAnimatedStyle(() => ({
      width: `${Math.max(8, progress.value * 100)}%`,
      backgroundColor: factorScore?.isWinner ? palette.success : destinationColor,
    }));

    const animatedTrackStyle = useAnimatedStyle(() => ({
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ["rgba(148, 163, 184, 0.12)", "rgba(37, 99, 235, 0.10)"],
      ),
    }));

    return (
      <View style={styles.row}>
        <View style={styles.rowMeta}>
          <View
            style={[
              styles.swatch,
              { backgroundColor: destinationColor },
            ]}
          />
          <View style={styles.rowTextBlock}>
            <Text
              variant="labelMedium"
              style={[styles.rowLabel, { color: palette.text }]}
              numberOfLines={1}
            >
              {candidate.destination.label}
            </Text>
            <Text
              variant="bodySmall"
              style={[styles.rowSubtext, { color: palette.muted }]}
              numberOfLines={1}
            >
              {factorScore?.formattedValue ?? "N/A"}
            </Text>
          </View>
        </View>

        <View style={styles.barColumn}>
          <Animated.View style={[styles.track, animatedTrackStyle]}>
            <Animated.View style={[styles.fill, animatedBarStyle]} />
          </Animated.View>
          <View style={styles.noteRow}>
            <Text
              variant="bodySmall"
              style={[styles.noteText, { color: palette.muted }]}
              numberOfLines={2}
            >
              {factorScore?.note ?? "No factor note available."}
            </Text>
            {factorScore?.isWinner ? (
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={palette.success}
              />
            ) : null}
          </View>
        </View>
      </View>
    );
  },
);

CompareBarRow.displayName = "CompareBarRow";

export const CompareBar = memo(
  ({ factor, candidates, palette }: CompareBarProps) => {
    return (
      <GlassCard
        style={[
          styles.card,
          {
            backgroundColor: palette.surfaceElevated,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View
            style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}
          >
            <MaterialCommunityIcons
              name={factor.icon as never}
              size={18}
              color={palette.accent}
            />
          </View>
          <View style={styles.headerTextBlock}>
            <Text
              variant="titleMedium"
              style={[styles.title, { color: palette.text }]}
            >
              {factor.label}
            </Text>
            <Text
              variant="bodySmall"
              style={[styles.subtitle, { color: palette.muted }]}
            >
              {factor.description}
            </Text>
          </View>
        </View>

        <View style={styles.rows}>
          {candidates.map((candidate, index) => (
            <CompareBarRow
              key={candidate.destination.id}
              candidate={candidate}
              factorScore={candidate.factorScores.find(
                (score) => score.key === factor.key,
              )}
              index={index}
              palette={palette}
            />
          ))}
        </View>
      </GlassCard>
    );
  },
);

CompareBar.displayName = "CompareBar";

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 22,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontWeight: "800",
  },
  subtitle: {
    lineHeight: 19,
  },
  rows: {
    gap: 10,
  },
  row: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(148, 163, 184, 0.04)",
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  rowTextBlock: {
    flex: 1,
  },
  rowLabel: {
    fontWeight: "700",
  },
  rowSubtext: {
    marginTop: 2,
  },
  barColumn: {
    gap: 8,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  noteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  noteText: {
    flex: 1,
    lineHeight: 17,
  },
});
