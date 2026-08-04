/**
 * AchievementsCard Component
 * Displays earned / locked badges from the backend
 */

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useUIStore } from "@/stores/uiStore";
import type { AchievementBadge } from "../types";

interface AchievementsCardProps {
  achievements: AchievementBadge[];
}

const BADGE_CONFIG: Record<
  string,
  { icon: string; label: string; hint: string }
> = {
  "first-trip": { icon: "airplane", label: "First Trip", hint: "Create a trip" },
  "trip-master": { icon: "trophy", label: "Trip Master", hint: "5+ trips" },
  "destination-explorer": {
    icon: "map-marker-radius",
    label: "Explorer",
    hint: "10+ places visited",
  },
  "budget-tracker": { icon: "wallet", label: "Budget Tracker", hint: "Track spending" },
  "photo-enthusiast": { icon: "camera", label: "Photo Enthusiast", hint: "Upload a photo" },
};

const ALL_BADGE_IDS = Object.keys(BADGE_CONFIG);

const AchievementsCardComponent: React.FC<AchievementsCardProps> = ({
  achievements,
}) => {
  const { themeDark } = useUIStore();
  const earnedIds = new Set(achievements.map((b) => b.id));
  const earnedCount = ALL_BADGE_IDS.filter((id) => earnedIds.has(id)).length;

  return (
    <Animated.View
      entering={FadeIn.delay(400).duration(400)}
      style={[styles.container, themeDark && styles.containerDark]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, themeDark && styles.eyebrowDark]}>
            Achievements
          </Text>
          <Text style={[styles.title, themeDark && styles.titleDark]}>
            {earnedCount} of {ALL_BADGE_IDS.length} unlocked
          </Text>
        </View>
      </View>

      <View style={styles.badgesContainer}>
        {ALL_BADGE_IDS.map((id) => {
          const config = BADGE_CONFIG[id];
          const earned = earnedIds.has(id);
          return (
            <View
              key={id}
              style={[
                styles.badge,
                themeDark && styles.badgeDark,
                !earned && styles.badgeLocked,
              ]}
            >
              <View
                style={[
                  styles.badgeIcon,
                  !earned && styles.badgeIconLocked,
                ]}
              >
                <MaterialCommunityIcons
                  name={(earned ? config.icon : "lock-outline") as any}
                  size={22}
                  color={earned ? "#8B5CF6" : "#9CA3AF"}
                />
              </View>
              <Text
                style={[
                  styles.badgeLabel,
                  themeDark && styles.badgeLabelDark,
                  !earned && styles.badgeLabelLocked,
                ]}
                numberOfLines={1}
              >
                {config.label}
              </Text>
              <Text
                style={[styles.badgeHint, !earned && styles.badgeHintLocked]}
                numberOfLines={1}
              >
                {earned ? "Unlocked" : config.hint}
              </Text>
            </View>
          );
        })}
      </View>
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
    marginBottom: 14,
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
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F3F0FF",
  },
  badgeDark: {
    backgroundColor: "#2D3748",
  },
  badgeLocked: {
    backgroundColor: "#F3F4F6",
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  badgeIconLocked: {
    backgroundColor: "#E5E7EB",
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  badgeLabelDark: {
    color: "#F9FAFB",
  },
  badgeLabelLocked: {
    color: "#6B7280",
  },
  badgeHint: {
    fontSize: 10,
    color: "#8B5CF6",
    marginTop: 2,
  },
  badgeHintLocked: {
    color: "#9CA3AF",
  },
});

export const AchievementsCard = memo(AchievementsCardComponent);
export default AchievementsCard;
