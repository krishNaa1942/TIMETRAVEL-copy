/**
 * FeatureCard - Premium Glassmorphism Card Component
 * Optimized with React.memo, animations, and accessibility
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { FeatureConfig } from "./types";

// ─────────────────────────────────────────────────────────────
// ANIMATED PRESSABLE COMPONENT
// ─────────────────────────────────────────────────────────────

interface AnimatedFeatureCardProps {
  feature: FeatureConfig;
  onPress: (feature: FeatureConfig) => void;
  onLongPress?: (feature: FeatureConfig) => void;
  isFavorite?: boolean;
  size?: "small" | "medium" | "large";
}

const AnimatedFeatureCard: React.FC<AnimatedFeatureCardProps> = ({
  feature,
  onPress,
  onLongPress,
  isFavorite = false,
  size = "medium",
}) => {
  const { width: screenWidth } = useWindowDimensions();

  // Animation values
  const pressed = useSharedValue(0);
  const scale = useSharedValue(1);

  // Calculate card dimensions
  const cardWidth = useMemo(() => {
    const padding = 32;
    const gap = 16;
    const columns = screenWidth >= 768 ? 3 : screenWidth >= 480 ? 2 : 2;
    return (screenWidth - padding * 2 - gap * (columns - 1)) / columns;
  }, [screenWidth]);

  const cardHeight = size === "large" ? 160 : size === "small" ? 100 : 130;

  // Handle press
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(feature);
  }, [feature, onPress]);

  // Handle long press
  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLongPress(feature);
    }
  }, [feature, onLongPress]);

  // Press in animation
  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: 100 });
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }, []);

  // Press out animation
  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: 200 });
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      {
        translateY: interpolate(
          pressed.value,
          [0, 1],
          [0, 2],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const animatedShineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0, 0.3]),
    transform: [
      {
        translateX: interpolate(pressed.value, [0, 1], [-cardWidth, cardWidth]),
      },
    ],
  }));

  const gradientColors = feature.gradient || ["#667EEA", "#764BA2"];

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { width: cardWidth, height: cardHeight },
        animatedContainerStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
        accessibilityLabel={`${feature.title}. ${feature.description}`}
        accessibilityHint={`Tap to open ${feature.title}`}
        accessibilityRole="button"
      >
        {/* Background Gradient */}
        <LinearGradient
          colors={gradientColors as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Glassmorphism Overlay */}
        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />

        {/* Content */}
        <View style={styles.content}>
          {/* Badge */}
          {feature.badge && (
            <View
              style={[
                styles.badge,
                { backgroundColor: feature.badge.backgroundColor },
              ]}
            >
              <Text style={[styles.badgeText, { color: feature.badge.color }]}>
                {feature.badge.text}
              </Text>
            </View>
          )}

          {/* Favorite indicator */}
          {isFavorite && (
            <View style={styles.favoriteIndicator}>
              <Text style={styles.favoriteIcon}>⭐</Text>
            </View>
          )}

          {/* Emoji */}
          <Text style={styles.emoji} allowFontScaling={false}>
            {feature.emoji}
          </Text>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
            {feature.title}
          </Text>

          {/* Description */}
          {size !== "small" && (
            <Text style={styles.description} numberOfLines={2}>
              {feature.description}
            </Text>
          )}
        </View>

        {/* Shine effect */}
        <Animated.View style={[styles.shine, animatedShineStyle]} />

        {/* Premium overlay */}
        {feature.isPremium && (
          <View style={styles.premiumOverlay}>
            <Text style={styles.premiumText}>PRO</Text>
          </View>
        )}

        {/* Coming soon overlay */}
        {feature.status === "coming_soon" && (
          <View style={styles.comingSoonOverlay}>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// MEMOIZED EXPORT
// ─────────────────────────────────────────────────────────────

const FeatureCard = memo(AnimatedFeatureCard, (prevProps, nextProps) => {
  return (
    prevProps.feature.id === nextProps.feature.id &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.size === nextProps.size
  );
});

FeatureCard.displayName = "FeatureCard";

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  pressable: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  favoriteIndicator: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteIcon: {
    fontSize: 12,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    ...(Platform.OS === "web"
      ? ({ textShadow: "0px 1px 4px rgba(0,0,0,0.2)" } as any)
      : {
          textShadowColor: "rgba(0,0,0,0.2)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }),
  },
  description: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  premiumOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(139, 92, 246, 0.8)",
    paddingVertical: 4,
    alignItems: "center",
  },
  premiumText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  comingSoonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

// ─────────────────────────────────────────────────────────────
// SKELETON COMPONENT
// ─────────────────────────────────────────────────────────────

export const FeatureCardSkeleton: React.FC<{
  size?: "small" | "medium" | "large";
}> = ({ size = "medium" }) => {
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = useMemo(() => {
    const padding = 32;
    const gap = 16;
    const columns = screenWidth >= 768 ? 3 : screenWidth >= 480 ? 2 : 2;
    return (screenWidth - padding * 2 - gap * (columns - 1)) / columns;
  }, [screenWidth]);

  const cardHeight = size === "large" ? 160 : size === "small" ? 100 : 130;

  return (
    <View
      style={[
        styles.cardContainer,
        { width: cardWidth, height: cardHeight },
        skeletonStyles.container,
      ]}
    >
      <View style={skeletonStyles.shimmer}>
        <View style={skeletonStyles.shimmerLine} />
      </View>
    </View>
  );
};

const skeletonStyles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  shimmerLine: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    transform: [{ skewX: "-20deg" }],
  },
});

export default FeatureCard;
