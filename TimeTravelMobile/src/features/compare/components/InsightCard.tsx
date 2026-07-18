import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Chip, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GlassCard } from "@/components/UI/GlassCard";
import { PressableScale } from "@/components/UI/PressableScale";

import type { ComparisonInsight } from "../types";
import { getCategoryLabel, getToneColor } from "../utils/formatters";
import type { ComparePalette } from "../utils/formatters";

interface InsightCardProps {
  insight: ComparisonInsight;
  palette: ComparePalette;
  onPress?: (insight: ComparisonInsight) => void;
}

export const InsightCard = memo(
  ({ insight, palette, onPress }: InsightCardProps) => {
    const toneColor = getToneColor(insight.tone, palette);

    const content = (
      <GlassCard
        style={[
          styles.card,
          {
            backgroundColor: palette.surfaceElevated,
            borderColor: `${toneColor}26`,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View
            style={[styles.iconWrap, { backgroundColor: `${toneColor}18` }]}
          >
            <MaterialCommunityIcons
              name={insight.icon as never}
              size={18}
              color={toneColor}
            />
          </View>

          <View style={styles.textBlock}>
            <View style={styles.titleRow}>
              <Text
                variant="titleMedium"
                style={[styles.title, { color: palette.text }]}
              >
                {insight.title}
              </Text>
              <Chip
                compact
                style={[
                  styles.categoryChip,
                  { backgroundColor: `${toneColor}14` },
                ]}
                textStyle={{ color: toneColor }}
              >
                {getCategoryLabel(insight.category)}
              </Chip>
            </View>
            <Text
              variant="bodyMedium"
              style={[styles.description, { color: palette.muted }]}
            >
              {insight.description}
            </Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text variant="labelSmall" style={{ color: toneColor }}>
            {insight.deltaLabel}
          </Text>
          {insight.winnerDestinationId ? (
            <Text variant="labelSmall" style={{ color: palette.muted }}>
              AI explanation
            </Text>
          ) : null}
        </View>
      </GlassCard>
    );

    if (!onPress) {
      return content;
    }

    return (
      <PressableScale onPress={() => onPress(insight)} style={styles.pressable}>
        {content}
      </PressableScale>
    );
  },
);

InsightCard.displayName = "InsightCard";

const styles = StyleSheet.create({
  pressable: {
    marginBottom: 12,
  },
  card: {
    padding: 16,
    borderRadius: 20,
  },
  topRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontWeight: "800",
  },
  categoryChip: {
    borderRadius: 999,
  },
  description: {
    lineHeight: 21,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
});
