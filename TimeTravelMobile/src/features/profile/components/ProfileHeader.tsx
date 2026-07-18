/**
 * ProfileHeader Component
 * Displays user avatar, name, and level with glassmorphism styling
 */

import React, { memo } from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useUIStore } from "@/stores/uiStore";
import { useUserLevel } from "@/stores/userBehaviorStore";
import type { ProfileHeaderProps } from "../types";

const ProfileHeaderComponent: React.FC<ProfileHeaderProps> = ({
  user,
  level,
  summary,
  onEditProfile,
}) => {
  const { themeDark } = useUIStore();
  const userLevel = useUserLevel();

  const handleEditPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEditProfile?.();
  };

  const displayLevel = level || userLevel;

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(400)}
      style={styles.container}
    >
      <Pressable
        onPress={handleEditPress}
        style={({ pressed }) => [
          styles.avatarContainer,
          pressed && styles.pressed,
        ]}
      >
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              themeDark && styles.avatarPlaceholderDark,
            ]}
          >
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </Text>
          </View>
        )}
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{displayLevel.level}</Text>
        </View>
      </Pressable>

      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        style={styles.infoContainer}
      >
        <Text style={[styles.name, themeDark && styles.nameDark]}>
          {user?.name || "Traveler"}
        </Text>
        <Text style={[styles.title, themeDark && styles.titleDark]}>
          {displayLevel.title}
        </Text>
        {summary ? (
          <Text
            style={[styles.summary, themeDark && styles.summaryDark]}
            numberOfLines={3}
          >
            {summary}
          </Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 20,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#8B5CF6",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#8B5CF6",
  },
  avatarPlaceholderDark: {
    backgroundColor: "#374151",
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  levelBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#8B5CF6",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  levelText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  infoContainer: {
    alignItems: "center",
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  nameDark: {
    color: "#F9FAFB",
  },
  title: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  titleDark: {
    color: "#9CA3AF",
  },
  summary: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  summaryDark: {
    color: "#D1D5DB",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});

export const ProfileHeader = memo(ProfileHeaderComponent);
export default ProfileHeader;
