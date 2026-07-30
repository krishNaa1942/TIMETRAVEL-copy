/**
 * SearchOverlay — Full-screen search with live results (fix #6),
 * close button + backdrop tap (fix #18), and accessibility (fix #11).
 */

import React, { memo, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { Text } from "react-native-paper";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ReAnimated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  Easing as ReEasing,
} from "react-native-reanimated";

import { PressableScale } from "@/components/UI/PressableScale";
import { Destination } from "@/types";
import { colors, spacing } from "@/theme/colors";
import { analyzeSearchIntent } from "../utils/scoring";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface SearchOverlayProps {
  visible: boolean;
  search: string;
  onSearchChange: (text: string) => void;
  onClose: () => void;
  onResultPress: (dest: Destination) => void;
  recentSearches: string[];
  destinations: Destination[];
  getImageUrl: (dest: Destination) => string | undefined;
}

// ─────────────────────────────────────────────────────────────
// INTENT DISPLAY CONFIG
// ─────────────────────────────────────────────────────────────

const INTENT_ICONS: Record<string, string> = {
  activity: "run",
  vibe: "heart",
  season: "weather-sunny",
  budget: "currency-inr",
  destination: "map-marker",
};

const INTENT_LABELS: Record<string, string> = {
  activity: "Looking for activities",
  vibe: "Matching your vibe",
  season: "Seasonal suggestion",
  budget: "Budget-friendly",
  destination: "Destinations",
};

const QUICK_SEARCHES = [
  { query: "Beaches near me", icon: "beach", color: "#0EA5E9" },
  { query: "Mountain treks", icon: "image-filter-hdr", color: "#10B981" },
  { query: "Weekend getaways", icon: "calendar-weekend", color: "#F59E0B" },
  { query: "Romantic spots", icon: "heart", color: "#EC4899" },
];

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const SearchOverlay = memo(
  ({
    visible,
    search,
    onSearchChange,
    onClose,
    onResultPress,
    recentSearches,
    destinations,
    getImageUrl,
  }: SearchOverlayProps) => {
    const searchIntent = useMemo(() => analyzeSearchIntent(search), [search]);

    // Live search results (fix #6)
    const liveResults = useMemo(() => {
      if (search.length < 2) return [];
      const q = search.toLowerCase();
      return destinations
        .filter((d) => {
          const destStr = `${d.label} ${d.region} ${d.tagline || ""}`.toLowerCase();
          return destStr.includes(q);
        })
        .slice(0, 8);
    }, [search, destinations]);

    if (!visible) return null;

    return (
      <ReAnimated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.overlay}
      >
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />

        {/* Backdrop tap to close (fix #18) */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close search"
        />

        <ReAnimated.View
          entering={SlideInDown.duration(300).easing(
            ReEasing.out(ReEasing.cubic),
          )}
          exiting={SlideOutDown.duration(200)}
          style={styles.content}
        >
          {/* Search Input + Close Button (fix #18) */}
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="magnify"
                size={22}
                color={colors.textSecondary}
              />
              <TextInput
                placeholder="Try 'romantic beaches' or 'mountain trek'..."
                placeholderTextColor={colors.textTertiary}
                value={search}
                onChangeText={onSearchChange}
                style={styles.textInput}
                autoFocus
                autoCapitalize="none"
                accessibilityLabel="Search destinations"
              />
              {search.length > 0 && (
                <TouchableOpacity
                  onPress={() => onSearchChange("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close search"
            >
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Search Intent Badge */}
          {search.length >= 2 && searchIntent.type !== "unknown" && (
            <ReAnimated.View entering={FadeIn.duration(200)} style={styles.intentBadge}>
              <MaterialCommunityIcons
                name={(INTENT_ICONS[searchIntent.type] ?? "map-marker") as any}
                size={14}
                color="#8B5CF6"
              />
              <Text style={styles.intentText}>
                {INTENT_LABELS[searchIntent.type] ?? "Destinations"}
              </Text>
            </ReAnimated.View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Live Results (fix #6) */}
            {liveResults.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>
                  Results · {liveResults.length} found
                </Text>
                {liveResults.map((dest) => (
                  <PressableScale
                    key={dest.id}
                    style={styles.resultRow}
                    onPress={() => onResultPress(dest)}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to ${dest.label}`}
                  >
                    <View style={styles.resultIcon}>
                      <MaterialCommunityIcons
                        name="map-marker"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{dest.label}</Text>
                      <Text style={styles.resultRegion}>{dest.region}</Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={colors.border}
                    />
                  </PressableScale>
                ))}
              </>
            )}

            {/* No results */}
            {search.length >= 2 && liveResults.length === 0 && (
              <View style={styles.noResults}>
                <MaterialCommunityIcons
                  name="map-search-outline"
                  size={40}
                  color={colors.textTertiary}
                />
                <Text style={styles.noResultsText}>
                  No destinations match "{search}"
                </Text>
                <Text style={styles.noResultsHint}>
                  Try "beaches", "mountains", or a city name
                </Text>
              </View>
            )}

            {/* Quick Searches — show when search is empty */}
            {search.length === 0 && (
              <>
                <Text style={styles.sectionLabel}>Quick Searches</Text>
                <View style={styles.quickGrid}>
                  {QUICK_SEARCHES.map((qs) => (
                    <PressableScale
                      key={qs.query}
                      style={styles.quickChip}
                      onPress={() => onSearchChange(qs.query)}
                      accessibilityRole="button"
                      accessibilityLabel={`Search for ${qs.query}`}
                    >
                      <MaterialCommunityIcons
                        name={qs.icon as any}
                        size={18}
                        color={qs.color}
                      />
                      <Text style={styles.quickText}>{qs.query}</Text>
                    </PressableScale>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Recent Searches</Text>
                <View style={styles.recentRow}>
                  {recentSearches.map((s, i) => (
                    <TouchableOpacity
                      key={`${s}-${i}`}
                      style={styles.recentChip}
                      onPress={() => onSearchChange(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`Search for ${s}`}
                    >
                      <MaterialCommunityIcons
                        name="history"
                        size={14}
                        color={colors.textTertiary}
                      />
                      <Text style={styles.recentText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Trending Destinations</Text>
                {destinations.slice(0, 5).map((dest) => (
                  <PressableScale
                    key={dest.id}
                    style={styles.trendingRow}
                    onPress={() => onResultPress(dest)}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to ${dest.label}`}
                  >
                    <MaterialCommunityIcons
                      name="fire"
                      size={18}
                      color="#EF4444"
                    />
                    <Text style={styles.trendingText}>{dest.label}</Text>
                    <Text style={styles.trendingRegion}>{dest.region}</Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={colors.border}
                    />
                  </PressableScale>
                ))}
              </>
            )}
          </ScrollView>
        </ReAnimated.View>
      </ReAnimated.View>
    );
  },
);
SearchOverlay.displayName = "SearchOverlay";

export default SearchOverlay;

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248,250,252,0.95)",
    zIndex: 100,
  },
  content: {
    flex: 1,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: spacing.md,
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 2,
    borderColor: colors.darkBackground,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.darkBackground,
    fontWeight: "500",
    marginLeft: 12,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  closeText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  quickText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  recentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: 6,
  },
  recentText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  trendingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  trendingText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 12,
  },
  trendingRegion: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 8,
  },
  intentBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    gap: 6,
    marginBottom: spacing.md,
  },
  intentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7C3AED",
  },
  // Live results (fix #6)
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EBF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  resultRegion: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  noResults: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  noResultsHint: {
    fontSize: 13,
    color: colors.textTertiary,
  },
});
