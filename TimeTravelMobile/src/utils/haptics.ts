/**
 * Haptics Utility — Shared helper for haptic feedback
 * =====================================================
 * Resolves expo-haptics at module load time (not per-call).
 * Silently no-ops on web or when the module is missing.
 */

let HapticsModule: any = null;
try {
  HapticsModule = require("expo-haptics");
} catch {
  // expo-haptics not available (web, or not installed)
}

export const haptics = {
  /**
   * Trigger impact haptic feedback.
   */
  impact: (style: "light" | "medium" | "heavy" = "light") => {
    if (!HapticsModule) return;
    const map = {
      light: HapticsModule.ImpactFeedbackStyle.Light,
      medium: HapticsModule.ImpactFeedbackStyle.Medium,
      heavy: HapticsModule.ImpactFeedbackStyle.Heavy,
    };
    HapticsModule.impactAsync(map[style]).catch(() => {});
  },

  /**
   * Trigger notification haptic feedback.
   */
  notification: (type: "success" | "error" | "warning" = "success") => {
    if (!HapticsModule) return;
    const map = {
      success: HapticsModule.NotificationFeedbackType.Success,
      error: HapticsModule.NotificationFeedbackType.Error,
      warning: HapticsModule.NotificationFeedbackType.Warning,
    };
    HapticsModule.notificationAsync(map[type]).catch(() => {});
  },

  /**
   * Trigger selection haptic feedback (lightest touch).
   */
  selection: () => {
    if (!HapticsModule) return;
    HapticsModule.selectionAsync().catch(() => {});
  },
};

export default haptics;
