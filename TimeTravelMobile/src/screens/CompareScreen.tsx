import React, { memo, useCallback, useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RouteProp, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native-paper";

import { GlassCard } from "@/components/UI/GlassCard";
import {
  CompareBar,
  CompareHeader,
  CompareSkeleton,
  CompareState,
  DestinationSelector,
  InsightCard,
  WinnerBanner,
} from "@/features/compare/components";
import {
  comparisonFactorSpecs,
  getFactorSpec,
} from "@/features/compare/engine/scoringEngine";
import { useCompare } from "@/features/compare/hooks/useCompare";
import type {
  CompareRouteParams,
  ComparisonFactorSpec,
} from "@/features/compare/types";
import {
  buildComparePalette,
  formatConfidence,
} from "@/features/compare/utils/formatters";

type CompareRoute = {
  Compare: CompareRouteParams | undefined;
};

const SectionHeader = memo(
  ({ title, subtitle }: { title: string; subtitle: string }) => (
    <View style={styles.sectionHeader}>
      <Text variant="titleLarge" style={styles.sectionTitle}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={styles.sectionSubtitle}>
        {subtitle}
      </Text>
    </View>
  ),
);

SectionHeader.displayName = "SectionHeader";

export const CompareScreen = () => {
  const route = useRoute<RouteProp<CompareRoute, "Compare">>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const palette = useMemo(() => buildComparePalette(isDark), [isDark]);
  const compare = useCompare(route.params ?? {});

  const {
    destinations,
    selectedDestinations,
    activeDestinationId,
    activeDestinationIndex,
    analysis,
    isLoadingDestinations,
    isLoadingAnalysis,
    isRefreshing,
    isOffline,
    error,
    canCompare,
    maxDestinations,
    priority,
    days,
    familySize,
    travelClass,
    source,
    lastUpdatedLabel,
    toggleDestination,
    removeDestination,
    setActiveDestination,
    swapTopTwo,
    setPriority,
    refresh,
    retry,
  } = compare;

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const handleRetry = useCallback(() => {
    void retry();
  }, [retry]);

  const factorSpecs = useMemo<ComparisonFactorSpec[]>(() => {
    if (!analysis) {
      return comparisonFactorSpecs as ComparisonFactorSpec[];
    }

    return analysis.factorOrder
      .map((factor) => getFactorSpec(factor))
      .filter((spec): spec is ComparisonFactorSpec => Boolean(spec));
  }, [analysis]);

  const activeDestination =
    selectedDestinations[activeDestinationIndex] ??
    selectedDestinations[0] ??
    null;
  const activeCandidate =
    analysis?.candidates[activeDestinationIndex] ??
    analysis?.candidates[0] ??
    null;

  const showLoadingState =
    (isLoadingDestinations || isLoadingAnalysis) && !analysis && !error;
  const showErrorState = Boolean(error) && !analysis && !showLoadingState;
  const showEmptyState =
    !showLoadingState && !showErrorState && !canCompare && !analysis;

  return (
    <LinearGradient colors={palette.background} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing && !showLoadingState}
              onRefresh={handleRefresh}
              tintColor={palette.accent}
              colors={[palette.accent]}
            />
          }
        >
          <View style={styles.content}>
            <CompareHeader
              selectedCount={selectedDestinations.length}
              maxDestinations={maxDestinations}
              priority={priority}
              days={days}
              familySize={familySize}
              travelClass={travelClass}
              source={source}
              lastUpdatedLabel={lastUpdatedLabel}
              isOffline={isOffline}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              onSwap={swapTopTwo}
              onPriorityChange={setPriority}
              palette={palette}
            />

            <DestinationSelector
              destinations={destinations}
              selectedDestinations={selectedDestinations}
              activeDestinationId={activeDestinationId}
              maxDestinations={maxDestinations}
              isLoading={isLoadingDestinations}
              palette={palette}
              onToggleDestination={toggleDestination}
              onRemoveDestination={removeDestination}
              onSetActiveDestination={setActiveDestination}
              onSwapTopTwo={swapTopTwo}
            />

            {showLoadingState ? <CompareSkeleton /> : null}

            {showErrorState ? (
              <CompareState
                title="Unable to build the comparison"
                message={
                  error ??
                  "The compare engine could not load the selected destinations."
                }
                actionLabel="Try again"
                onAction={handleRetry}
                palette={palette}
                icon="alert-circle-outline"
              />
            ) : null}

            {showEmptyState ? (
              <CompareState
                title="Select at least two destinations"
                message="Use the destination deck above to build a comparison. The engine supports up to five destinations at once."
                actionLabel="Refresh destinations"
                onAction={handleRefresh}
                palette={palette}
                icon="map-search-outline"
              />
            ) : null}

            {analysis ? (
              <>
                <WinnerBanner analysis={analysis} palette={palette} />

                {activeDestination && activeCandidate ? (
                  <GlassCard
                    style={[
                      styles.focusCard,
                      {
                        backgroundColor: palette.surfaceElevated,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <View style={styles.focusHeader}>
                      <Text variant="labelSmall" style={styles.focusLabel}>
                        Spotlight
                      </Text>
                      <Text variant="labelSmall" style={styles.focusConfidence}>
                        {formatConfidence(activeCandidate.confidence)}
                      </Text>
                    </View>
                    <Text
                      variant="titleMedium"
                      style={[styles.focusTitle, { color: palette.text }]}
                    >
                      {activeDestination.label}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={[styles.focusText, { color: palette.muted }]}
                    >
                      {activeCandidate.highlights[0] ??
                        "This destination is in the current comparison set."}
                    </Text>
                  </GlassCard>
                ) : null}

                {analysis.hasPartialData ? (
                  <GlassCard
                    style={[
                      styles.partialCard,
                      {
                        backgroundColor: palette.surfaceElevated,
                        borderColor: palette.warning,
                      },
                    ]}
                  >
                    <Text
                      variant="labelSmall"
                      style={[styles.partialLabel, { color: palette.warning }]}
                    >
                      Partial data detected
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={[styles.partialText, { color: palette.muted }]}
                    >
                      The engine merged live results with cached or fallback
                      data where needed. The score is still usable, but
                      confidence is slightly lower.
                    </Text>
                  </GlassCard>
                ) : null}

                <SectionHeader
                  title="Factor breakdown"
                  subtitle="Each bar shows how the chosen destinations compare across the weighted decision factors."
                />
                {factorSpecs.map((factor) => (
                  <CompareBar
                    key={factor.key}
                    factor={factor}
                    candidates={analysis.candidates}
                    palette={palette}
                  />
                ))}

                <SectionHeader
                  title="AI insights"
                  subtitle="Human-readable explanations generated from the scoring model."
                />
                {analysis.insights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    palette={palette}
                  />
                ))}

                <GlassCard
                  style={[
                    styles.summaryCard,
                    {
                      backgroundColor: palette.surfaceElevated,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Text
                    variant="titleMedium"
                    style={[styles.summaryTitle, { color: palette.text }]}
                  >
                    Comparison summary
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={[styles.summaryText, { color: palette.muted }]}
                  >
                    {analysis.summary.explanation}
                  </Text>
                  <View style={styles.summaryMetaRow}>
                    <Text variant="labelSmall" style={{ color: palette.muted }}>
                      {analysis.summary.winnerLabel}
                    </Text>
                    <Text variant="labelSmall" style={{ color: palette.muted }}>
                      {lastUpdatedLabel}
                    </Text>
                  </View>
                </GlassCard>
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

CompareScreen.displayName = "CompareScreen";

export default CompareScreen;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
  },
  content: {
    gap: 16,
  },
  sectionHeader: {
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  sectionTitle: {
    fontWeight: "900",
  },
  sectionSubtitle: {
    lineHeight: 21,
  },
  focusCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  focusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  focusLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  focusConfidence: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  focusTitle: {
    fontWeight: "900",
  },
  focusText: {
    lineHeight: 21,
  },
  partialCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
  },
  partialLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  partialText: {
    lineHeight: 21,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 22,
    gap: 8,
    marginTop: 2,
  },
  summaryTitle: {
    fontWeight: "900",
  },
  summaryText: {
    lineHeight: 22,
  },
  summaryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
});
