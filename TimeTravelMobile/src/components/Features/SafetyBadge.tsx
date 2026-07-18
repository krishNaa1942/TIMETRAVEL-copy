/**
 * SafetyBadge – circular safety score indicator
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { SafetyData } from "@/types";
import { colors, spacing } from "@/theme/colors";

interface Props {
  safety: SafetyData;
}

function scoreColor(score: number): string {
  if (score >= 8) return colors.success;
  if (score >= 6) return colors.warning;
  return colors.error;
}

export default function SafetyBadge({ safety }: Props) {
  const color = scoreColor(safety.overall_score);

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { borderColor: color }]}>
        <Text style={[styles.score, { color }]}>
          {safety.overall_score.toFixed(1)}
        </Text>
        <Text style={styles.label}>/ 10</Text>
      </View>

      <View style={styles.details}>
        <Row label="Crime" score={safety.crime_score} />
        <Row label="Health" score={safety.health_score} />
        <Row label="Infrastructure" score={safety.infrastructure_score} />
        <Row label="Tourist Friendly" score={safety.tourist_friendliness} />
      </View>

      <Text style={styles.advisory}>{safety.advisory}</Text>
    </View>
  );
}

function Row({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.barContainer}>
        <View
          style={[
            styles.bar,
            {
              width: `${score * 10}%`,
              backgroundColor: scoreColor(score),
            },
          ]}
        />
      </View>
      <Text style={styles.rowScore}>{score.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  score: {
    fontSize: 24,
    fontWeight: "800",
  },
  label: {
    fontSize: 11,
    color: colors.gray,
  },
  details: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 3,
  },
  rowLabel: {
    width: 110,
    fontSize: 13,
    color: colors.text,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: spacing.sm,
  },
  bar: {
    height: "100%",
    borderRadius: 4,
  },
  rowScore: {
    width: 30,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },
  advisory: {
    fontSize: 13,
    color: colors.gray,
    fontStyle: "italic",
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
