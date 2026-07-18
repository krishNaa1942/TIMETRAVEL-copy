import React, { memo, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { PressableScale } from "@/components/UI/PressableScale";
import { colors, spacing } from "@/theme/colors";
import type { TripData } from "@/services/tripPlanner";

interface TripSelectorProps {
  trips: TripData[];
  selectedTripId: number | null;
  activeShareTripIds: ReadonlySet<number>;
  loading: boolean;
  errorMessage: string | null;
  onSelectTrip: (tripId: number) => void;
  onRetry: () => void;
}

interface TripChipProps {
  trip: TripData;
  isSelected: boolean;
  hasActiveShare: boolean;
  onSelectTrip: (tripId: number) => void;
}

const TripChip = memo(
  ({ trip, isSelected, hasActiveShare, onSelectTrip }: TripChipProps) => {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`Select trip ${trip.title}`}
        onPress={() => onSelectTrip(trip.id)}
        style={[
          styles.tripChip,
          isSelected && styles.tripChipSelected,
          hasActiveShare && styles.tripChipShared,
        ]}
      >
        <View style={styles.tripChipTopRow}>
          <View style={styles.tripChipTextBlock}>
            <Text
              style={[
                styles.tripChipTitle,
                isSelected && styles.tripChipTitleSelected,
              ]}
              numberOfLines={1}
            >
              {trip.title}
            </Text>
            <Text
              style={[
                styles.tripChipSubtitle,
                isSelected && styles.tripChipSubtitleSelected,
              ]}
              numberOfLines={1}
            >
              {trip.destination}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={hasActiveShare ? "link" : "map-marker-path"}
            size={16}
            color={isSelected ? "#FFF" : colors.gray}
          />
        </View>

        <View style={styles.tripChipFooter}>
          <Text
            style={[
              styles.tripChipMeta,
              isSelected && styles.tripChipMetaSelected,
            ]}
          >
            {trip.num_days} day{trip.num_days === 1 ? "" : "s"}
          </Text>
          {hasActiveShare ? (
            <View style={styles.shareBadge}>
              <Text style={styles.shareBadgeText}>Shared</Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
    );
  },
);

TripChip.displayName = "TripChip";

export const TripSelector = memo(
  ({
    trips,
    selectedTripId,
    activeShareTripIds,
    loading,
    errorMessage,
    onSelectTrip,
    onRetry,
  }: TripSelectorProps) => {
    const listEmptyMessage = useMemo(() => {
      if (errorMessage) {
        return null;
      }

      return (
        <EmptyState
          iconName="briefcase-search"
          title="No trips yet"
          message="Create a trip in the Trip Planner first, then come back here to generate a share link."
          actionLabel="Refresh"
          onAction={onRetry}
        />
      );
    }, [errorMessage, onRetry]);

    if (loading) {
      return <LoadingSkeleton variant="trips" count={3} />;
    }

    if (errorMessage) {
      return (
        <ErrorState
          title="Unable to load trips"
          message={errorMessage}
          retryLabel="Reload trips"
          onRetry={onRetry}
        />
      );
    }

    if (trips.length === 0) {
      return listEmptyMessage;
    }

    return (
      <FlatList
        horizontal
        data={trips}
        keyExtractor={(item) => String(item.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tripListContent}
        renderItem={({ item }) => (
          <TripChip
            trip={item}
            isSelected={selectedTripId === item.id}
            hasActiveShare={activeShareTripIds.has(item.id)}
            onSelectTrip={onSelectTrip}
          />
        )}
      />
    );
  },
);

TripSelector.displayName = "TripSelector";

const styles = StyleSheet.create({
  tripListContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
  },
  tripChip: {
    width: 176,
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  tripChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tripChipShared: {
    borderColor: "rgba(37, 99, 235, 0.35)",
  },
  tripChipTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  tripChipTextBlock: {
    flex: 1,
  },
  tripChipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  tripChipTitleSelected: {
    color: "#FFF",
  },
  tripChipSubtitle: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  tripChipSubtitleSelected: {
    color: "rgba(255, 255, 255, 0.82)",
  },
  tripChipFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  tripChipMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tripChipMetaSelected: {
    color: "rgba(255, 255, 255, 0.85)",
  },
  shareBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  shareBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
});
