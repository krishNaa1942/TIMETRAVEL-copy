/**
 * InsightCard — AI-powered recommendation section with horizontal scroll
 * Now includes an empty-state fallback (fix #7).
 */

import React, { memo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import DestinationCard from "@/components/Features/DestinationCard";
import { Destination } from "@/types";
import { colors, spacing } from "@/theme/colors";
import { AIInsight } from "../utils/scoring";

// ─────────────────────────────────────────────────────────────
// ICON / COLOR CONFIG
// ─────────────────────────────────────────────────────────────

const INSIGHT_ICONS: Record<string, string> = {
  trending: "fire",
  seasonal: "weather-sunny",
  personalized: "heart",
  recommendation: "star-four-points",
  hidden_gems: "diamond-stone",
  weekend: "calendar-weekend",
};

const INSIGHT_COLORS: Record<string, string> = {
  trending: "#EF4444",
  seasonal: "#F59E0B",
  personalized: "#EC4899",
  recommendation: "#8B5CF6",
  hidden_gems: "#10B981",
  weekend: "#0EA5E9",
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

interface InsightCardProps {
  insight: AIInsight;
  getImageUrl: (dest: Destination) => string | undefined;
  onDestinationPress: (dest: Destination) => void;
}

const InsightCard = memo(
  ({ insight, getImageUrl, onDestinationPress }: InsightCardProps) => {
    const scrollRef = useRef<any>(null);
    const iconName = INSIGHT_ICONS[insight.type] ?? "star-four-points";
    const iconColor = INSIGHT_COLORS[insight.type] ?? "#8B5CF6";

    return (
      <View style={styles.section} accessibilityRole="summary">
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name={iconName as any}
              size={20}
              color={iconColor}
            />
            <Text style={styles.title}>{insight.title}</Text>
          </View>
          <Text style={styles.subtitle}>{insight.subtitle}</Text>
          {insight.reason && (
            <View style={styles.reason}>
              <MaterialCommunityIcons
                name="lightbulb-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text style={styles.reasonText}>{insight.reason}</Text>
            </View>
          )}
        </View>

        {/* Empty state (fix #7) */}
        {insight.destinations.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="compass-outline"
              size={32}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>
              Explore more destinations to improve recommendations
            </Text>
          </View>
        ) : (
          <FlashList
            ref={scrollRef}
            horizontal
            data={insight.destinations}
            keyExtractor={(d) => d.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <DestinationCard
                destination={item}
                imageUrl={getImageUrl(item)}
                onPress={() => onDestinationPress(item)}
                horizontal
              />
            )}
          />
        )}
      </View>
    );
  },
);
InsightCard.displayName = "InsightCard";

export default InsightCard;

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.darkBackground,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    marginLeft: 28,
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    marginLeft: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  reasonText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  listContent: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
  },
});
