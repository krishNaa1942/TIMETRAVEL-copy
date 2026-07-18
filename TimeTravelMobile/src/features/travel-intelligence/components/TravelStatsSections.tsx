import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Chip, Divider, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GlassCard } from "@/components/UI/GlassCard";
import type { TravelIntelligenceSnapshot } from "../types";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShortDate,
} from "../utils";
import { TravelDNAChart } from "./TravelDNAChart";

interface SectionProps {
  snapshot: TravelIntelligenceSnapshot;
  accentColor?: string;
  onDismissInsight?: (id: string) => void;
}

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <GlassCard style={styles.sectionCard}>
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingText}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" style={styles.sectionSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
    {children}
  </GlassCard>
);

const MetricTile = ({
  label,
  value,
  tone = "#0F172A",
}: {
  label: string;
  value: string;
  tone?: string;
}) => (
  <View style={styles.metricTile}>
    <Text variant="labelSmall" style={styles.metricLabel}>
      {label}
    </Text>
    <Text variant="titleMedium" style={[styles.metricValue, { color: tone }]}>
      {value}
    </Text>
  </View>
);

export const TravelOverviewSection = memo(
  ({ snapshot, accentColor = "#0F766E" }: SectionProps) => {
    const topCategory = snapshot.spendingCategories[0];

    return (
      <SectionCard
        title="Overview"
        subtitle={`A quick read on ${snapshot.personality.type.toLowerCase()} behavior`}
      >
        <View style={styles.personalityBanner}>
          <View
            style={[
              styles.personalityIcon,
              { backgroundColor: `${accentColor}18` },
            ]}
          >
            <Text variant="headlineMedium" style={styles.personalityEmoji}>
              {snapshot.personality.icon}
            </Text>
          </View>
          <View style={styles.personalityText}>
            <Text variant="titleLarge" style={styles.personalityTitle}>
              {snapshot.personality.type}
            </Text>
            <Text variant="bodyMedium" style={styles.personalityDescription}>
              {snapshot.personality.tagline}
            </Text>
          </View>
          <Chip
            style={[styles.levelChip, { backgroundColor: `${accentColor}14` }]}
            textStyle={{ color: accentColor }}
          >
            Level {snapshot.level.level}
          </Chip>
        </View>

        <View style={styles.metricGrid}>
          <MetricTile
            label="Trips"
            value={formatNumber(snapshot.rawStats.trips.total)}
          />
          <MetricTile
            label="Destinations"
            value={formatNumber(snapshot.rawStats.destinations_visited)}
          />
          <MetricTile
            label="Travel days"
            value={formatNumber(snapshot.rawStats.total_travel_days)}
          />
          <MetricTile
            label="Avg trip cost"
            value={formatCurrency(snapshot.summary.spending.avgPerTrip)}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <MaterialCommunityIcons
                name="shield-star-outline"
                size={18}
                color={accentColor}
              />
              <Text variant="labelMedium" style={styles.summaryLabel}>
                Financial grade
              </Text>
            </View>
            <Text variant="headlineSmall" style={styles.summaryValue}>
              {snapshot.financialHealth.grade}
            </Text>
            <Text variant="bodySmall" style={styles.summaryCaption}>
              {snapshot.financialHealth.status.replace("-", " ")}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <MaterialCommunityIcons
                name="map-clock"
                size={18}
                color={accentColor}
              />
              <Text variant="labelMedium" style={styles.summaryLabel}>
                Longest streak
              </Text>
            </View>
            <Text variant="headlineSmall" style={styles.summaryValue}>
              {formatNumber(snapshot.streaks[0]?.longest ?? 0)}
            </Text>
            <Text variant="bodySmall" style={styles.summaryCaption}>
              {snapshot.streaks[0]?.isActive
                ? "Currently active"
                : "Track activity to extend it"}
            </Text>
          </View>
        </View>

        {topCategory ? (
          <View style={styles.topCategoryCard}>
            <Text variant="labelSmall" style={styles.topCategoryLabel}>
              Top spending category
            </Text>
            <Text variant="titleMedium" style={styles.topCategoryValue}>
              {topCategory.name}
            </Text>
            <Text variant="bodySmall" style={styles.topCategoryCaption}>
              {formatPercent(topCategory.percentage)} of total spend ·{" "}
              {formatCurrency(topCategory.amount)}
            </Text>
          </View>
        ) : null}
      </SectionCard>
    );
  },
);

export const TravelIntelligenceSection = memo(
  ({ snapshot, accentColor = "#0F766E", onDismissInsight }: SectionProps) => {
    return (
      <>
        <TravelDNAChart dna={snapshot.dna} accentColor={accentColor} />

        <SectionCard
          title="Insights"
          subtitle="Signals worth acting on right now"
        >
          {snapshot.insights.length > 0 ? (
            <View style={styles.stack}>
              {snapshot.insights.map((insight) => (
                <View key={insight.id} style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={styles.insightTitleRow}>
                      <Text variant="titleMedium" style={styles.insightIcon}>
                        {insight.icon}
                      </Text>
                      <View style={styles.insightTextBlock}>
                        <Text variant="titleMedium" style={styles.insightTitle}>
                          {insight.title}
                        </Text>
                        <Text
                          variant="bodySmall"
                          style={styles.insightDescription}
                        >
                          {insight.description}
                        </Text>
                      </View>
                    </View>
                    {onDismissInsight ? (
                      <Button
                        compact
                        mode="text"
                        onPress={() => onDismissInsight(insight.id)}
                      >
                        Dismiss
                      </Button>
                    ) : null}
                  </View>
                  {insight.actionLabel ? (
                    <Chip compact style={styles.insightActionChip}>
                      {insight.actionLabel}
                    </Chip>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text variant="bodyMedium" style={styles.mutedText}>
              No active insights right now.
            </Text>
          )}
        </SectionCard>

        <SectionCard
          title="Predictions"
          subtitle="What your patterns suggest next"
        >
          <View style={styles.stack}>
            {snapshot.predictions.map((prediction, index) => (
              <View
                key={`${prediction.type}-${index}`}
                style={styles.predictionCard}
              >
                <View style={styles.insightHeader}>
                  <View style={styles.insightTitleRow}>
                    <MaterialCommunityIcons
                      name="crystal-ball"
                      size={18}
                      color={accentColor}
                    />
                    <View style={styles.insightTextBlock}>
                      <Text variant="titleMedium" style={styles.insightTitle}>
                        {prediction.prediction}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={styles.insightDescription}
                      >
                        {prediction.reasoning}
                      </Text>
                    </View>
                  </View>
                  <Chip compact style={styles.confidenceChip}>
                    {Math.round(prediction.confidence * 100)}%
                  </Chip>
                </View>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard
          title="Financial health"
          subtitle="Budget pressure and spending signals"
        >
          <View style={styles.financialHeader}>
            <View>
              <Text variant="headlineMedium" style={styles.financialScore}>
                {snapshot.financialHealth.score}
              </Text>
              <Text variant="bodySmall" style={styles.financialCaption}>
                Score out of 100
              </Text>
            </View>
            <Chip
              style={[
                styles.gradeChip,
                { backgroundColor: `${accentColor}14` },
              ]}
              textStyle={{ color: accentColor }}
            >
              {snapshot.financialHealth.grade} ·{" "}
              {snapshot.financialHealth.status.replace("-", " ")}
            </Chip>
          </View>

          <View style={styles.metricGrid}>
            <MetricTile
              label="Budget utilization"
              value={formatPercent(snapshot.financialHealth.budgetUtilization)}
            />
            <MetricTile
              label="Savings rate"
              value={formatPercent(snapshot.financialHealth.savingsRate * 100)}
            />
            <MetricTile
              label="Avg trip cost"
              value={formatCurrency(snapshot.financialHealth.avgTripCost)}
            />
            <MetricTile
              label="Cost trend"
              value={
                snapshot.financialHealth.costTrend >= 0 ? "Stable" : "Down"
              }
            />
          </View>

          <Text variant="labelSmall" style={styles.sectionLabel}>
            Recommendations
          </Text>
          <View style={styles.stack}>
            {snapshot.financialHealth.recommendations.map((item) => (
              <View key={item} style={styles.recommendationRow}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={16}
                  color={accentColor}
                />
                <Text variant="bodySmall" style={styles.recommendationText}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </>
    );
  },
);

export const TravelCommunitySection = memo(
  ({ snapshot, accentColor = "#0F766E" }: SectionProps) => {
    const unlockedBadges = snapshot.badges.filter((badge) => badge.isUnlocked);

    return (
      <SectionCard
        title="Community and memory"
        subtitle="Your badges, achievements, and stories"
      >
        <View style={styles.metricGrid}>
          <MetricTile
            label="Badges unlocked"
            value={formatNumber(unlockedBadges.length)}
          />
          <MetricTile
            label="Achievements"
            value={formatNumber(snapshot.achievements.length)}
          />
          <MetricTile
            label="Stories"
            value={formatNumber(snapshot.stories.length)}
          />
          <MetricTile
            label="Favorites"
            value={formatNumber(snapshot.rawStats.favorites_count)}
          />
        </View>

        {unlockedBadges.length > 0 ? (
          <>
            <Text variant="labelSmall" style={styles.sectionLabel}>
              Highlight badges
            </Text>
            <View style={styles.badgeGrid}>
              {unlockedBadges.slice(0, 6).map((badge) => (
                <View key={badge.id} style={styles.badgeCard}>
                  <Text variant="headlineSmall" style={styles.badgeIcon}>
                    {badge.icon}
                  </Text>
                  <Text variant="titleSmall" style={styles.badgeName}>
                    {badge.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.badgeDescription}>
                    {badge.description}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {snapshot.achievements.length > 0 ? (
          <>
            <Text variant="labelSmall" style={styles.sectionLabel}>
              Recent achievements
            </Text>
            <View style={styles.stack}>
              {snapshot.achievements.slice(0, 3).map((achievement) => (
                <View key={achievement.id} style={styles.storyCard}>
                  <View style={styles.storyHeader}>
                    <Text variant="titleMedium" style={styles.storyIcon}>
                      {achievement.icon}
                    </Text>
                    <View style={styles.storyTextBlock}>
                      <Text variant="titleMedium" style={styles.storyTitle}>
                        {achievement.title}
                      </Text>
                      <Text variant="bodySmall" style={styles.storyCaption}>
                        {achievement.description}
                      </Text>
                    </View>
                    <Chip compact style={styles.xpChip}>
                      +{achievement.xpEarned} XP
                    </Chip>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {snapshot.stories.length > 0 ? (
          <>
            <Text variant="labelSmall" style={styles.sectionLabel}>
              Travel stories
            </Text>
            <View style={styles.stack}>
              {snapshot.stories.map((story) => (
                <View key={story.id} style={styles.storyCard}>
                  <View style={styles.storyHeader}>
                    <Text variant="titleMedium" style={styles.storyIcon}>
                      {story.icon}
                    </Text>
                    <View style={styles.storyTextBlock}>
                      <Text variant="titleMedium" style={styles.storyTitle}>
                        {story.title}
                      </Text>
                      <Text variant="bodySmall" style={styles.storyCaption}>
                        {story.period} · {story.narrative}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.storyHighlights}>
                    {story.highlights.map((highlight) => (
                      <Chip
                        key={highlight}
                        compact
                        style={[
                          styles.highlightChip,
                          { backgroundColor: `${accentColor}14` },
                        ]}
                      >
                        {highlight}
                      </Chip>
                    ))}
                  </View>
                  <Text variant="bodySmall" style={styles.shareableText}>
                    {story.shareableText}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text variant="bodySmall" style={styles.sectionFootnote}>
          Last refreshed on{" "}
          {formatShortDate(new Date(snapshot.lastUpdatedAt).toISOString())}
        </Text>
      </SectionCard>
    );
  },
);

const styles = StyleSheet.create({
  sectionCard: {
    padding: 18,
    marginBottom: 16,
  },
  sectionHeading: {
    marginBottom: 14,
  },
  sectionHeadingText: {
    gap: 4,
  },
  sectionTitle: {
    color: "#0F172A",
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#64748B",
  },
  personalityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  personalityIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  personalityEmoji: {
    color: "#0F172A",
  },
  personalityText: {
    flex: 1,
  },
  personalityTitle: {
    color: "#0F172A",
    fontWeight: "800",
  },
  personalityDescription: {
    color: "#475569",
    marginTop: 4,
  },
  levelChip: {
    borderRadius: 999,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    width: "48%",
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  metricLabel: {
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metricValue: {
    marginTop: 6,
    fontWeight: "800",
  },
  divider: {
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  summaryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryLabel: {
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryValue: {
    color: "#0F172A",
    fontWeight: "800",
    marginTop: 8,
  },
  summaryCaption: {
    color: "#64748B",
    marginTop: 2,
  },
  topCategoryCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(15, 118, 110, 0.08)",
  },
  topCategoryLabel: {
    color: "#0F766E",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  topCategoryValue: {
    color: "#0F172A",
    fontWeight: "800",
    marginTop: 6,
  },
  topCategoryCaption: {
    color: "#475569",
    marginTop: 4,
  },
  stack: {
    gap: 12,
  },
  insightCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  insightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  insightTitleRow: {
    flexDirection: "row",
    flex: 1,
    gap: 10,
  },
  insightIcon: {
    width: 28,
    textAlign: "center",
  },
  insightTextBlock: {
    flex: 1,
  },
  insightTitle: {
    color: "#0F172A",
    fontWeight: "700",
  },
  insightDescription: {
    color: "#475569",
    marginTop: 4,
  },
  insightActionChip: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "rgba(14, 165, 233, 0.12)",
  },
  predictionCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  confidenceChip: {
    backgroundColor: "rgba(15, 118, 110, 0.12)",
  },
  financialHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  financialScore: {
    color: "#0F172A",
    fontWeight: "900",
  },
  financialCaption: {
    color: "#64748B",
    marginTop: 4,
  },
  gradeChip: {
    borderRadius: 999,
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 10,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  recommendationRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  recommendationText: {
    flex: 1,
    color: "#334155",
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeCard: {
    width: "48%",
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  badgeIcon: {
    color: "#0F172A",
  },
  badgeName: {
    color: "#0F172A",
    fontWeight: "800",
    marginTop: 8,
  },
  badgeDescription: {
    color: "#475569",
    marginTop: 4,
  },
  storyCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  storyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  storyIcon: {
    width: 28,
    textAlign: "center",
  },
  storyTextBlock: {
    flex: 1,
  },
  storyTitle: {
    color: "#0F172A",
    fontWeight: "800",
  },
  storyCaption: {
    color: "#475569",
    marginTop: 4,
  },
  xpChip: {
    backgroundColor: "rgba(15, 118, 110, 0.12)",
  },
  storyHighlights: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  highlightChip: {
    borderRadius: 999,
  },
  shareableText: {
    color: "#64748B",
    marginTop: 10,
    fontStyle: "italic",
  },
  sectionFootnote: {
    color: "#94A3B8",
    marginTop: 12,
  },
  mutedText: {
    color: "#64748B",
  },
});

TravelOverviewSection.displayName = "TravelOverviewSection";
TravelIntelligenceSection.displayName = "TravelIntelligenceSection";
TravelCommunitySection.displayName = "TravelCommunitySection";
