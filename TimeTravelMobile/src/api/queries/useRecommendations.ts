/**
 * Recommendation Query Hooks
 * ==========================
 * React Query hooks for the recommendation system.
 */

import { useQuery, useInfiniteQuery, UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '../client';
import {
  Recommendation,
  RecommendationsResponse,
  RecommendationsParams,
} from '../../types/recommendations';

/**
 * Query keys for recommendations
 */
export const recommendationKeys = {
  all: ['recommendations'] as const,
  lists: () => [...recommendationKeys.all, 'list'] as const,
  list: (params: RecommendationsParams) => [...recommendationKeys.lists(), params] as const,
  details: () => [...recommendationKeys.all, 'detail'] as const,
  detail: (id: string) => [...recommendationKeys.details(), id] as const,
};

/**
 * Fetch recommendations
 */
async function fetchRecommendations(
  params: RecommendationsParams
): Promise<RecommendationsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params.season) queryParams.append('season', params.season);
  if (params.trip_duration) queryParams.append('trip_duration', String(params.trip_duration));
  if (params.group_size) queryParams.append('group_size', String(params.group_size));
  if (params.budget_max) queryParams.append('budget_max', String(params.budget_max));
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.offset) queryParams.append('offset', String(params.offset));
  
  const { data } = await apiClient.get<RecommendationsResponse>(
    `/recommendations?${queryParams.toString()}`
  );
  
  return data ?? { recommendations: [], total: 0, context: { season: 'any', trip_duration: 7, group_size: 2 }, generated_at: new Date().toISOString() };
}

/**
 * Hook for fetching recommendations
 */
export function useRecommendations(
  params: RecommendationsParams = {},
  options?: Omit<UseQueryOptions<RecommendationsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: recommendationKeys.list(params),
    queryFn: () => fetchRecommendations(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

/**
 * Hook for infinite scroll recommendations
 */
export function useInfiniteRecommendations(params: Omit<RecommendationsParams, 'offset'> = {}) {
  return useInfiniteQuery({
    queryKey: recommendationKeys.list(params),
    queryFn: ({ pageParam = 0 }) =>
      fetchRecommendations({ ...params, offset: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.recommendations.length < (params.limit || 10)) {
        return undefined;
      }
      return allPages.length * (params.limit || 10);
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get flat recommendations from infinite query
 */
export function flattenInfiniteRecommendations(
  pages: RecommendationsResponse[] | undefined
): Recommendation[] {
  if (!pages) return [];
  return pages.flatMap((page) => page.recommendations);
}

/**
 * Hook for recommendation by ID
 */
export function useRecommendationDetail(
  id: string,
  options?: Omit<UseQueryOptions<Recommendation | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: recommendationKeys.detail(id),
    queryFn: async (): Promise<Recommendation | null> => {
      const { data } = await apiClient.get<Recommendation>(`/recommendations/${id}`);
      return data;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    ...options,
  });
}
