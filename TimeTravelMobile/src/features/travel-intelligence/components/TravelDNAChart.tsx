import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

import { GlassCard } from "@/components/UI/GlassCard";
import type { TravelDNA } from "../types";
import { formatPercent } from "../utils";

interface Props {
  dna: TravelDNA;
  accentColor?: string;
}

const metrics = [
  { key: "explorer", label: "Explorer" },
  { key: "luxury", label: "Luxury" },
  { key: "budget", label: "Budget" },
  { key: "foodie", label: "Foodie" },
  { key: "adventure", label: "Adventure" },
  { key: "culture", label: "Culture" },
  { key: "relax", label: "Relax" },
  { key: "social", label: "Social" },
  { key: "planner", label: "Planner" },
  { key: "spontaneous", label: "Spontaneous" },
] as const;

export const TravelDNAChart = memo(
  ({ dna, accentColor = "#14B8A6" }: Props) => {
    return (
      <GlassCard style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text variant="titleMedium" style={styles.title}>
              Travel DNA
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              Your personality signals across travel behavior
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {metrics.map((metric) => {
            const value = Math.max(0, Math.min(100, dna[metric.key]));

            return (
              <View key={metric.key} style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text variant="labelMedium" style={styles.metricLabel}>
                    {metric.label}
                  </Text>
                  <Text variant="labelMedium" style={styles.metricValue}>
                    {formatPercent(value)}
                  </Text>
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${value}%`, backgroundColor: accentColor },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </GlassCard>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    padding: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    color: "#64748B",
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%",
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricLabel: {
    color: "#1E293B",
  },
  metricValue: {
    color: "#0F172A",
    fontWeight: "700",
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    marginTop: 10,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});

TravelDNAChart.displayName = "TravelDNAChart";
