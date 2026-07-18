/**
 * DestinationCard – Premium AI Travel Card Redesign
 * Upgraded for Wanderlog/Airbnb aesthetics with overlays, heart toggles, 
 * micro-interactions, review counts, and descriptive tags.
 */
import React, { useRef, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Pressable,
} from "react-native";
import { Text } from "react-native-paper";
import { Destination } from "@/types";
import { colors, spacing } from "@/theme/colors";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";

const { width } = Dimensions.get("window");
const GRID_CARD_WIDTH = (width - spacing.md * 3) / 2;
const HORIZONTAL_CARD_WIDTH = 260; // Wider for better horizontal scroll view

interface Props {
  destination: Destination;
  imageUrl?: string;
  onPress: (dest: Destination) => void;
  horizontal?: boolean;
}

export default React.memo(function DestinationCard({
  destination,
  imageUrl,
  onPress,
  horizontal = false,
}: Props) {
  // ... rest of the component
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { savedDestinations, toggleFavorite: globalToggleFavorite } = useTravelIntelligence();
  const isFavorite = savedDestinations.some(d => d.id === destination.id);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const toggleFavorite = () => {
    handlePressIn();
    setTimeout(handlePressOut, 50);
    globalToggleFavorite(destination);
  };

  const cardWidth = horizontal ? HORIZONTAL_CARD_WIDTH : GRID_CARD_WIDTH;

  // Bug C1 fix: deterministic rating/reviewCount from destination ID hash
  // instead of Math.random() which flickers on every re-render
  const idHash = destination.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rating = (4.5 + (idHash % 5) * 0.1).toFixed(1);
  const reviewCount = 120 + (idHash * 37) % 3880;

  // Bug C2 fix: use category array from backend, not fragile label matching
  const categorySet = new Set((destination.category || []).map(c => c.toLowerCase()));
  let tag = "Popular";
  if (categorySet.has("beach") || categorySet.has("coastal")) tag = "Coastal";
  else if (categorySet.has("hill station") || categorySet.has("mountain")) tag = "Hill Station";
  else if (categorySet.has("spiritual") || categorySet.has("pilgrimage")) tag = "Spiritual";
  else if (categorySet.has("metro") || categorySet.has("city")) tag = "Metro City";
  else if (categorySet.has("adventure")) tag = "Adventure";
  else if (categorySet.has("heritage") || categorySet.has("culture")) tag = "Heritage";
  else if (categorySet.has("nature") || categorySet.has("wildlife")) tag = "Nature";

  return (
    <Pressable
      onPress={() => onPress(destination)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.card,
          { width: cardWidth, transform: [{ scale: scaleAnim }] },
          horizontal && styles.horizontalCardSpacing,
        ]}
      >
        <View style={styles.imageWrapper}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>🏔️</Text>
            </View>
          )}

          <View style={styles.gradientTop} />
          <View style={styles.gradientBottom} />

          <View style={styles.topOverlayRow}>
            <View style={styles.smartTag}>
              <Text style={styles.smartTagText}>{tag}</Text>
            </View>
            <Pressable
              onPress={toggleFavorite}
              hitSlop={15}
              style={[styles.heartBtn, isFavorite && styles.heartBtnActive]}
            >
              <Text style={styles.heartIcon}>{isFavorite ? "❤️" : "🤍"}</Text>
            </Pressable>
          </View>

          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {rating}</Text>
            <Text style={styles.reviewText}> ({reviewCount})</Text>
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {destination.label}
          </Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.region} numberOfLines={1}>
              {destination.region}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16, // premium radius
    overflow: "hidden",
    marginBottom: spacing.md,
    // Soft, premium shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  horizontalCardSpacing: {
    marginRight: spacing.md,
    marginBottom: 6, // Prevents shadow crop
  },
  imageWrapper: {
    width: "100%",
    height: 180, // Taller image for better storytelling
    position: "relative",
    backgroundColor: colors.darkSurface,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%", height: "100%",
    justifyContent: "center", alignItems: "center",
  },
  placeholderText: { fontSize: 48 },
  
  // Simulated Gradients
  gradientTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: 60,
    backgroundColor: "rgba(0,0,0,0.25)", // Dark top for heart/tag contrast
  },
  gradientBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: "rgba(0,0,0,0.4)", // Dark bottom for white rating text if placed over image
  },

  /* Overlays */
  topOverlayRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  smartTag: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  smartTagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  heartBtnActive: {
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  heartIcon: {
    fontSize: 16,
    lineHeight: 18,
  },

  ratingBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "baseline",
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  reviewText: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
  },

  info: {
    padding: spacing.md,
  },
  name: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A", // Deep slate
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  locationPin: {
    fontSize: 11,
  },
  region: {
    flex: 1,
    fontSize: 13,
    color: "#64748B", // Slate 500
    fontWeight: "500",
  },
});
