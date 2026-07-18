import React, { memo, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Chip, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GlassCard } from "@/components/UI/GlassCard";

import type { ComparisonAnalysis } from "../types";
import {
  formatConfidence,
  formatScore,
  getDestinationColor,
} from "../utils/formatters";
import type { ComparePalette } from "../utils/formatters";

interface WinnerBannerProps {
  analysis: ComparisonAnalysis;
  palette: ComparePalette;
}

export const WinnerBanner = memo(({ analysis, palette }: WinnerBannerProps) => {
  const winner = analysis.winner;

  const highlightChips = useMemo(
    () => winner?.highlights.slice(0, 3) ?? [],
    [winner],
  );

  if (!winner) {
    return null;
  }

  const winnerColor = getDestinationColor(0);

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
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: `${winnerColor}18` }]}>
          <MaterialCommunityIcons name="trophy" size={24} color={winnerColor} />
        </View>

        <View style={styles.titleBlock}>
          <Chip
            compact
            style={[
              styles.overallChip,
              { backgroundColor: palette.accentSoft },
            ]}
            textStyle={{ color: palette.accent }}
          >
            Best overall fit
          </Chip>
          <Text
            variant="headlineSmall"
            style={[styles.title, { color: palette.text }]}
          >
            {winner.destination.label}
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: palette.muted }]}
          >
            {analysis.summary.explanation}
          </Text>
        </View>

        <View style={styles.scoreBlock}>
          <Text
            variant="headlineMedium"
            style={[styles.scoreValue, { color: palette.text }]}
          >
            {Math.round(winner.totalScore)}
          </Text>
          <Text
            variant="labelSmall"
            style={[styles.scoreLabel, { color: palette.muted }]}
          >
            Score
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text
            variant="labelSmall"
            style={[styles.metricLabel, { color: palette.muted }]}
          >
            Confidence
          </Text>
          <Text
            variant="titleMedium"
            style={[styles.metricValue, { color: palette.text }]}
          >
            {formatConfidence(analysis.confidence)}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text
            variant="labelSmall"
            style={[styles.metricLabel, { color: palette.muted }]}
          >
            Source
          </Text>
          <Text
            variant="titleMedium"
            style={[styles.metricValue, { color: palette.text }]}
          >
            {analysis.source}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text
            variant="labelSmall"
            style={[styles.metricLabel, { color: palette.muted }]}
          >
            Partial data
          </Text>
          <Text
            variant="titleMedium"
            style={[styles.metricValue, { color: palette.text }]}
          >
            {analysis.hasPartialData ? "Yes" : "No"}
          </Text>
        </View>
      </View>

      <View style={styles.reasoningBox}>
        <Text
          variant="labelSmall"
          style={[styles.reasoningLabel, { color: palette.muted }]}
        >
          Why it wins
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.reasoningText, { color: palette.text }]}
        >
          {analysis.reasoning}
        </Text>
      </View>

      {highlightChips.length > 0 ? (
        <View style={styles.chipRow}>
          {highlightChips.map((highlight) => (
            <Chip
              key={highlight}
              compact
              style={[
                styles.highlightChip,
                { backgroundColor: palette.accentSoft },
              ]}
              textStyle={{ color: palette.accent }}
            >
              {highlight}
            </Chip>
          ))}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text variant="bodySmall" style={{ color: palette.muted }}>
          {formatScore(winner.totalScore, 100)} total weighted score
        </Text>
        <Text variant="bodySmall" style={{ color: palette.muted }}>
          {analysis.summary.selectedCount} destinations compared
        </Text>
      </View>
    </GlassCard>
  );
});

WinnerBanner.displayName = "WinnerBanner";

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 24,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    flex: 1,
    gap: 8,
  },
  overallChip: {
    alignSelf: "flex-start",
  },
  title: {
    fontWeight: "900",
  },
  subtitle: {
    lineHeight: 22,
  },
  scoreBlock: {
    alignItems: "center",
    minWidth: 64,
  },
  scoreValue: {
    fontWeight: "900",
  },
  scoreLabel: {
    marginTop: -2,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metricItem: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  metricLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    fontWeight: "800",
    marginTop: 4,
  },
  reasoningBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(37, 99, 235, 0.06)",
  },
  reasoningLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  reasoningText: {
    marginTop: 6,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  highlightChip: {
    borderRadius: 999,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
  },
});
