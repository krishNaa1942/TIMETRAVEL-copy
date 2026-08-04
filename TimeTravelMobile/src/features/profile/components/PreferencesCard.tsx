/**
 * PreferencesCard Component
 * Editable travel preferences synced to PUT /api/user/preferences
 */

import React, { memo, useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useUIStore } from "@/stores/uiStore";

interface PreferencesCardProps {
  preferences: Record<string, unknown>;
  onSave: (prefs: Record<string, unknown>) => Promise<void>;
}

const TRAVEL_STYLES: Array<{ value: string; label: string }> = [
  { value: "adventure", label: "Adventure" },
  { value: "relaxation", label: "Relaxation" },
  { value: "cultural", label: "Cultural" },
  { value: "business", label: "Business" },
  { value: "mixed", label: "Mixed" },
];

const BUDGET_LEVELS: Array<{ value: string; label: string }> = [
  { value: "budget", label: "Budget" },
  { value: "moderate", label: "Moderate" },
  { value: "luxury", label: "Luxury" },
];

const PreferencesCardComponent: React.FC<PreferencesCardProps> = ({
  preferences,
  onSave,
}) => {
  const { themeDark } = useUIStore();
  const [travelStyle, setTravelStyle] = useState<string>(
    (preferences?.travel_style as string) || "adventure",
  );
  const [budget, setBudget] = useState<string>(
    (preferences?.budget_preference as string) || "moderate",
  );
  const [saving, setSaving] = useState(false);

  const handleSelect = useCallback(
    async (field: "travel_style" | "budget_preference", value: string) => {
      if (field === "travel_style") setTravelStyle(value);
      else setBudget(value);
      setSaving(true);
      try {
        await onSave({ [field]: value });
      } finally {
        setSaving(false);
      }
    },
    [onSave],
  );

  const renderChips = (
    options: Array<{ value: string; label: string }>,
    selected: string,
    onSelect: (value: string) => void,
  ) => (
    <View style={styles.chipsRow}>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            disabled={saving}
            onPress={() => onSelect(option.value)}
            style={[
              styles.chip,
              themeDark && styles.chipDark,
              isSelected && styles.chipSelected,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                themeDark && styles.chipTextDark,
                isSelected && styles.chipTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Animated.View
      entering={FadeIn.delay(450).duration(400)}
      style={[styles.container, themeDark && styles.containerDark]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, themeDark && styles.eyebrowDark]}>
            Travel Preferences
          </Text>
          <Text style={[styles.title, themeDark && styles.titleDark]}>
            Tailor your recommendations
          </Text>
        </View>
        {saving && <ActivityIndicator size="small" color="#8B5CF6" />}
      </View>

      <Text style={[styles.sectionLabel, themeDark && styles.sectionLabelDark]}>
        Travel Style
      </Text>
      {renderChips(TRAVEL_STYLES, travelStyle, (v) =>
        handleSelect("travel_style", v),
      )}

      <Text
        style={[
          styles.sectionLabel,
          styles.sectionLabelSpaced,
          themeDark && styles.sectionLabelDark,
        ]}
      >
        Budget
      </Text>
      {renderChips(BUDGET_LEVELS, budget, (v) =>
        handleSelect("budget_preference", v),
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  containerDark: {
    backgroundColor: "#1F2937",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8B5CF6",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  eyebrowDark: {
    color: "#A78BFA",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  titleDark: {
    color: "#F9FAFB",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 14,
  },
  sectionLabelDark: {
    color: "#9CA3AF",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipDark: {
    backgroundColor: "#374151",
  },
  chipSelected: {
    backgroundColor: "#EDE9FE",
    borderColor: "#8B5CF6",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4B5563",
  },
  chipTextDark: {
    color: "#D1D5DB",
  },
  chipTextSelected: {
    color: "#8B5CF6",
    fontWeight: "700",
  },
});

export const PreferencesCard = memo(PreferencesCardComponent);
export default PreferencesCard;
