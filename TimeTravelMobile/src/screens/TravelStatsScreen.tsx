import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getSeasonTheme,
  getTimeOfDayGreeting,
  useTravelIntelligence,
} from "@/features/travel-intelligence";
import {
  TravelAIAssistantModal,
  TravelCommunitySection,
  TravelIntelligenceSection,
  TravelOverviewSection,
  TravelStatsEmptyState,
  TravelStatsErrorState,
  TravelStatsHeader,
  TravelStatsSkeleton,
} from "@/features/travel-intelligence/components";
import type { TravelSectionKey } from "@/features/travel-intelligence/types";

const SECTION_ITEMS: Array<{ key: TravelSectionKey }> = [
  { key: "intelligence" },
  { key: "community" },
];

export default function TravelStatsScreen() {
  const [assistantVisible, setAssistantVisible] = useState(false);

  const {
    snapshot,
    isLoading,
    isRefreshing,
    isOffline,
    error,
    refresh,
    dismissInsight,
    askAI,
    isAiLoading,
    lastUpdatedLabel,
  } = useTravelIntelligence();

  const seasonTheme = useMemo(() => getSeasonTheme(), []);
  const greeting = useMemo(() => getTimeOfDayGreeting(), []);

  const assistantContextLabel = useMemo(() => {
    if (!snapshot) {
      return "Your travel intelligence dashboard";
    }

    return `${snapshot.personality.type} · Grade ${snapshot.financialHealth.grade} · ${lastUpdatedLabel}`;
  }, [lastUpdatedLabel, snapshot]);

  const assistantSuggestions = useMemo(() => {
    if (!snapshot) {
      return [
        "What should I budget next?",
        "How do I improve my travel DNA?",
        "Which destination should I visit next?",
      ];
    }

    const topDestination = snapshot.rawStats.top_destinations[0]?.destination;

    return [
      `Tell me about my ${snapshot.personality.type.toLowerCase()}`,
      "How can I lower my average trip cost?",
      topDestination
        ? `Why is ${topDestination} my top destination?`
        : "What destination matches my style?",
    ];
  }, [snapshot]);

  if (isLoading && !snapshot) {
    return (
      <LinearGradient colors={seasonTheme.background} style={styles.background}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <TravelStatsSkeleton />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error && !snapshot) {
    return (
      <LinearGradient colors={seasonTheme.background} style={styles.background}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.stateWrapper}>
            <TravelStatsErrorState message={error} onRetry={refresh} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (snapshot && !snapshot.hasData) {
    return (
      <LinearGradient colors={seasonTheme.background} style={styles.background}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.stateWrapper}>
            <TravelStatsEmptyState onRefresh={refresh} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={seasonTheme.background} style={styles.background}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.overlayOne} />
        <View style={styles.overlayTwo} />
        <FlatList
          data={SECTION_ITEMS}
          keyExtractor={(item) => item.key}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refresh()}
              tintColor="#FFFFFF"
            />
          }
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerStack}>
              <TravelStatsHeader
                greeting={greeting}
                seasonLabel={seasonTheme.label}
                lastUpdatedLabel={lastUpdatedLabel}
                isOffline={isOffline}
                isRefreshing={isRefreshing}
                onRefresh={() => void refresh()}
                onOpenAssistant={() => setAssistantVisible(true)}
              />
              {snapshot ? (
                <TravelOverviewSection
                  snapshot={snapshot}
                  accentColor={seasonTheme.accent}
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            if (!snapshot) {
              return null;
            }

            if (item.key === "intelligence") {
              return (
                <TravelIntelligenceSection
                  snapshot={snapshot}
                  accentColor={seasonTheme.accent}
                  onDismissInsight={dismissInsight}
                />
              );
            }

            return (
              <TravelCommunitySection
                snapshot={snapshot}
                accentColor={seasonTheme.accent}
              />
            );
          }}
          ListFooterComponent={
            snapshot ? (
              <TravelAIAssistantModal
                visible={assistantVisible}
                contextLabel={assistantContextLabel}
                suggestions={assistantSuggestions}
                loading={isAiLoading}
                onClose={() => setAssistantVisible(false)}
                onSubmit={askAI}
              />
            ) : null
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
  },
  headerStack: {
    gap: 16,
  },
  overlayOne: {
    position: "absolute",
    top: -48,
    right: -18,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  overlayTwo: {
    position: "absolute",
    top: 120,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  stateWrapper: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
});
