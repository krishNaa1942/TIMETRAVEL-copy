/**
 * ProfileScreen - Backend-backed profile dashboard
 */
import React, { useCallback, useMemo } from "react";
import { StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useUIStore } from "@/stores/uiStore";
import { useProfileData } from "../hooks/useProfileData";
import { useProfileActions } from "../hooks/useProfileActions";
import { ProfileHeader } from "../components/ProfileHeader";
import { XPProgressCard } from "../components/XPProgressCard";
import { TravelDNACard } from "../components/TravelDNACard";
import { InsightsCard } from "../components/InsightsCard";
import { SmartActions } from "../components/SmartActions";
import { QuickActionsGrid } from "../components/QuickActionsGrid";
import { SettingsSection } from "../components/SettingsSection";
import { SkeletonLoader } from "../components/SkeletonLoader";
import { ErrorState } from "../components/ErrorState";

const ProfileScreen: React.FC = () => {
  const { themeDark } = useUIStore();
  const {
    user,
    level,
    travelDNA,
    personality,
    summary,
    insights,
    smartActions,
    quickActions,
    isLoading,
    isError,
    error,
    refetch,
  } = useProfileData();
  const {
    handleLogout,
    handleInsightPress,
    handleSmartActionPress,
    handleQuickActionPress,
    handleSettingToggle,
  } = useProfileActions();

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
          refreshing={isLoading}
          onRefresh={onRefresh}
          tintColor={themeDark ? "#FFFFFF" : "#8B5CF6"}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeader user={user} level={level} summary={summary} />
      <XPProgressCard level={level} />
      <TravelDNACard dna={travelDNA} personality={personality} />
      {insights.length > 0 && (
        <InsightsCard insights={insights} onInsightPress={handleInsightPress} />
      )}
      <SmartActions
        actions={smartActions}
        onActionPress={handleSmartActionPress}
      />
      <QuickActionsGrid
        actions={quickActions}
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
