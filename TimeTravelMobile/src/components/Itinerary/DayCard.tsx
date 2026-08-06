/**
 * DayCard — accordion day header + its activity slots.
 */

import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { ItineraryDay } from "@/services/itinerary";
import ActivityCard from "./ActivityCard";
import type { ItineraryPalette } from "./palette";

interface Props {
  day: ItineraryDay;
  isExpanded: boolean;
  onToggle: (day: number) => void;
  onFocusMap: (day: number) => void;
  editable?: boolean;
  onEditActivity?: (day: number, slot: "morning" | "afternoon" | "evening") => void;
  palette: ItineraryPalette;
}

const DayCard: React.FC<Props> = React.memo(
  ({ day, isExpanded, onToggle, onFocusMap, editable, onEditActivity, palette }) => {
    const rotation = useSharedValue(0);

    useEffect(() => {
      rotation.value = withSpring(isExpanded ? 180 : 0);
    }, [isExpanded, rotation]);

    const arrowStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const activityCount = [day.morning, day.afternoon, day.evening].filter(
      Boolean,
    ).length;

    return (
      <View style={styles.group}>
        <Pressable
          style={styles.header}
          onPress={() => onToggle(day.day)}
          accessibilityLabel={`Day ${day.day}: ${day.title}. ${isExpanded ? "Collapse" : "Expand"} activities`}
          accessibilityRole="button"
        >
          <View style={styles.labelContainer}>
            <TouchableOpacity
              style={[styles.circle, { backgroundColor: palette.accent }]}
              onPress={() => onFocusMap(day.day)}
              accessibilityLabel={`Focus map on Day ${day.day}`}
              accessibilityRole="button"
            >
              <Text style={styles.circleText}>{day.day}</Text>
            </TouchableOpacity>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                {day.title}
              </Text>
              <Text style={[styles.subtitle, { color: palette.textMuted }]}>
                {activityCount} {activityCount === 1 ? "activity" : "activities"} planned
              </Text>
            </View>
          </View>
          <Animated.View style={arrowStyle}>
            <Text style={[styles.expand, { color: palette.textMuted }]}>▼</Text>
          </Animated.View>
        </Pressable>

        {isExpanded && (
          <Animated.View entering={FadeIn.duration(200)}>
            {(
              [
                ["morning", "🌅"],
                ["afternoon", "☀️"],
                ["evening", "🌙"],
              ] as const
            ).map(([slot, emoji], index) => (
              <ActivityCard
                key={slot}
                label={slot}
                emoji={emoji}
                activity={day[slot]}
                index={index}
                editable={editable}
                onEdit={() => onEditActivity?.(day.day, slot)}
                palette={palette}
              />
            ))}
            {day.tip ? (
              <View style={[styles.tipBox, { backgroundColor: palette.surfaceAlt }]}>
                <Text style={styles.tipIcon}>💡</Text>
                <Text style={[styles.tipText, { color: palette.textSecondary }]}>
                  {day.tip}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        )}
      </View>
    );
  },
);

DayCard.displayName = "DayCard";

const styles = StyleSheet.create({
  group: { marginBottom: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  labelContainer: { flexDirection: "row", alignItems: "center", flex: 1 },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  circleText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  titleWrap: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  expand: { fontSize: 12 },
  tipBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tipIcon: { fontSize: 16, marginRight: 8 },
  tipText: { fontSize: 13, fontWeight: "500", flex: 1 },
});

export default DayCard;