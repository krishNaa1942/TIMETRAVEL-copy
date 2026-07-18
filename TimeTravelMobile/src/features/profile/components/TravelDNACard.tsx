/**
 * TravelDNACard Component
 * Displays user travel personality traits with progress bars
 */

import React, { memo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useUIStore } from "@/stores/uiStore";
import { PERSONALITY_CONFIG } from "../utils/profileHelpers";
import type { TravelDNACardProps, TravelTrait } from "../types";

const TravelDNACardComponent: React.FC<TravelDNACardProps> = ({
  dna,
  personality,
}) => {
  const { themeDark } = useUIStore();

  const traits: TravelTrait[] = [
    "explorer",
    "foodie",
    "luxury",
    "adventure",
    "culture",
    "relaxation",
    "budget",
    "social",
  ];

  return (
    <Animated.View
      entering={FadeIn.delay(300).duration(400)}
      style={[styles.container, themeDark && styles.containerDark]}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{personality.icon}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, themeDark && styles.eyebrowDark]}>
            Travel Profile
          </Text>
          <Text style={[styles.title, themeDark && styles.titleDark]}>
            {personality.label}
          </Text>
          <Text
            style={[styles.description, themeDark && styles.descriptionDark]}
          >
            {personality.description}
          </Text>
        </View>
      </View>

      <View style={styles.traitsContainer}>
        {traits.map((trait) => {
          const config = PERSONALITY_CONFIG[trait];
          const value = dna[trait] || 0;
          return (
            <View key={trait} style={styles.traitRow}>
              <View style={styles.traitHeader}>
                <Text style={styles.traitIcon}>{config.icon}</Text>
                <Text
                  style={[
                    styles.traitLabel,
                    themeDark && styles.traitLabelDark,
                  ]}
                >
                  {config.label}
                </Text>
                <Text
                  style={[
                    styles.traitValue,
                    themeDark && styles.traitValueDark,
                  ]}
                >
                  {value}%
                </Text>
              </View>
              <View style={[styles.traitBar, themeDark && styles.traitBarDark]}>
                <View
                  style={[
                    styles.traitFill,
                    { width: `${value}%`, backgroundColor: config.color },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
};

const cardShadow =
  Platform.select({
    web: {
      boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
    } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
  }) ?? {};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    ...cardShadow,
  },
  containerDark: { backgroundColor: "#1F2937" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  icon: { fontSize: 32, marginRight: 12 },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  eyebrowDark: { color: "#9CA3AF" },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  titleDark: { color: "#F9FAFB" },
  description: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  descriptionDark: { color: "#9CA3AF" },
  traitsContainer: { gap: 10 },
  traitRow: {},
  traitHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  traitIcon: { fontSize: 14, marginRight: 6 },
  traitLabel: { flex: 1, fontSize: 12, color: "#374151", fontWeight: "500" },
  traitLabelDark: { color: "#D1D5DB" },
  traitValue: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  traitValueDark: { color: "#9CA3AF" },
  traitBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  traitBarDark: { backgroundColor: "#374151" },
  traitFill: { height: "100%", borderRadius: 2 },
});

export const TravelDNACard = memo(TravelDNACardComponent);
export default TravelDNACard;
