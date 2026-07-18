import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GlassCard } from "@/components/UI/GlassCard";

interface Props {
  greeting: string;
  seasonLabel: string;
  lastUpdatedLabel: string;
  isOffline: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenAssistant: () => void;
}

export const TravelStatsHeader = memo(
  ({
    greeting,
    seasonLabel,
    lastUpdatedLabel,
    isOffline,
    isRefreshing,
    onRefresh,
    onOpenAssistant,
  }: Props) => {
    return (
      <GlassCard style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <View style={styles.kickerRow}>
              <MaterialCommunityIcons
                name="map-marker-path"
                size={18}
                color="#0F766E"
              />
              <Text variant="labelMedium" style={styles.kicker}>
                Travel Intelligence
              </Text>
            </View>
            <Text variant="headlineSmall" style={styles.title}>
              {greeting}
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Your trips, money, patterns, and next best moves in one place.
            </Text>
          </View>
          <View style={styles.statusStack}>
            <Chip compact style={styles.statusChip} textStyle={styles.chipText}>
              {seasonLabel}
            </Chip>
            {isOffline ? (
              <Chip
                compact
                style={[styles.statusChip, styles.offlineChip]}
                textStyle={styles.offlineText}
              >
                Offline cache
              </Chip>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text variant="labelSmall" style={styles.metaLabel}>
              Last sync
            </Text>
            <Text variant="bodyMedium" style={styles.metaValue}>
              {lastUpdatedLabel}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <Button
              mode="outlined"
              onPress={onRefresh}
              loading={isRefreshing}
              icon="refresh"
              style={styles.actionButton}
              contentStyle={styles.buttonContent}
            >
              Refresh
            </Button>
            <Button
              mode="contained"
              onPress={onOpenAssistant}
              icon="robot"
              style={styles.actionButton}
              contentStyle={styles.buttonContent}
            >
              Ask AI
            </Button>
          </View>
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  titleBlock: {
    flex: 1,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  kicker: {
    color: "#0F766E",
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#0F172A",
    fontWeight: "800",
  },
  subtitle: {
    color: "#475569",
    marginTop: 8,
    lineHeight: 22,
  },
  statusStack: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusChip: {
    backgroundColor: "rgba(14, 165, 233, 0.12)",
  },
  chipText: {
    color: "#0369A1",
    fontWeight: "700",
  },
  offlineChip: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  offlineText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    gap: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metaValue: {
    color: "#0F172A",
    fontWeight: "700",
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    borderRadius: 14,
  },
  buttonContent: {
    height: 44,
  },
});

TravelStatsHeader.displayName = "TravelStatsHeader";
