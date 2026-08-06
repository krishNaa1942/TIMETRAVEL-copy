/**
 * ProfileScreen - Backend-backed profile dashboard
 */
import React, { useCallback, useMemo } from "react";
import { StyleSheet, RefreshControl, ScrollView, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { queryKeys } from "@/api/queryKeys";
import { useProfileData } from "../hooks/useProfileData";
import { useProfileActions } from "../hooks/useProfileActions";
import { profileService } from "../services/profileService";
import { ProfileHeader } from "../components/ProfileHeader";
import { XPProgressCard } from "../components/XPProgressCard";
import { TravelDNACard } from "../components/TravelDNACard";
import { InsightsCard } from "../components/InsightsCard";
import { SmartActions } from "../components/SmartActions";
import { QuickActionsGrid } from "../components/QuickActionsGrid";
import { SettingsSection } from "../components/SettingsSection";
import { AchievementsCard } from "../components/AchievementsCard";
import { PreferencesCard } from "../components/PreferencesCard";
import { SkeletonLoader } from "../components/SkeletonLoader";
import { ErrorState } from "../components/ErrorState";
import type { QuickAction } from "../types";

const TOOL_SHORTCUTS: QuickAction[] = [
  { id: "currency", icon: "💱", label: "Currency", count: null, route: "Currency" },
  { id: "route", icon: "🧭", label: "Routes", count: null, route: "RoutePlanner" },
  { id: "phrasebook", icon: "🗣️", label: "Phrases", count: null, route: "Phrasebook" },
  { id: "news", icon: "📰", label: "News", count: null, route: "NewsFeed" },
];

const ProfileScreen: React.FC = () => {
  const { themeDark } = useUIStore();
  const queryClient = useQueryClient();
  const { updateUser } = useAuthStore();
  const {
    user,
    level,
    travelDNA,
    personality,
    summary,
    insights,
    smartActions,
    quickActions,
    achievements,
    preferences,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useProfileData();
  const {
    handleLogout,
    handleInsightPress,
    handleSmartActionPress,
    handleQuickActionPress,
    handleSettingToggle,
  } = useProfileActions();

  const allQuickActions = useMemo(() => {
    const existingRoutes = new Set(
      quickActions.map((action) => action.route).filter(Boolean),
    );
    const extra = TOOL_SHORTCUTS.filter(
      (action) => !existingRoutes.has(action.route),
    );
    return [...quickActions, ...extra];
  }, [quickActions]);

  const settings = useMemo(
    () => [
      {
        id: "darkMode",
        icon: "🌙",
        label: "Dark Mode",
        type: "toggle" as const,
        value: themeDark,
      },
      {
        id: "logout",
        icon: "🚪",
        label: "Sign Out",
        type: "button" as const,
        onPress: handleLogout,
        danger: true,
      },
    ],
    [themeDark, handleLogout],
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleAvatarPress = useCallback(async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo access to change avatar.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      const uri = result.assets[0].uri;
      const { avatar_url } = await profileService.uploadAvatar(uri);
      if (avatar_url) {
        updateUser({ avatar_url });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.profile.summary(),
        });
      }
    } catch (uploadError) {
      Alert.alert("Upload failed", "Could not upload avatar. Try again later.");
    }
  }, [queryClient, updateUser]);

  const handlePreferencesSave = useCallback(
    async (prefs: Record<string, unknown>) => {
      try {
        await profileService.updatePreferences(prefs);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.profile.summary(),
        });
      } catch (saveError) {
        Alert.alert(
          "Couldn't save preferences",
          "Your preferences were not updated. Try again.",
        );
      }
    },
    [queryClient],
  );

  if (isLoading) {
    return <SkeletonLoader visible={isLoading} />;
  }

  if (isError && error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <ScrollView
      style={[styles.container, themeDark && styles.containerDark]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={onRefresh}
          tintColor={themeDark ? "#FFFFFF" : "#8B5CF6"}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeader
        user={user}
        level={level}
        summary={summary}
        onEditProfile={handleAvatarPress}
      />
      <XPProgressCard level={level} />
      <TravelDNACard dna={travelDNA} personality={personality} />
      <PreferencesCard
        preferences={preferences}
        onSave={handlePreferencesSave}
      />
      <AchievementsCard achievements={achievements} />
      {insights.length > 0 && (
        <InsightsCard insights={insights} onInsightPress={handleInsightPress} />
      )}
      <SmartActions
        actions={smartActions}
        onActionPress={handleSmartActionPress}
      />
      <QuickActionsGrid
        actions={allQuickActions}
        onActionPress={handleQuickActionPress}
      />
      <SettingsSection settings={settings} onToggle={handleSettingToggle} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  containerDark: { backgroundColor: "#111827" },
  content: { paddingVertical: 16, paddingBottom: 32 },
});

export default ProfileScreen;
