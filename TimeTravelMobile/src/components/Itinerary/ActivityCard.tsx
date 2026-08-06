/**
 * ActivityCard — one activity slot (morning/afternoon/evening).
 * Supports tap-to-edit on a saved trip.
 */

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { SlideInRight } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ItineraryActivity } from "@/services/itinerary";
import type { ItineraryPalette } from "./palette";

interface Props {
  label: string;
  emoji: string;
  activity: ItineraryActivity | null;
  index: number;
  editable?: boolean;
  onEdit?: () => void;
  palette: ItineraryPalette;
}

const ActivityCard: React.FC<Props> = React.memo(
  ({ label, emoji, activity, index, editable, onEdit, palette }) => (
    <Animated.View
      entering={SlideInRight.delay(index * 80).springify()}
      style={[styles.card, { backgroundColor: palette.surface }]}
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: palette.accentText }]}>
          {emoji} {label}
        </Text>
        <View style={styles.headerRight}>
          {activity?.cost && activity.cost !== "0" && (
            <View style={[styles.costBadge, { backgroundColor: palette.successBg }]}>
              <Text style={[styles.cost, { color: palette.success }]}>
                ₹{activity.cost}
              </Text>
            </View>
          )}
          {editable && (
            <TouchableOpacity
              onPress={onEdit}
              style={styles.editBtn}
              accessibilityLabel={`Edit ${label} activity`}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={14}
                color={palette.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={[styles.title, { color: palette.text }]}>
        {activity?.activity || "Exploration"}
      </Text>
      {activity?.description ? (
        <Text style={[styles.desc, { color: palette.textSecondary }]} numberOfLines={2}>
          {activity.description}
        </Text>
      ) : null}
      {activity?.duration ? (
        <Text style={[styles.duration, { color: palette.textMuted }]}>
          ⏱ {activity.duration}
        </Text>
      ) : null}
    </Animated.View>
  ),
);

ActivityCard.displayName = "ActivityCard";

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  costBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cost: { fontSize: 11, fontWeight: "700" },
  editBtn: { padding: 2 },
  title: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  desc: { fontSize: 13, lineHeight: 18 },
  duration: { fontSize: 11, marginTop: 6 },
});

export default ActivityCard;