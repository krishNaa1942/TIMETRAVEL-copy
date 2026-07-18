/**
 * SmartActions Component - Dynamic action buttons
 */
import React, { memo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useUIStore } from "@/stores/uiStore";
import type { SmartActionsProps, SmartAction } from "../types";

const ActionItem: React.FC<{
  action: SmartAction;
  onPress: (action: SmartAction) => void;
}> = ({ action, onPress }) => {
  const { themeDark } = useUIStore();

  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(action);
  }, [action, onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}. ${action.subtitle}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.actionItem,
        { borderLeftColor: action.color },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.actionIcon}>{action.icon}</Text>
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, themeDark && styles.textDark]}>
          {action.title}
        </Text>
        <Text style={[styles.actionSubtitle, themeDark && styles.subtitleDark]}>
          {action.subtitle}
        </Text>
      </View>
    </Pressable>
  );
};

const SmartActionsComponent: React.FC<SmartActionsProps> = ({
  actions,
  onActionPress,
}) => {
  const { themeDark } = useUIStore();
  const visibleActions = actions.filter((a) => a.visible).slice(0, 3);

  if (visibleActions.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.delay(500).duration(400)}
      style={[styles.container, themeDark && styles.containerDark]}
    >
      <Text style={[styles.title, themeDark && styles.textDark]}>
        Recommended Actions
      </Text>
      {visibleActions.map((action) => (
        <ActionItem key={action.id} action={action} onPress={onActionPress} />
      ))}
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
  subtitleDark: { color: "#9CA3AF" },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 8,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  actionIcon: { fontSize: 24, marginRight: 12 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  actionSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});

export const SmartActions = memo(SmartActionsComponent);
export default SmartActions;
