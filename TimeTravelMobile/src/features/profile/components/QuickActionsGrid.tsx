/**
 * QuickActionsGrid Component - Grid of quick action buttons
 */
import React, { memo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useUIStore } from "@/stores/uiStore";
import type { QuickActionsGridProps, QuickAction } from "../types";

const ActionGridItem: React.FC<{
  action: QuickAction;
  onPress: (action: QuickAction) => void;
}> = ({ action, onPress }) => {
  const { themeDark } = useUIStore();

  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(action);
  }, [action, onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        action.count !== null
          ? `${action.label}, ${action.count}`
          : action.label
      }
      onPress={handlePress}
      style={({ pressed }) => [
        styles.gridItem,
        themeDark && styles.gridItemDark,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.gridIcon}>{action.icon}</Text>
      <Text style={[styles.gridLabel, themeDark && styles.gridLabelDark]}>
        {action.label}
      </Text>
      {action.count !== null && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{action.count}</Text>
        </View>
      )}
    </Pressable>
  );
};

const QuickActionsGridComponent: React.FC<QuickActionsGridProps> = ({
  actions,
  onActionPress,
}) => {
  const { themeDark } = useUIStore();

  return (
    <Animated.View
      entering={FadeIn.delay(600).duration(400)}
      style={[styles.container, themeDark && styles.containerDark]}
    >
      <Text style={[styles.title, themeDark && styles.textDark]}>
        Shortcuts
      </Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <ActionGridItem
            key={action.id}
            action={action}
            onPress={onActionPress}
          />
        ))}
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
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  textDark: { color: "#F9FAFB" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridItem: {
    width: "22%",
    aspectRatio: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  gridItemDark: { backgroundColor: "#374151" },
  gridLabelDark: { color: "#D1D5DB" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  gridIcon: { fontSize: 24, marginBottom: 4 },
  gridLabel: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "500",
    textAlign: "center",
  },
  countBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#8B5CF6",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
});

export const QuickActionsGrid = memo(QuickActionsGridComponent);
export default QuickActionsGrid;
