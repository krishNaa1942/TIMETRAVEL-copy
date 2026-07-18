/**
 * useProfileActions Hook
 * Handles profile-related actions (logout, edit, navigation, etc.)
 */

import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useUserBehaviorStore } from "@/stores/userBehaviorStore";
import type { AIInsight, SmartAction, QuickAction } from "../types";

interface UseProfileActionsReturn {
  handleLogout: () => Promise<void>;
  handleEditProfile: () => void;
  handleThemeToggle: () => void;
  handleInsightPress: (insight: AIInsight) => void;
  handleSmartActionPress: (action: SmartAction) => void;
  handleQuickActionPress: (action: QuickAction) => void;
  handleSettingToggle: (id: string, value: boolean) => void;
}

export const useProfileActions = (): UseProfileActionsReturn => {
  const navigation = useNavigation();
  const { logout: authLogout } = useAuthStore();
  const { toggleTheme, themeDark } = useUIStore();
  const { trackEvent } = useUserBehaviorStore();

  const handleLogout = useCallback(async () => {
    try {
      trackEvent({
        type: "click",
        category: "auth",
        metadata: { action: "logout" },
      });
      await authService.logout();
      authLogout();
    } catch (error) {
      console.error("Logout failed:", error);
      // Still logout locally even if API fails
      authLogout();
    }
  }, [authLogout, trackEvent]);

  const handleEditProfile = useCallback(() => {
    trackEvent({
      type: "click",
      category: "profile",
      metadata: { action: "edit" },
    });
    // Navigation to edit profile screen could be added here
  }, [trackEvent]);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    trackEvent({
      type: "click",
      category: "settings",
      metadata: { setting: "darkMode", value: !themeDark },
    });
  }, [toggleTheme, themeDark, trackEvent]);

  const handleInsightPress = useCallback(
    (insight: AIInsight) => {
      trackEvent({
        type: "click",
        category: "insight",
        metadata: { insightId: insight.id, insightType: insight.type },
      });
      if (insight.actionRoute) {
        navigation.navigate(insight.actionRoute as never);
      }
    },
    [navigation, trackEvent],
  );

  const handleSmartActionPress = useCallback(
    (action: SmartAction) => {
      trackEvent({
        type: "click",
        category: "smart_action",
        metadata: { actionId: action.id, actionTitle: action.title },
      });
      if (action.route) {
        navigation.navigate(action.route as never);
      } else if (action.onPress) {
        action.onPress();
      }
    },
    [navigation, trackEvent],
  );

  const handleQuickActionPress = useCallback(
    (action: QuickAction) => {
      trackEvent({
        type: "click",
        category: "quick_action",
        metadata: { actionId: action.id, actionLabel: action.label },
      });
      if (action.route) {
        navigation.navigate(action.route as never);
      } else if (action.onPress) {
        action.onPress();
      }
    },
    [navigation, trackEvent],
  );

  const handleSettingToggle = useCallback(
    (id: string, value: boolean) => {
      trackEvent({
        type: "click",
        category: "settings",
        metadata: { setting: id, value },
      });
      // Handle specific settings
      if (id === "darkMode") {
        toggleTheme();
      }
    },
    [toggleTheme, trackEvent],
  );

  return {
    handleLogout,
    handleEditProfile,
    handleThemeToggle,
    handleInsightPress,
    handleSmartActionPress,
    handleQuickActionPress,
    handleSettingToggle,
  };
};

export default useProfileActions;
