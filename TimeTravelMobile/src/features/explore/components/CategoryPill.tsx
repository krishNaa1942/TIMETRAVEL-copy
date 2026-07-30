/**
 * CategoryPill — Animated category selector chip
 */

import React, { memo } from "react";
import { StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { PressableScale } from "@/components/UI/PressableScale";
import { CategoryConfig } from "../constants/categories";
import { colors } from "@/theme/colors";

interface CategoryPillProps {
  category: CategoryConfig;
  isActive: boolean;
  onPress: () => void;
}

const CategoryPill = memo(
  ({ category, isActive, onPress }: CategoryPillProps) => {
    const scale = useSharedValue(1);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
      scale.value = withTiming(0.95, { duration: 50 }, () => {
        scale.value = withTiming(1, { duration: 150 });
      });
      onPress();
    };

    return (
      <ReAnimated.View style={animStyle}>
        <PressableScale
          style={[
            styles.pill,
            isActive && {
              backgroundColor: category.color,
              borderColor: category.color,
            },
          ]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${category.label} category`}
          accessibilityState={{ selected: isActive }}
        >
          <MaterialCommunityIcons
            name={category.icon as any}
            size={16}
            color={isActive ? "#FFF" : category.color}
          />
          <Text style={[styles.text, isActive && { color: "#FFF" }]}>
            {category.label}
          </Text>
        </PressableScale>
      </ReAnimated.View>
    );
  },
);
CategoryPill.displayName = "CategoryPill";

export default CategoryPill;

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
