import React, { memo, useCallback, useMemo, useRef } from "react";
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
  TextInput,
} from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GlassCard } from "@/components/UI/GlassCard";
import { PressableScale } from "@/components/UI/PressableScale";
import type { Destination } from "@/types";

import { getDestinationColor } from "../utils/formatters";
import type { ComparePalette } from "../utils/formatters";

const normalizeSearchText = (value: string): string =>
  value.trim().toLowerCase();

const matchesDestinationQuery = (destination: Destination, query: string): boolean => {
  if (!query) {
    return true;
  }

  const haystack = [
    destination.label,
    destination.region,
    destination.best_season,
    destination.highlight,
    destination.tagline,
    destination.category.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
};

interface DestinationSelectorProps {
  destinations: Destination[];
  selectedDestinations: Destination[];
  activeDestinationId: string | null;
  maxDestinations: number;
  isLoading: boolean;
  palette: ComparePalette;
  onToggleDestination: (destination: Destination) => void;
  onRemoveDestination: (destinationId: string) => void;
  onSetActiveDestination: (destinationId: string) => void;
  onSwapTopTwo: () => void;
}

interface DestinationCardProps {
  destination: Destination;
  index: number;
  isActive: boolean;
  palette: ComparePalette;
  onActivate: (destinationId: string) => void;
  onRemove: (destinationId: string) => void;
}

const DestinationCard = memo(
  ({
    destination,
    index,
    isActive,
    palette,
    onActivate,
    onRemove,
  }: DestinationCardProps) => {
    const accent = getDestinationColor(index);

    return (
      <PressableScale
        onPress={() => onActivate(destination.id)}
        style={[
          styles.selectedCard,
          {
            backgroundColor: palette.surfaceElevated,
            borderColor: isActive ? accent : palette.border,
          },
        ]}
      >
        <View style={styles.selectedCardTopRow}>
          <View style={[styles.colorSwatch, { backgroundColor: accent }]} />
          <Chip
            compact
            style={[
              styles.activeChip,
              {
                backgroundColor: isActive ? `${accent}18` : palette.accentSoft,
              },
            ]}
            textStyle={{ color: isActive ? accent : palette.muted }}
          >
            {isActive ? "Active" : `#${index + 1}`}
          </Chip>
        </View>

        <Text
          variant="titleLarge"
          style={[styles.selectedTitle, { color: palette.text }]}
          numberOfLines={1}
        >
          {destination.label}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.selectedSubtitle, { color: palette.muted }]}
          numberOfLines={1}
        >
          {destination.region}
        </Text>

        <View style={styles.metaRow}>
          <Text
            variant="bodySmall"
            style={{ color: palette.muted }}
            numberOfLines={1}
          >
            {destination.best_season}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: palette.muted }}
            numberOfLines={1}
          >
            {destination.category.slice(0, 2).join(" · ")}
          </Text>
        </View>

        <Text
          variant="bodySmall"
          style={[styles.tagline, { color: palette.text }]}
          numberOfLines={3}
        >
          {destination.tagline}
        </Text>

        <View style={styles.cardActions}>
          <Button
            mode="text"
            compact
            onPress={() => onActivate(destination.id)}
          >
            Focus
          </Button>
          <Button
            mode="text"
            compact
            textColor={palette.danger}
            onPress={() => onRemove(destination.id)}
          >
            Remove
          </Button>
        </View>
      </PressableScale>
    );
  },
);

DestinationCard.displayName = "DestinationCard";

const AvailableChip = memo(
  ({
    destination,
    selected,
    palette,
    onToggle,
  }: {
    destination: Destination;
    selected: boolean;
    palette: ComparePalette;
    onToggle: (destination: Destination) => void;
  }) => (
    <PressableScale
      onPress={() => onToggle(destination)}
      style={[
        styles.availableChip,
        {
          borderColor: selected ? palette.accent : palette.border,
          backgroundColor: selected ? `${palette.accent}14` : palette.surface,
        },
      ]}
    >
      <Text
        style={[
          styles.availableLabel,
          { color: selected ? palette.accent : palette.text },
        ]}
        numberOfLines={1}
      >
        {destination.label}
      </Text>
      <MaterialCommunityIcons
        name={selected ? "check-circle" : "plus-circle-outline"}
        size={14}
        color={selected ? palette.accent : palette.muted}
      />
    </PressableScale>
  ),
);

AvailableChip.displayName = "AvailableChip";

export const DestinationSelector = memo(
  ({
    destinations,
    selectedDestinations,
    activeDestinationId,
    maxDestinations,
    isLoading,
    palette,
    onToggleDestination,
    onRemoveDestination,
    onSetActiveDestination,
    onSwapTopTwo,
  }: DestinationSelectorProps) => {
    const [searchQuery, setSearchQuery] = React.useState("");
    const { width } = useWindowDimensions();
    const cardWidth = Math.min(width - 48, 312);
    const itemWidth = cardWidth + 12;
    const carouselRef = useRef<FlatList<Destination>>(null);

    const normalizedQuery = normalizeSearchText(searchQuery);
    const selectedCountLabel = `${selectedDestinations.length}/${maxDestinations} selected`;
    const filteredDestinations = useMemo(
      () =>
        destinations.filter((destination) =>
          matchesDestinationQuery(destination, normalizedQuery),
        ),
      [destinations, normalizedQuery],
    );
    const resultsLabel = normalizedQuery
      ? `${filteredDestinations.length} result${filteredDestinations.length === 1 ? "" : "s"}`
      : `${destinations.length} destinations`;

    const handleMomentumScrollEnd = useCallback(
      (event: { nativeEvent: { contentOffset: { x: number } } }) => {
        if (selectedDestinations.length === 0) {
          return;
        }

        const nextIndex = Math.round(
          event.nativeEvent.contentOffset.x / itemWidth,
        );
        const nextDestination = selectedDestinations[nextIndex];
        if (nextDestination) {
          onSetActiveDestination(nextDestination.id);
        }
      },
      [itemWidth, onSetActiveDestination, selectedDestinations],
    );

    const renderSelectedDestination = useCallback(
      ({ item, index }: { item: Destination; index: number }) => (
        <DestinationCard
          destination={item}
          index={index}
          isActive={item.id === activeDestinationId}
          palette={palette}
          onActivate={onSetActiveDestination}
          onRemove={onRemoveDestination}
        />
      ),
      [
        activeDestinationId,
        onRemoveDestination,
        onSetActiveDestination,
        palette,
      ],
    );

    const renderAvailableDestination = useCallback(
      ({ item }: { item: Destination }) => (
        <AvailableChip
          destination={item}
          selected={selectedDestinations.some(
            (selected) => selected.id === item.id,
          )}
          palette={palette}
          onToggle={onToggleDestination}
        />
      ),
      [onToggleDestination, palette, selectedDestinations],
    );

    const handleClearSearch = useCallback(() => {
      setSearchQuery("");
    }, []);

    return (
      <GlassCard
        style={[
          styles.card,
          {
            backgroundColor: palette.surfaceElevated,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text
              variant="titleMedium"
              style={[styles.title, { color: palette.text }]}
            >
              Choose destinations
            </Text>
            <Text
              variant="bodySmall"
              style={[styles.subtitle, { color: palette.muted }]}
            >
              Select 2 to 5 destinations and swipe between the selected cards.
            </Text>
          </View>
          <Chip
            compact
            style={[styles.countChip, { backgroundColor: palette.accentSoft }]}
            textStyle={{ color: palette.accent }}
          >
            {selectedCountLabel}
          </Chip>
        </View>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={palette.muted}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search destinations, regions, seasons, categories..."
            placeholderTextColor={palette.muted}
            style={[styles.searchInput, { color: palette.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search destinations"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={handleClearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear destination search"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={palette.muted}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.searchMetaRow}>
          <Text variant="labelSmall" style={{ color: palette.muted }}>
            Search smarter with destination name, region, category, highlight, or season
          </Text>
          <Chip compact style={[styles.resultsChip, { backgroundColor: palette.accentSoft }]} textStyle={{ color: palette.accent }}>
            {resultsLabel}
          </Chip>
        </View>

        <View style={styles.selectedSection}>
          <View style={styles.sectionHeader}>
            <Text variant="labelMedium" style={{ color: palette.muted }}>
              Selected deck
            </Text>
            <Button
              mode="text"
              compact
              icon="swap-horizontal"
              disabled={selectedDestinations.length < 2}
              onPress={onSwapTopTwo}
            >
              Swap first two
            </Button>
          </View>

          {isLoading ? (
            <Text variant="bodyMedium" style={{ color: palette.muted }}>
              Loading destinations...
            </Text>
          ) : selectedDestinations.length > 0 ? (
            <FlatList
              ref={carouselRef}
              data={selectedDestinations}
              horizontal
              pagingEnabled
              snapToInterval={itemWidth}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={renderSelectedDestination}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          ) : (
            <View style={styles.emptyBlock}>
              <MaterialCommunityIcons
                name="cards-variant"
                size={18}
                color={palette.muted}
              />
              <Text variant="bodySmall" style={{ color: palette.muted }}>
                Pick two destinations to start the comparison.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.availableSection}>
          <View style={styles.sectionHeader}>
            <Text variant="labelMedium" style={{ color: palette.muted }}>
              All destinations
            </Text>
            <Text variant="labelSmall" style={{ color: palette.muted }}>
              Tap to add or remove
            </Text>
          </View>

          {filteredDestinations.length > 0 ? (
            <FlatList
              data={filteredDestinations}
              horizontal
              keyExtractor={(item) => item.id}
              renderItem={renderAvailableDestination}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.availableList}
              ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
            />
          ) : (
            <View style={styles.emptySearchState}>
              <MaterialCommunityIcons
                name="map-search-outline"
                size={18}
                color={palette.muted}
              />
              <View style={styles.emptySearchTextBlock}>
                <Text variant="bodyMedium" style={{ color: palette.text }}>
                  No destinations match "{searchQuery.trim()}"
                </Text>
                <Text variant="bodySmall" style={{ color: palette.muted }}>
                  Try a destination name, region, category, or season.
                </Text>
              </View>
              <Button mode="text" compact onPress={handleClearSearch}>
                Clear
              </Button>
            </View>
          )}
        </View>
      </GlassCard>
    );
  },
);

DestinationSelector.displayName = "DestinationSelector";

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 22,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  title: {
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 18,
  },
  countChip: {
    borderRadius: 999,
  },
  selectedSection: {
    marginTop: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  carouselContent: {
    paddingRight: 12,
  },
  selectedCard: {
    width: 300,
    minHeight: 180,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  selectedCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  colorSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  activeChip: {
    borderRadius: 999,
  },
  selectedTitle: {
    fontWeight: "900",
  },
  selectedSubtitle: {
    marginTop: -2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  tagline: {
    lineHeight: 20,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  availableSection: {
    marginTop: 16,
    gap: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  resultsChip: {
    borderRadius: 999,
  },
  availableList: {
    paddingRight: 8,
  },
  availableChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  availableLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyBlock: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptySearchState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  emptySearchTextBlock: {
    flex: 1,
    gap: 2,
  },
});
