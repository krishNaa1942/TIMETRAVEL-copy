/**
 * InsightsCard Component - Backend-backed insights display
 */
import React, { memo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useUIStore } from "@/stores/uiStore";
import type { InsightsCardProps, AIInsight } from "../types";

const InsightItem: React.FC<{
  insight: AIInsight;
  onPress: (insight: AIInsight) => void;
}> = ({ insight, onPress }) => {
  const { themeDark } = useUIStore();

  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(insight);
  }, [insight, onPress]);

  return (
    <Pressable
      accessibilityRole={insight.actionable ? "button" : "text"}
      accessibilityLabel={
        insight.actionable && insight.actionLabel
          ? `${insight.message}. ${insight.actionLabel}`
          : insight.message
      }
      onPress={insight.actionable ? handlePress : undefined}
      style={({ pressed }) => [styles.insightItem, pressed && styles.pressed]}
    >
      <Text style={styles.insightIcon}>{insight.icon}</Text>
      <View style={styles.insightContent}>
        <Text style={[styles.insightMessage, themeDark && styles.textDark]}>
          {insight.message}
        </Text>
        {insight.actionable && insight.actionLabel && (
          <Text style={styles.actionLabel}>{insight.actionLabel}</Text>
        )}
      </View>
    </Pressable>
  );
};

const InsightsCardComponent: React.FC<InsightsCardProps> = ({
  insights,
  onInsightPress,
}) => {
  const { themeDark } = useUIStore();
  const handleInsightPress = onInsightPress ?? (() => undefined);

  return (
    <Animated.View
      entering={FadeIn.delay(400).duration(400)}
      style={[styles.container, themeDark && styles.containerDark]}
    >
      <Text style={[styles.title, themeDark && styles.textDark]}>
        Travel Insights
      </Text>
      {insights.map((insight) => (
        <InsightItem
          key={insight.id}
          insight={insight}
          onPress={handleInsightPress}
        />
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
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pressed: { opacity: 0.7 },
  insightIcon: { fontSize: 20, marginRight: 12 },
  insightContent: { flex: 1 },
  insightMessage: { fontSize: 14, color: "#374151", lineHeight: 20 },
  actionLabel: {
    fontSize: 12,
    color: "#8B5CF6",
    fontWeight: "600",
    marginTop: 4,
  },
});

export const InsightsCard = memo(InsightsCardComponent);
export default InsightsCard;
