/**
 * useInsights Hook
 * Generates and manages AI-powered insights for the user
 */

import { useMemo } from 'react';
import { useUserBehaviorStore, useUserStreak } from '@/stores/userBehaviorStore';
import { generateAIInsights } from '../utils/profileHelpers';
import type { AIInsight } from '../types';

interface UseInsightsParams {
  tripCount: number;
  completedTrips: number;
  favoritesCount: number;
  level: number;
  levelTitle: string;
}

interface UseInsightsReturn {
  insights: AIInsight[];
  isLoading: boolean;
}

export const useInsights = (params: UseInsightsParams): UseInsightsReturn => {
  const { viewedDestinations } = useUserBehaviorStore();
  const { current: streakCurrent } = useUserStreak();

  const insights = useMemo((): AIInsight[] => {
    return generateAIInsights(
      params.tripCount,
      params.completedTrips,
      streakCurrent,
      params.favoritesCount,
      params.level,
      params.levelTitle,
      viewedDestinations?.length || 0
    );
  }, [
    params.tripCount,
    params.completedTrips,
    streakCurrent,
    params.favoritesCount,
    params.level,
    params.levelTitle,
    viewedDestinations,
  ]);

  return {
    insights,
    isLoading: false,
  };
};

export default useInsights;