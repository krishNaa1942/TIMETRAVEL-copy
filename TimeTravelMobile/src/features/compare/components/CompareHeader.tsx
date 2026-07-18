import React, { memo, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GlassCard } from "@/components/UI/GlassCard";
import { PressableScale } from "@/components/UI/PressableScale";

import {
  formatDataSource,
  formatPriority,
  formatTravelClass,
} from "../utils/formatters";
import type { ComparisonDataSource, ComparisonPriority } from "../types";
import type { ComparePalette } from "../utils/formatters";

interface CompareHeaderProps {
  selectedCount: number;
  maxDestinations: number;
  priority: ComparisonPriority;
  days: number;
  familySize: number;
  travelClass: string;
  source: ComparisonDataSource | null;
  lastUpdatedLabel: string;
  isOffline: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSwap: () => void;
  onPriorityChange: (priority: ComparisonPriority) => void;
  palette: ComparePalette;
}

interface PriorityPillProps {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  palette: ComparePalette;
}

const PRIORITIES: Array<{
  value: ComparisonPriority;
  label: string;
  icon: string;
}> = [
  { value: "balanced", label: "Balanced", icon: "scale-balance" },
  { value: "budget", label: "Budget", icon: "cash-multiple" },
  { value: "safety", label: "Safety", icon: "shield-check" },
  { value: "weather", label: "Weather", icon: "weather-partly-cloudy" },
  { value: "crowd", label: "Crowd", icon: "account-group-outline" },
  { value: "experience", label: "Experience", icon: "star" },
] as const;

const PriorityPill = memo(
  ({ label, icon, active, onPress, palette }: PriorityPillProps) => (
    <PressableScale
      onPress={onPress}
      style={[
        styles.priorityPill,
        active && {
          backgroundColor: palette.accentSoft,
          borderColor: palette.accent,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={icon as never}
        size={14}
        color={active ? palette.accent : palette.muted}
      />
      <Text
        style={[
          styles.priorityLabel,
          { color: active ? palette.accent : palette.muted },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  ),
);

PriorityPill.displayName = "PriorityPill";

export const CompareHeader = memo(
  ({
    selectedCount,
    maxDestinations,
    priority,
    days,
    familySize,
    travelClass,
    source,
    lastUpdatedLabel,
    isOffline,
    isRefreshing,
    onRefresh,
    onSwap,
    onPriorityChange,
    palette,
  }: CompareHeaderProps) => {
    const priorityPills = useMemo(
      () =>
        PRIORITIES.map((option) => ({
          ...option,
          onPress: () => onPriorityChange(option.value),
        })),
      [onPriorityChange],
    );

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
          <View style={styles.titleBlock}>
            <Chip
              compact
              style={[
                styles.kickerChip,
                { backgroundColor: palette.accentSoft },
              ]}
              textStyle={{ color: palette.accent }}
            >
              AI Decision Engine
            </Chip>
            <Text
              variant="headlineSmall"
              style={[styles.title, { color: palette.text }]}
            >
              Compare destinations with confidence
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.subtitle, { color: palette.muted }]}
            >
              Multi-factor scoring across cost, safety, weather, crowd pressure,
              seasonality, and travel experience.
            </Text>
          </View>

          <View style={styles.statusStack}>
            <Chip
              compact
              style={[
                styles.statusChip,
                { backgroundColor: palette.accentSoft },
              ]}
              textStyle={{ color: palette.accent }}
            >
              {selectedCount}/{maxDestinations}
            </Chip>
            <Chip
              compact
              style={[
                styles.statusChip,
                isOffline && { backgroundColor: `${palette.danger}20` },
              ]}
              textStyle={{ color: isOffline ? palette.danger : palette.muted }}
            >
              {isOffline ? "Offline" : formatDataSource(source)}
            </Chip>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text
              variant="labelSmall"
              style={[styles.metaLabel, { color: palette.muted }]}
            >
              Trip window
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.metaValue, { color: palette.text }]}
            >
              {days} days · {familySize} travelers ·{" "}
              {formatTravelClass(travelClass)}
            </Text>
          </View>
          <View style={styles.metaItemRight}>
            <Text
              variant="labelSmall"
              style={[styles.metaLabel, { color: palette.muted }]}
            >
              Updated
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.metaValue, { color: palette.text }]}
            >
              {lastUpdatedLabel}
            </Text>
          </View>
        </View>

        <View style={styles.priorityRow}>
          {priorityPills.map((option) => (
            <PriorityPill
              key={option.value}
              label={formatPriority(option.value)}
              icon={option.icon}
              active={priority === option.value}
              onPress={option.onPress}
              palette={palette}
            />
          ))}
        </View>

        <View style={styles.actionsRow}>
          <Button
            mode="outlined"
            icon="swap-horizontal"
            onPress={onSwap}
            disabled={selectedCount < 2}
            style={styles.actionButton}
          >
            Swap top two
          </Button>
          <Button
            mode="contained"
            icon="refresh"
            loading={isRefreshing}
            onPress={onRefresh}
            buttonColor={palette.accent}
            textColor="#FFF"
            style={styles.actionButton}
          >
            Refresh analysis
          </Button>
        </View>
      </GlassCard>
    );
  },
);

CompareHeader.displayName = "CompareHeader";

const styles = StyleSheet.create({
  card: {
    padding: 18,
    marginBottom: 16,
    borderRadius: 24,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  titleBlock: {
    flex: 1,
    gap: 8,
  },
  kickerChip: {
    alignSelf: "flex-start",
  },
  title: {
    fontWeight: "900",
  },
  subtitle: {
    lineHeight: 22,
  },
  statusStack: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusChip: {
    borderRadius: 999,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
  },
  metaItem: {
    flex: 1,
  },
  metaItemRight: {
    alignItems: "flex-end",
    flex: 1,
  },
  metaLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metaValue: {
    fontWeight: "700",
    marginTop: 2,
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
  },
  priorityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
  },
  priorityLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  actionButton: {
    borderRadius: 16,
    flex: 1,
  },
});
