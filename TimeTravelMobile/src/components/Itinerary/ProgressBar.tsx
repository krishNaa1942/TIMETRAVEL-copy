/**
 * ProgressBar — animated generation progress indicator.
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { ItineraryPalette } from "./palette";

const STEP_LABELS: Record<string, string> = {
  starting: "Starting…",
  queued: "Queued…",
  running: "AI is planning your trip…",
  planning_day_1: "Planning day 1…",
  planning_day_2: "Planning day 2…",
  planning_day_3: "Planning day 3…",
  planning_day_4: "Planning day 4…",
  planning_day_5: "Planning day 5…",
  planning_day_6: "Planning day 6…",
  planning_day_7: "Planning day 7…",
  planning_day_8: "Planning day 8…",
  planning_day_9: "Planning day 9…",
  planning_day_10: "Planning day 10…",
  planning_day_11: "Planning day 11…",
  planning_day_12: "Planning day 12…",
  planning_day_13: "Planning day 13…",
  planning_day_14: "Planning day 14…",
  finalizing: "Finalizing…",
  complete: "Complete!",
  idle: "Ready",
  cancelled: "Cancelled",
  cancelling: "Cancelling…",
  error: "Something went wrong",
};

interface Props {
  progress: number;
  step: string;
  palette: ItineraryPalette;
}

const ProgressBar: React.FC<Props> = ({ progress, step, palette }) => {
  const progressValue = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withTiming(Math.min(progress, 100), { duration: 400 });
  }, [progress, progressValue]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value}%`,
  }));

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: palette.track }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: palette.accent }, fillStyle]}
        />
      </View>
      <Text style={[styles.label, { color: palette.textSecondary }]}>
        {STEP_LABELS[step] || step || "Working…"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: "center", width: "100%" },
  track: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 2 },
  label: { fontSize: 11, marginTop: 6, fontWeight: "600" },
});

export default ProgressBar;