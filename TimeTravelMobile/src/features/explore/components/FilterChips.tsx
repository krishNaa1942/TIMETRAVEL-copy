/**
 * FilterChips — Horizontal filter bar for budget, duration, vibe, season
 */

import React, { memo } from "react";
import { View, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { PressableScale } from "@/components/UI/PressableScale";
import { FilterState } from "../utils/scoring";
import { CURRENT_SEASON } from "../constants/categories";
import { colors, spacing } from "@/theme/colors";

interface FilterChipsProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
}

const FILTER_CONFIGS = [
  {
    key: "budget" as keyof FilterState,
    icon: "currency-inr",
    label: "Budget",
    activeValue: "budget",
  },
  {
    key: "duration" as keyof FilterState,
    icon: "clock-outline",
    label: "Duration",
    activeValue: "weekend",
  },
  {
    key: "vibe" as keyof FilterState,
    icon: "heart-outline",
    label: "Vibe",
    activeValue: "adventure",
  },
  {
    key: "season" as keyof FilterState,
    icon: "weather-sunny",
    label: "Season",
    activeValue: CURRENT_SEASON,
  },
];

const FilterChips = memo(({ filters, onFilterChange }: FilterChipsProps) => {
  const activeCount = Object.values(filters).filter((v) => v !== "all").length;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {FILTER_CONFIGS.map((cfg) => {
          const isActive = filters[cfg.key] !== "all";
          return (
            <PressableScale
              key={cfg.key}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() =>
                onFilterChange(cfg.key, isActive ? "all" : cfg.activeValue)
              }
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${cfg.label}`}
              accessibilityState={{ selected: isActive }}
            >
              <MaterialCommunityIcons
                name={cfg.icon as any}
                size={14}
                color={isActive ? "#FFF" : colors.textSecondary}
              />
              <Text
                style={[styles.chipText, isActive && { color: "#FFF" }]}
              >
                {isActive ? filters[cfg.key] : cfg.label}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {activeCount > 0 && (
        <TouchableOpacity
          style={styles.clear}
          onPress={() => {
            onFilterChange("budget", "all");
            onFilterChange("duration", "all");
            onFilterChange("vibe", "all");
            onFilterChange("season", "all");
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
        >
          <MaterialCommunityIcons
            name="close-circle"
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
});
FilterChips.displayName = "FilterChips";

export default FilterChips;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  scroll: {
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  chipActive: {
    backgroundColor: colors.darkBackground,
    borderColor: colors.darkBackground,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  clear: {
    padding: 8,
    marginLeft: 8,
  },
});
