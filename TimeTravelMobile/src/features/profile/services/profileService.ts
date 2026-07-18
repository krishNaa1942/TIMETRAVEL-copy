/**
 * Profile Feature Service
 * API service for profile-related operations
 */

import apiService from "@/services/api";
import { authServiceV2 } from "@/services/authV2";
import type {
  UserProfile,
  ProfileUpdatePayload,
  TravelStats,
  ProfileAPIResponse,
  StatsAPIResponse,
  ProfileSummary,
  ProfileSummaryAPIResponse,
  AIInsight,
  SmartAction,
  QuickAction,
  TravelDNA,
  PersonalityConfig,
  UserLevel,
} from "../types";

interface ProfileSummaryResponsePayload {
  profile: UserProfile;
  stats: TravelStats;
  preferences?: Record<string, unknown>;
  summary?: string | null;
  summary_meta?: Record<string, unknown>;
  level: UserLevel;
  travel_dna: TravelDNA;
  personality: PersonalityConfig;
  insights: AIInsight[];
  smart_actions: SmartAction[];
  quick_actions: QuickAction[];
  generated_at?: string | null;
}

interface BackendProfileSummaryResponse {
  success: boolean;
  data?: ProfileSummaryResponsePayload;
  error?: string;
}

const normalizeProfileSummary = (
  data: ProfileSummaryResponsePayload,
): ProfileSummary => ({
  profile: data.profile,
  stats: data.stats,
  preferences: data.preferences ?? {},
  summary: data.summary ?? null,
  summaryMeta: data.summary_meta ?? {},
  level: data.level,
  travelDNA: data.travel_dna,
  personality: data.personality,
  insights: data.insights ?? [],
  smartActions: data.smart_actions ?? [],
  quickActions: data.quick_actions ?? [],
  generatedAt: data.generated_at ?? null,
});

// ─────────────────────────────────────────────────────────────
// PROFILE SERVICE
// ─────────────────────────────────────────────────────────────

export const profileService = {
  /**
   * Get user profile data
   */
  async getProfile(): Promise<ProfileAPIResponse<UserProfile>> {
    const user = await authServiceV2.checkAuth();

    if (!user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    return {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  },

  /**
   * Update user profile
   */
  async updateProfile(
    payload: ProfileUpdatePayload,
  ): Promise<ProfileAPIResponse<UserProfile>> {
    const updatedUser = await authServiceV2.updateProfile({
      name: payload.name,
      email: payload.email,
    });

    return {
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
      },
    };
  },

  /**
   * Get backend-backed profile summary
   */
  async getSummary(): Promise<ProfileSummaryAPIResponse> {
    const response =
      await apiService.get<BackendProfileSummaryResponse>("/profile/summary");

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || "Unable to load profile summary",
      };
    }

    return {
      success: true,
      data: normalizeProfileSummary(response.data),
    };
  },

  /**
   * Get user avatar upload URL
   */
  async getAvatarUploadUrl(): Promise<{ uploadUrl: string; key: string }> {
    return apiService.get("/user/avatar/upload-url");
  },

  /**
   * Upload avatar image
   */
  async uploadAvatar(uri: string): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    const filename = uri.split("/").pop() || "avatar.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    formData.append("avatar", {
      uri,
      name: filename,
      type,
    } as any);

    return apiService.post("/user/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  /**
   * Get travel stats
   */
  async getStats(): Promise<StatsAPIResponse> {
    return apiService.get("/stats");
  },

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<{ success: boolean }> {
    return apiService.delete("/user/account");
  },

  /**
   * Export user data (GDPR)
   */
  async exportData(): Promise<{ downloadUrl: string }> {
    return apiService.get("/user/export");
  },

  /**
   * Update preferences
   */
  async updatePreferences(
    preferences: Record<string, boolean>,
  ): Promise<{ success: boolean }> {
    return apiService.put("/user/preferences", preferences);
  },

  /**
   * Get user achievements/badges
   */
  async getAchievements(): Promise<{
    badges: Array<{ id: string; earnedAt: string }>;
  }> {
    return apiService.get("/user/achievements");
  },

  /**
   * Sync offline data
   */
  async syncOfflineData(
    events: Array<{ type: string; data: any; timestamp: number }>,
  ): Promise<{ synced: number }> {
    return apiService.post("/user/sync", { events });
  },
};

export default profileService;
