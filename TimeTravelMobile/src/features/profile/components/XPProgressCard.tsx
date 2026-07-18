/**
 * XPProgressCard Component
 * Displays user XP progress with animated progress bar
 */

import React, { memo, useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
} from "react-native-reanimated";
import { useUIStore } from "@/stores/uiStore";
import type { XPProgressCardProps } from "../types";

const XPProgressCardComponent: React.FC<XPProgressCardProps> = ({
  level,
  animated = true,
}) => {
  const { themeDark } = useUIStore();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      progress.value = withSpring(level.progress / 100, {
        damping: 15,
        stiffness: 80,
      });
    } else {
      progress.value = level.progress / 100;
    }
  }, [level.progress, animated, progress]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={[styles.container, themeDark && styles.containerDark]}
    >
      <View style={styles.header}>
        <Text style={[styles.levelTitle, themeDark && styles.levelTitleDark]}>
          Level {level.level}
        </Text>
        <Text style={[styles.xpText, themeDark && styles.xpTextDark]}>
          {level.xp} / {level.xpToNext} XP
        </Text>
      </View>

      <View
        style={[
          styles.progressContainer,
          themeDark && styles.progressContainerDark,
        ]}
      >
        <Animated.View style={[styles.progressBar, animatedProgressStyle]} />
      </View>

      <Text style={[styles.titleText, themeDark && styles.titleTextDark]}>
        {level.title}
      </Text>
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
  containerDark: {
    backgroundColor: "#1F2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  levelTitleDark: {
    color: "#F9FAFB",
  },
  xpText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  xpTextDark: {
    color: "#9CA3AF",
  },
  progressContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressContainerDark: {
    backgroundColor: "#374151",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#8B5CF6",
    borderRadius: 4,
  },
  titleText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    fontWeight: "500",
  },
  titleTextDark: {
    color: "#9CA3AF",
  },
});

export const XPProgressCard = memo(XPProgressCardComponent);
export default XPProgressCard;
