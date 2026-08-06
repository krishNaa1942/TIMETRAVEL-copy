/**
 * DestinationDetailScreen - Flagship Production Experience
 * A world-class destination detail view inspired by Airbnb & MakeMyTrip
 *
 * Features:
 * - Immersive hero with parallax animation
 * - Quick stats with real-time weather & safety data
 * - Photo gallery with full-screen viewer
 * - Budget preview with trip planning actions
 * - Haptic feedback for enhanced UX
 * - Full accessibility support
 */

import React, { useCallback, memo, useMemo, useState, useRef } from "react";
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  Dimensions,
  AccessibilityInfo,
  Animated,
  Share,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { Text, Button, IconButton } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useDestinationDetail } from "@/hooks/useDestinationDetail";
import { DestinationDetailSkeleton } from "@/components/UI/SkeletonLoader";
import { toast } from "@/components/UI/ToastHost";
import WeatherCard from "@/components/Features/WeatherCard";
import SafetyBadge from "@/components/Features/SafetyBadge";
import { PressableScale } from "@/components/UI/PressableScale";
import { UnsplashImage, Destination } from "@/types";
import { RootStackParamList } from "@/navigation/types";
import { colors, spacing } from "@/theme/colors";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type RouteType = RouteProp<RootStackParamList, "DestinationDetail">;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PHOTO_WIDTH = SCREEN_WIDTH * 0.65;
const HERO_HEIGHT = 340;
const heroTitleShadow = Platform.select({
  web: { textShadow: "0px 2px 8px rgba(0,0,0,0.5)" } as any,
  default: {
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

/** Format budget amount to Indian notation */
const formatBudget = (amount: number): string => {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
};

/** Get budget level classification */
const getBudgetLevel = (amount: number): { label: string; color: string } => {
  if (amount < 15000) return { label: "Budget-friendly", color: "#10B981" };
  if (amount < 35000) return { label: "Moderate", color: "#F59E0B" };
  return { label: "Premium", color: "#EF4444" };
};

/** Trigger haptic feedback based on platform */
const triggerHaptic = async (style: "light" | "medium" | "heavy" = "light") => {
  if (Platform.OS !== "web") {
    try {
      switch (style) {
        case "light":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case "medium":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case "heavy":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } catch {
      // Haptics not available
    }
  }
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface QuickStatCardProps {
  icon: string;
  label: string;
  value: string;
  color?: string;
  testID?: string;
}

const QuickStatCard = memo(
  ({
    icon,
    label,
    value,
    color = colors.primary,
    testID,
  }: QuickStatCardProps) => (
    <View
      style={styles.quickStatCard}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={[styles.quickStatIcon, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.quickStatValue}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  ),
);

QuickStatCard.displayName = "QuickStatCard";

// ─────────────────────────────────────────────────────────────

interface HeroSectionProps {
  destination: Destination;
  heroImage: string | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
  onShare: () => void;
  scrollY: Animated.Value;
}

const HeroSection = memo(
  ({
    destination,
    heroImage,
    isFavorite,
    onToggleFavorite,
    onBack,
    onShare,
    scrollY,
  }: HeroSectionProps) => {
    const handleFavoritePress = useCallback(async () => {
      await triggerHaptic("medium");
      try {
        await onToggleFavorite();
        AccessibilityInfo.announceForAccessibility(
          isFavorite ? "Removed from favorites" : "Added to favorites",
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update favorite";
        Alert.alert("Error", message);
      }
    }, [onToggleFavorite, isFavorite]);

    const handleBackPress = useCallback(async () => {
      await triggerHaptic("light");
      onBack();
    }, [onBack]);

    const handleSharePress = useCallback(async () => {
      await triggerHaptic("light");
      onShare();
    }, [onShare]);

    const heroTranslateY = scrollY.interpolate({
      inputRange: [-HERO_HEIGHT, 0, HERO_HEIGHT],
      outputRange: [-HERO_HEIGHT / 2, 0, HERO_HEIGHT / 3],
      extrapolate: "clamp",
    });

    const heroScale = scrollY.interpolate({
      inputRange: [-HERO_HEIGHT, 0],
      outputRange: [2, 1],
      extrapolate: "clamp",
    });

    const headerOpacity = scrollY.interpolate({
      inputRange: [0, HERO_HEIGHT - 100, HERO_HEIGHT - 50],
      outputRange: [0, 0, 1],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[
          styles.heroContainer,
          { transform: [{ translateY: heroTranslateY }, { scale: heroScale }] },
        ]}
      >
        {heroImage ? (
          <Image
            source={{ uri: heroImage }}
            style={styles.heroImage}
            resizeMode="cover"
            accessible={true}
            accessibilityLabel={`Photo of ${destination.label}`}
          />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <MaterialCommunityIcons
              name="image-off"
              size={64}
              color={colors.gray}
            />
          </View>
        )}
        <View style={styles.heroOverlay} />

        {/* Header Actions */}
        <View style={styles.heroTopActions}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor="#FFF"
            style={styles.iconButton}
            onPress={handleBackPress}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          />
          <View style={styles.heroRightActions}>
            <IconButton
              icon="share-variant"
              size={22}
              iconColor="#FFF"
              style={styles.iconButton}
              onPress={handleSharePress}
              accessibilityLabel="Share destination"
              accessibilityRole="button"
            />
            <PressableScale
              style={[styles.favButton, isFavorite && styles.favButtonActive]}
              onPress={handleFavoritePress}
              accessibilityLabel={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
              accessibilityRole="button"
              accessibilityState={{ selected: isFavorite }}
            >
              <MaterialCommunityIcons
                name={isFavorite ? "heart" : "heart-outline"}
                size={22}
                color={isFavorite ? colors.error : "#FFF"}
              />
            </PressableScale>
          </View>
        </View>

        {/* Destination Title */}
        <View style={styles.heroTextArea}>
          <Text
            style={[styles.heroTitle, heroTitleShadow]}
            accessibilityRole="header"
          >
            {destination.label}
          </Text>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={16}
              color="rgba(255,255,255,0.9)"
            />
            <Text style={styles.heroRegion}>{destination.region}</Text>
          </View>
        </View>
      </Animated.View>
    );
  },
);

HeroSection.displayName = "HeroSection";

// ─────────────────────────────────────────────────────────────

interface TagChipsProps {
  bestSeason?: string;
  categories?: string[];
}

const TagChips = memo(({ bestSeason, categories }: TagChipsProps) => {
  if (!bestSeason && (!categories || categories.length === 0)) return null;

  return (
    <View
      style={styles.chipsContainer}
      accessible={true}
      accessibilityLabel="Tags and categories"
    >
      {bestSeason && (
        <View
          style={styles.seasonChip}
          accessible={true}
          accessibilityLabel={`Best season: ${bestSeason}`}
        >
          <MaterialCommunityIcons name="calendar-star" size={14} color="#FFF" />
          <Text style={styles.seasonChipText}>Best: {bestSeason}</Text>
        </View>
      )}
      {categories?.slice(0, 4).map((category, index) => (
        <View
          key={`category-${index}`}
          style={styles.chip}
          accessible={true}
          accessibilityLabel={`Category: ${category}`}
        >
          <Text style={styles.chipText}>
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Text>
        </View>
      ))}
    </View>
  );
});

TagChips.displayName = "TagChips";

// ─────────────────────────────────────────────────────────────

interface HighlightTextProps {
  highlight?: string;
}

const HighlightText = memo(({ highlight }: HighlightTextProps) => {
  if (!highlight) return null;

  return (
    <View
      style={styles.highlightContainer}
      accessible={true}
      accessibilityLabel="Highlight"
    >
      <View style={styles.highlightIcon}>
        <MaterialCommunityIcons
          name="format-quote-open"
          size={24}
          color={colors.primary}
        />
      </View>
      <Text style={styles.highlightText}>{highlight}</Text>
    </View>
  );
});

HighlightText.displayName = "HighlightText";

// ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  icon: string;
  actionLabel?: string;
  onAction?: () => void;
}

const SectionHeader = memo(
  ({ title, icon, actionLabel, onAction }: SectionHeaderProps) => (
    <View style={styles.sectionHeader} accessibilityRole="header">
      <View style={styles.sectionHeaderLeft}>
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={colors.primary}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {actionLabel && onAction && (
        <PressableScale
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </PressableScale>
      )}
    </View>
  ),
);

SectionHeader.displayName = "SectionHeader";

// ─────────────────────────────────────────────────────────────

interface BudgetPreviewProps {
  destination: Destination;
  onExpand: () => void;
}

const BudgetPreview = memo(({ destination, onExpand }: BudgetPreviewProps) => {
  const { dailyCost, perDay } = useMemo(() => {
    if (destination.daily_cost && destination.daily_cost > 0) {
      return { dailyCost: destination.daily_cost, perDay: true };
    }
    return {
      dailyCost: destination.priceRange
        ? Math.round(
            (destination.priceRange.min + destination.priceRange.max) / 2,
          )
        : 25000,
      perDay: false,
    };
  }, [destination.daily_cost, destination.priceRange]);

  const budgetLevel = getBudgetLevel(dailyCost);

  const handlePress = useCallback(async () => {
    await triggerHaptic("light");
    onExpand();
  }, [onExpand]);

  return (
    <PressableScale
      style={styles.budgetPreviewCard}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Estimated budget: ${formatBudget(dailyCost)} per ${perDay ? "day" : "trip"}. ${budgetLevel.label}. Tap to plan budget.`}
    >
      <View style={styles.budgetPreviewContent}>
        <View style={styles.budgetPreviewLeft}>
          <View
            style={[
              styles.budgetBadge,
              { backgroundColor: `${budgetLevel.color}15` },
            ]}
          >
            <MaterialCommunityIcons
              name="wallet"
              size={20}
              color={budgetLevel.color}
            />
          </View>
          <View style={styles.budgetPreviewInfo}>
            <Text style={styles.budgetLabel}>
              Estimated {perDay ? "Daily" : "Trip"} Budget
            </Text>
            <Text style={styles.budgetValue}>
              {formatBudget(dailyCost)}
              {perDay ? "/day" : ""}
            </Text>
            <Text
              style={[styles.budgetLevelText, { color: budgetLevel.color }]}
            >
              {budgetLevel.label}
            </Text>
          </View>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={colors.gray}
        />
      </View>
    </PressableScale>
  );
});

BudgetPreview.displayName = "BudgetPreview";

// ─────────────────────────────────────────────────────────────

interface PhotoGalleryProps {
  photos: UnsplashImage[];
  onViewAll: () => void;
  onPhotoPress: (index: number) => void;
}

const PhotoGallery = memo(
  ({ photos, onViewAll, onPhotoPress }: PhotoGalleryProps) => {
    const renderPhoto = useCallback(
      ({ item, index }: { item: UnsplashImage; index: number }) => (
        <PressableScale
          style={styles.photoCard}
          onPress={async () => {
            await triggerHaptic("light");
            onPhotoPress(index);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Photo by ${item.photographer}. Tap to view full screen.`}
        >
          <Image
            source={{ uri: item.url_small || item.url_regular }}
            style={styles.photo}
            resizeMode="cover"
          />
          <View style={styles.photoOverlay}>
            <MaterialCommunityIcons name="camera" size={12} color="#FFF" />
            <Text style={styles.photoCredit} numberOfLines={1}>
              {item.photographer}
            </Text>
          </View>
        </PressableScale>
      ),
      [onPhotoPress],
    );

    const keyExtractor = useCallback((item: UnsplashImage) => item.id, []);
    const getItemLayout = useCallback(
      (_: any, index: number) => ({
        length: PHOTO_WIDTH + 12,
        offset: (PHOTO_WIDTH + 12) * index,
        index,
      }),
      [],
    );

    if (photos.length === 0) return null;

    return (
      <View style={styles.section}>
        <SectionHeader
          title="Photo Gallery"
          icon="image-multiple"
          actionLabel={`View all ${photos.length}`}
          onAction={onViewAll}
        />
        <FlatList
          data={photos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={keyExtractor}
          renderItem={renderPhoto}
          getItemLayout={getItemLayout}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          contentContainerStyle={styles.galleryContent}
          accessible={true}
          accessibilityLabel="Photo gallery"
        />
      </View>
    );
  },
);

PhotoGallery.displayName = "PhotoGallery";

// ─────────────────────────────────────────────────────────────

interface PhotoViewerModalProps {
  visible: boolean;
  photos: UnsplashImage[];
  initialIndex: number;
  onClose: () => void;
}

const PhotoViewerModal = memo(
  ({ visible, photos, initialIndex, onClose }: PhotoViewerModalProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const flatListRef = useRef<FlatList>(null);

    // Reset index when modal opens
    React.useEffect(() => {
      if (visible) {
        setCurrentIndex(initialIndex);

        const t = setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: initialIndex,
            animated: false,
          });
        }, 100);
        return () => clearTimeout(t);
      }
    }, [visible, initialIndex]);

    const renderPhoto = useCallback(
      ({ item }: { item: UnsplashImage }) => (
        <View style={styles.viewerPhotoContainer}>
          <Image
            source={{ uri: item.url_full || item.url_regular }}
            style={styles.viewerPhoto}
            resizeMode="contain"
            accessible={true}
            accessibilityLabel={`Photo by ${item.photographer}`}
          />
          <View style={styles.viewerPhotoInfo}>
            <Text style={styles.viewerPhotoCredit} numberOfLines={1}>
              📸 {item.photographer}
            </Text>
          </View>
        </View>
      ),
      [],
    );

    const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index);
      }
    }, []);

    const keyExtractor = useCallback((item: UnsplashImage) => item.id, []);

    if (photos.length === 0) return null;

    return (
      <Modal
        visible={visible}
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.viewerContainer}>
          {/* Header */}
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.viewerCloseButton}
              accessibilityLabel="Close photo viewer"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.viewerCounter}>
              {currentIndex + 1} / {photos.length}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Photo Carousel */}
          <FlatList
            ref={flatListRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={keyExtractor}
            renderItem={renderPhoto}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />

          {/* Thumbnail Strip */}
          <View style={styles.thumbnailStrip}>
            <FlatList
              data={photos}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.thumbnailContent}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => {
                    setCurrentIndex(index);
                    flatListRef.current?.scrollToIndex({
                      index,
                      animated: true,
                    });
                  }}
                  style={[
                    styles.thumbnail,
                    index === currentIndex && styles.thumbnailActive,
                  ]}
                >
                  <Image
                    source={{ uri: item.url_thumb }}
                    style={styles.thumbnailImage}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    );
  },
);

PhotoViewerModal.displayName = "PhotoViewerModal";

// ─────────────────────────────────────────────────────────────

interface ActionBarProps {
  onBudgetPress: () => void;
  onItineraryPress: () => void;
  onChatPress: () => void;
  onPackingPress: () => void;
  onComparePress: () => void;
  onDirectionsPress: () => void;
}

const ActionBar = memo(
  ({
    onBudgetPress,
    onItineraryPress,
    onChatPress,
    onPackingPress,
    onComparePress,
    onDirectionsPress,
  }: ActionBarProps) => {
    const handlePress = useCallback(async (action: () => void) => {
      await triggerHaptic("light");
      action();
    }, []);

    return (
      <View style={styles.actionBarContainer}>
        <View style={styles.actionBarRow}>
          <PressableScale
            style={styles.actionBarItem}
            onPress={() => handlePress(onBudgetPress)}
            accessibilityRole="button"
            accessibilityLabel="Plan your budget"
          >
            <View
              style={[
                styles.actionBarIcon,
                { backgroundColor: `${colors.primary}15` },
              ]}
            >
              <MaterialCommunityIcons
                name="calculator-variant"
                size={22}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionBarLabel}>Budget</Text>
          </PressableScale>

          <PressableScale
            style={styles.actionBarItem}
            onPress={() => handlePress(onItineraryPress)}
            accessibilityRole="button"
            accessibilityLabel="Create itinerary"
          >
            <View
              style={[
                styles.actionBarIcon,
                { backgroundColor: `${colors.secondary}15` },
              ]}
            >
              <MaterialCommunityIcons
                name="map-marker-path"
                size={22}
                color={colors.secondary}
              />
            </View>
            <Text style={styles.actionBarLabel}>Itinerary</Text>
          </PressableScale>

          <PressableScale
            style={styles.actionBarItem}
            onPress={() => handlePress(onChatPress)}
            accessibilityRole="button"
            accessibilityLabel="Ask AI assistant"
          >
            <View
              style={[
                styles.actionBarIcon,
                { backgroundColor: "rgba(16, 185, 129, 0.08)" },
              ]}
            >
              <MaterialCommunityIcons
                name="robot-outline"
                size={22}
                color="#10B981"
              />
            </View>
            <Text style={styles.actionBarLabel}>Ask AI</Text>
          </PressableScale>

          <PressableScale
            style={styles.actionBarItem}
            onPress={() => handlePress(onPackingPress)}
            accessibilityRole="button"
            accessibilityLabel="Packing checklist"
          >
            <View
              style={[styles.actionBarIcon, { backgroundColor: "#F59E0B15" }]}
            >
              <MaterialCommunityIcons
                name="bag-suitcase"
                size={22}
                color="#F59E0B"
              />
            </View>
            <Text style={styles.actionBarLabel}>Packing</Text>
          </PressableScale>

          <PressableScale
            style={styles.actionBarItem}
            onPress={() => handlePress(onComparePress)}
            accessibilityRole="button"
            accessibilityLabel="Compare this destination"
          >
            <View
              style={[styles.actionBarIcon, { backgroundColor: "#8B5CF615" }]}
            >
              <MaterialCommunityIcons
                name="compare-horizontal"
                size={22}
                color="#8B5CF6"
              />
            </View>
            <Text style={styles.actionBarLabel}>Compare</Text>
          </PressableScale>

          <PressableScale
            style={styles.actionBarItem}
            onPress={() => handlePress(onDirectionsPress)}
            accessibilityRole="button"
            accessibilityLabel="Get directions"
          >
            <View
              style={[styles.actionBarIcon, { backgroundColor: "#06B6D415" }]}
            >
              <MaterialCommunityIcons
                name="navigation"
                size={22}
                color="#06B6D4"
              />
            </View>
            <Text style={styles.actionBarLabel}>Directions</Text>
          </PressableScale>
        </View>
      </View>
    );
  },
);

ActionBar.displayName = "ActionBar";

// ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

const ErrorState = memo(({ message, onRetry }: ErrorStateProps) => (
  <View style={styles.errorContainer} accessibilityRole="alert">
    <View style={styles.errorIconBg}>
      <MaterialCommunityIcons
        name="alert-circle-outline"
        size={48}
        color={colors.error}
      />
    </View>
    <Text style={styles.errorTitle}>Unable to Load</Text>
    <Text style={styles.errorMessage}>{message}</Text>
    <Button
      mode="contained"
      onPress={onRetry}
      buttonColor={colors.primary}
      style={styles.retryButton}
      icon="refresh"
      accessibilityRole="button"
      accessibilityLabel="Try again"
    >
      Try Again
    </Button>
  </View>
));

ErrorState.displayName = "ErrorState";

// ─────────────────────────────────────────────────────────────

interface TravelTipCardProps {
  tip: string;
  icon: string;
}

const TravelTipCard = memo(({ tip, icon }: TravelTipCardProps) => (
  <View
    style={styles.tipCard}
    accessible={true}
    accessibilityLabel={`Tip: ${tip}`}
  >
    <MaterialCommunityIcons
      name={icon as any}
      size={18}
      color={colors.primary}
    />
    <Text style={styles.tipText}>{tip}</Text>
  </View>
));

TravelTipCard.displayName = "TravelTipCard";

// ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title: string;
  message: string;
  icon: string;
}

const EmptyState = memo(({ title, message, icon }: EmptyStateProps) => (
  <View
    style={styles.emptyContainer}
    accessible={true}
    accessibilityLabel={`${title}: ${message}`}
  >
    <MaterialCommunityIcons name={icon as any} size={48} color={colors.gray} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyMessage}>{message}</Text>
  </View>
));

EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function DestinationDetailScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavProp>();
  const { destination } = route.params;

  const scrollY = useRef(new Animated.Value(0)).current;
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const {
    heroImage,
    weather,
    safety,
    photos,
    isFavorite,
    isLoading,
    isRefreshing,
    error,
    hasPartialError,
    refresh,
    toggleFavorite,
    retry,
  } = useDestinationDetail(destination);

  // ─────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleBudgetPress = useCallback(() => {
    navigation.navigate("Budget", { destination });
  }, [navigation, destination]);

  const handleItineraryPress = useCallback(() => {
    navigation.navigate("Itinerary", { query: destination.label });
  }, [navigation, destination]);

  const handleChatPress = useCallback(() => {
    // Chat is in BottomTabNavigator, navigate to MainTabs → Chat tab
    navigation.navigate("MainTabs", { screen: "Chat" });
  }, [navigation]);

  const handlePackingPress = useCallback(() => {
    navigation.navigate("Packing");
  }, [navigation]);

  const handleComparePress = useCallback(() => {
    navigation.navigate("Compare", { dest1: destination.label });
  }, [navigation, destination]);

  const handleDirectionsPress = useCallback(() => {
    const query = `${destination.lat},${destination.lon}`;
    const url =
      Platform.OS === "ios"
        ? `maps://app?daddr=${encodeURIComponent(query)}`
        : `google.navigation:q=${encodeURIComponent(query)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Unable to open Maps", "No maps app is available."),
    );
  }, [destination]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out ${destination.label}, ${destination.region}! 🌴\n\n${destination.tagline || ""}\n\nPlan your trip with TimeTravel AI.`,
        title: destination.label,
      });
    } catch (error) {
      toast.error("Could not share this destination");
      console.error("Share failed:", error);
    }
  }, [destination]);

  const handlePhotoPress = useCallback((index: number) => {
    setSelectedPhotoIndex(index);
    setShowPhotoViewer(true);
  }, []);

  const handleOpenPhotoViewer = useCallback(() => {
    setSelectedPhotoIndex(0);
    setShowPhotoViewer(true);
  }, []);

  const handleClosePhotoViewer = useCallback(() => {
    setShowPhotoViewer(false);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // DERIVED DATA
  // ─────────────────────────────────────────────────────────────

  /** Generate travel tips based on destination categories - case-insensitive matching */
  const travelTips = useMemo(() => {
    const tips: { tip: string; icon: string }[] = [];
    const categories = destination.category?.map((c) => c.toLowerCase()) || [];

    if (destination.best_season) {
      tips.push({
        tip: `Best time to visit: ${destination.best_season}`,
        icon: "calendar-check",
      });
    }

    if (categories.includes("beach")) {
      tips.push({
        tip: "Don't forget sunscreen and beachwear!",
        icon: "umbrella",
      });
    }

    if (categories.includes("mountain") || categories.includes("hills")) {
      tips.push({
        tip: "Pack warm clothes for cool evenings",
        icon: "weather-snowy",
      });
    }

    if (categories.includes("heritage") || categories.includes("religious")) {
      tips.push({
        tip: "Dress modestly for temple visits",
        icon: "account-details",
      });
    }

    if (categories.includes("adventure")) {
      tips.push({
        tip: "Book adventure activities in advance",
        icon: "hiking",
      });
    }

    // Generic tips
    tips.push({ tip: "Book accommodations early for best rates", icon: "bed" });
    tips.push({
      tip: "Keep a copy of important documents",
      icon: "file-document",
    });

    return tips.slice(0, 4); // Limit to 4 tips
  }, [destination]);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.container}>
        <DestinationDetailSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={retry} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS !== "web" },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            accessibilityLabel="Pull to refresh"
          />
        }
      >
        <HeroSection
          destination={destination}
          heroImage={heroImage}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
          onBack={handleBack}
          onShare={handleShare}
          scrollY={scrollY}
        />

        {/* Quick Stats */}
        <View style={styles.quickStatsContainer}>
          <QuickStatCard
            icon="thermometer"
            label="Weather"
            value={
              weather ? `${Math.round(weather.temperature_c || 0)}°C` : "--"
            }
            color="#F59E0B"
            testID="weather-stat"
          />
          <QuickStatCard
            icon="shield-check"
            label={safety?.is_estimated ? "Safety (est.)" : "Safety"}
            value={safety ? `${safety.overall_score}/10` : "--"}
            color={
              !safety
                ? "#94A3B8"
                : safety.is_estimated
                  ? "#94A3B8"
                  : safety.overall_score >= 7
                    ? "#10B981"
                    : "#F59E0B"
            }
            testID="safety-stat"
          />
          <QuickStatCard
            icon="image-multiple"
            label="Photos"
            value={`${photos.length}`}
            color="#8B5CF6"
            testID="photos-stat"
          />
          {destination.rating !== undefined && (
            <QuickStatCard
              icon="star"
              label="Rating"
              value={`${destination.rating}/5`}
              color="#F59E0B"
              testID="rating-stat"
            />
          )}
          {destination.daily_cost !== undefined && (
            <QuickStatCard
              icon="currency-inr"
              label="Cost/Day"
              value={formatBudget(destination.daily_cost)}
              color="#10B981"
              testID="daily-cost-stat"
            />
          )}
        </View>

        <TagChips
          bestSeason={destination.best_season}
          categories={destination.category}
        />
        <HighlightText highlight={destination.highlight} />

        {/* Budget Preview */}
        <View style={styles.section}>
          <BudgetPreview
            destination={destination}
            onExpand={handleBudgetPress}
          />
        </View>

        {/* Partial Error Banner */}
        {hasPartialError && (
          <View style={styles.partialErrorBanner} accessibilityRole="alert">
            <MaterialCommunityIcons
              name="information-outline"
              size={16}
              color="#92400E"
            />
            <Text style={styles.partialErrorText}>
              Some information may be unavailable
            </Text>
          </View>
        )}

        {/* Weather Section */}
        {weather ? (
          <View style={styles.section}>
            <SectionHeader
              title="Current Weather"
              icon="weather-partly-cloudy"
            />
            <WeatherCard weather={weather} />
          </View>
        ) : null}

        {/* Safety Section */}
        {safety ? (
          <View style={styles.section}>
            <SectionHeader title="Safety Information" icon="shield-check" />
            <SafetyBadge safety={safety} />
          </View>
        ) : null}

        {/* Travel Tips */}
        {travelTips.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Travel Tips" icon="lightbulb-outline" />
            <View
              style={styles.tipsContainer}
              accessible={true}
              accessibilityLabel="Travel tips"
            >
              {travelTips.map((tip, idx) => (
                <TravelTipCard
                  key={`tip-${idx}`}
                  tip={tip.tip}
                  icon={tip.icon}
                />
              ))}
            </View>
          </View>
        )}

        {/* Photo Gallery */}
        <PhotoGallery
          photos={photos}
          onViewAll={handleOpenPhotoViewer}
          onPhotoPress={handlePhotoPress}
        />

        {/* Action Bar */}
        <ActionBar
          onBudgetPress={handleBudgetPress}
          onItineraryPress={handleItineraryPress}
          onChatPress={handleChatPress}
          onPackingPress={handlePackingPress}
          onComparePress={handleComparePress}
          onDirectionsPress={handleDirectionsPress}
        />

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>

      {/* Full-screen Photo Viewer */}
      <PhotoViewerModal
        visible={showPhotoViewer}
        photos={photos}
        initialIndex={selectedPhotoIndex}
        onClose={handleClosePhotoViewer}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Hero
  heroContainer: {
    position: "relative",
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    backgroundColor: colors.darkBackground || "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroTopActions: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 44,
  },
  heroRightActions: {
    flexDirection: "row",
    gap: 4,
  },
  iconButton: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    margin: 0,
  },
  favButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  favButtonActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  heroTextArea: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 80,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFF",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  heroRegion: {
    fontSize: 15,
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
    marginLeft: 4,
  },

  // Quick Stats
  quickStatsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  quickStatLabel: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 2,
  },

  // Chips
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  seasonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  seasonChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFF",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },

  // Highlight
  highlightContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  highlightIcon: {
    marginRight: 8,
  },
  highlightText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    fontStyle: "italic",
    flex: 1,
  },

  // Section
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },

  // Budget Preview
  budgetPreviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetPreviewContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetPreviewLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  budgetBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetPreviewInfo: {
    flex: 1,
  },
  budgetLabel: {
    fontSize: 12,
    color: colors.gray,
  },
  budgetValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  budgetLevelText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },

  // Photo Gallery
  galleryContent: {
    paddingRight: 16,
  },
  photoCard: {
    width: PHOTO_WIDTH,
    marginRight: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  photo: {
    width: "100%",
    height: 160,
  },
  photoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  photoCredit: {
    fontSize: 11,
    color: "#FFF",
    marginLeft: 4,
    flex: 1,
  },

  // Photo Viewer Modal
  viewerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  viewerCloseButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCounter: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  viewerPhotoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 200,
    justifyContent: "center",
    alignItems: "center",
  },
  viewerPhoto: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 250,
  },
  viewerPhotoInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  viewerPhotoCredit: {
    color: "#FFF",
    fontSize: 14,
  },
  thumbnailStrip: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
  },
  thumbnailContent: {
    paddingHorizontal: 16,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 8,
    overflow: "hidden",
    opacity: 0.6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbnailActive: {
    opacity: 1,
    borderColor: "#FFF",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },

  // Action Bar
  actionBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  actionBarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  actionBarItem: {
    alignItems: "center",
    gap: 6,
    width: SCREEN_WIDTH / 3 - 26,
  },
  actionBarIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBarLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.text,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorIconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${colors.error}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.gray,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 24,
    borderRadius: 12,
  },

  // Tips
  tipsContainer: {
    gap: 8,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },

  // Partial Error
  partialErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
  },
  partialErrorText: {
    fontSize: 13,
    color: "#92400E",
    marginLeft: 8,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginTop: 12,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.gray,
    textAlign: "center",
    marginTop: 4,
  },

  // Bottom
  bottomSpacer: {
    height: 32,
  },
});
