/**
 * useProfileData Hook
 * Centralized hook for fetching and managing profile data
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuthStore } from "@/stores/authStore";
import { profileService } from "../services/profileService";
import { queryKeys } from "@/api/queryKeys";
import {
  DEFAULT_USER_LEVEL,
  createDefaultTravelDNA,
  PERSONALITY_CONFIG,
} from "../utils/profileHelpers";
import type {
  AchievementBadge,
  AIInsight,
  PersonalityConfig,
  ProfileSummary,
  ProfileUpdatePayload,
  QuickAction,
  SmartAction,
  TravelDNA,
  TravelStats,
  UserLevel,
  UserProfile,
} from "../types";

interface UseProfileDataReturn {
  profile: ProfileSummary | null;
  user: UserProfile | null;
  stats: TravelStats | null;
  level: UserLevel;
  travelDNA: TravelDNA;
  personality: PersonalityConfig;
  summary: string | null;
  insights: AIInsight[];
  smartActions: SmartAction[];
  quickActions: QuickAction[];
  achievements: AchievementBadge[];
  preferences: Record<string, unknown>;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<void>;
  isUpdating: boolean;
}

export const useProfileData = (): UseProfileDataReturn => {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuthStore();

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: queryKeys.profile.summary(),
    queryFn: () => profileService.getSummary(),
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000,
  });

  // Achievements / badges query
  const { data: achievementsData } = useQuery({
    queryKey: queryKeys.profile.achievements(),
    queryFn: () => profileService.getAchievements(),
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000,
  });

  // Profile update mutation
  const { mutateAsync: updateProfileMutation, isPending: isUpdating } =
    useMutation({
      mutationFn: (payload: ProfileUpdatePayload) =>
        profileService.updateProfile(payload),
      onMutate: async (payload) => {
        await queryClient.cancelQueries({
          queryKey: queryKeys.profile.summary(),
        });
        await queryClient.cancelQueries({
          queryKey: queryKeys.profile.data(),
        });
        const previousSummary = queryClient.getQueryData(queryKeys.profile.summary());
        queryClient.setQueryData(queryKeys.profile.summary(), (old: any) => {
          if (!old?.data?.profile) return old;
          return {
            ...old,
            data: {
              ...old.data,
              profile: { ...old.data.profile, ...payload },
            },
          };
        });
        return { previousSummary };
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.profile.summary(),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.profile.data(),
        });
      },
      onError: (error, _payload, context: any) => {
        if (context?.previousSummary) {
          queryClient.setQueryData(queryKeys.profile.summary(), context.previousSummary);
        }
        console.error("Profile update failed:", error);
      },
    });

  const updateProfile = useCallback(
    async (payload: ProfileUpdatePayload) => {
      await updateProfileMutation(payload);
    },
    [updateProfileMutation],
  );

  const profile = useMemo(
    (): ProfileSummary | null => summaryData?.data ?? null,
    [summaryData],
  );

  const user = useMemo((): UserProfile | null => {
    if (profile?.profile) return profile.profile;
    if (authUser) {
      return {
        id: authUser.id,
        name: authUser.name || "",
        email: authUser.email || "",
        avatar_url: authUser.avatar_url || null,
        created_at: new Date().toISOString(),
      };
    }
    return null;
  }, [profile, authUser]);

  const stats = useMemo(
    (): TravelStats | null => profile?.stats ?? null,
    [profile],
  );
  const level = useMemo(() => profile?.level ?? DEFAULT_USER_LEVEL, [profile]);
  const travelDNA = useMemo(
    () => profile?.travelDNA ?? createDefaultTravelDNA(),
    [profile],
  );
  const personality = useMemo(
    () => profile?.personality ?? PERSONALITY_CONFIG.explorer,
    [profile],
  );
  const summary = useMemo(() => profile?.summary ?? null, [profile]);
  const insights = useMemo(() => profile?.insights ?? [], [profile]);
  const smartActions = useMemo(() => profile?.smartActions ?? [], [profile]);
  const quickActions = useMemo(() => profile?.quickActions ?? [], [profile]);
  const achievements = useMemo(
    () => achievementsData?.badges ?? [],
    [achievementsData],
  );
  const preferences = useMemo(
    () => profile?.preferences ?? {},
    [profile],
  );

  const refetch = useCallback(() => {
    refetchSummary();
  }, [refetchSummary]);

  return {
    profile,
    user,
    stats,
    level,
    travelDNA,
    personality,
    summary,
    insights,
    smartActions,
    quickActions,
    achievements,
    preferences,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
    isError: isSummaryError,
    error: summaryError as Error | null,
    refetch,
    updateProfile,
    isUpdating,
  };
};

export default useProfileData;
