/**
 * useDestinations Query Hook
 * ==========================
 * 
 * SERVER STATE: Destinations data
 * 
 * Features:
 * - Automatic caching with React Query v5
 * - Background refetching
 * - Stale-while-revalidate
 * - Optimistic updates for favorites
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { queryKeys, DestinationFilters } from '../queryKeys';
import { apiService } from '@/services/api';
import { Destination } from '@/types';
import { usePreferenceStore, SortBy } from '@/stores/preferenceStore';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

// Simple response - matches backend app/api/routes/destinations.py
interface DestinationsResponse {
  destinations: Destination[];
}

interface DestinationDetailResponse {
  destination: Destination;
  related?: Destination[];
}

// Featured/Trending response wrapper
interface FeaturedResponse {
  destinations: Destination[];
}

// ─────────────────────────────────────────────────────────────
// CACHE CONFIG
// ─────────────────────────────────────────────────────────────

const CACHE_CONFIG = {
  staleTime: 10 * 60 * 1000,      // 10 minutes
  gcTime: 60 * 60 * 1000,         // 1 hour (React Query v5 uses gcTime)
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
};

// ─────────────────────────────────────────────────────────────
// HELPER: Convert SortBy to API format
// ─────────────────────────────────────────────────────────────

const convertSortBy = (sortBy: SortBy): 'rating' | 'popularity' | 'price' => {
  const map: Record<SortBy, 'rating' | 'popularity' | 'price'> = {
    rating: 'rating',
    popularity: 'popularity',
    price: 'price',
    distance: 'popularity', // fallback
  };
  return map[sortBy] || 'popularity';
};

// ─────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────

/**
 * useDestinations
 * Fetch list of destinations with filters
 */
export const useDestinations = (filters?: Partial<DestinationFilters>) => {
  // Get client-side filters from preference store
  const clientFilters = usePreferenceStore(
    useCallback((state) => state.filters.destination, [])
  );
  
  // Merge server and client filters (with proper type conversion)
  const mergedFilters = useMemo((): DestinationFilters => ({
    query: clientFilters.query || filters?.query,
    category: clientFilters.category || filters?.category,
    region: clientFilters.region || filters?.region,
    budget: clientFilters.budget || filters?.budget,
    sortBy: convertSortBy(clientFilters.sortBy) || filters?.sortBy || 'popularity',
  }), [clientFilters, filters]);
  
  return useQuery({
    queryKey: queryKeys.destinations.list(mergedFilters),
    queryFn: async (): Promise<DestinationsResponse> => {
      const response = await apiService.get<DestinationsResponse>('/destinations', {
        params: mergedFilters,
      });
      return response;
    },
    ...CACHE_CONFIG,
    // Only fetch when there's a query or category filter
    enabled: !!mergedFilters.query || !!mergedFilters.category || !filters,
  });
};

/**
 * useDestinationDetail
 * Fetch single destination by ID
 */
export const useDestinationDetail = (id: string) => {
  return useQuery({
    queryKey: queryKeys.destinations.detail(id),
    queryFn: async (): Promise<DestinationDetailResponse> => {
      const response = await apiService.get<DestinationDetailResponse>(`/destinations/${id}`);
      return response;
    },
    ...CACHE_CONFIG,
    enabled: !!id,
  });
};

/**
 * useFeaturedDestinations
 * Fetch featured/trending destinations
 */
export const useFeaturedDestinations = () => {
  return useQuery({
    queryKey: queryKeys.destinations.featured(),
    queryFn: async (): Promise<Destination[]> => {
      const response = await apiService.get<{ destinations: Destination[] }>('/destinations/featured');
      return response.destinations;
    },
    ...CACHE_CONFIG,
  });
};

/**
 * useTrendingDestinations
 * Fetch trending destinations
 */
export const useTrendingDestinations = () => {
  return useQuery({
    queryKey: queryKeys.destinations.trending(),
    queryFn: async (): Promise<Destination[]> => {
      const response = await apiService.get<{ destinations: Destination[] }>('/destinations/trending');
      return response.destinations;
    },
    ...CACHE_CONFIG,
  });
};

/**
 * useSearchDestinations
 * Search destinations with debounced query
 */
export const useSearchDestinations = (query: string) => {
  return useQuery({
    queryKey: queryKeys.destinations.search(query),
    queryFn: async (): Promise<Destination[]> => {
      const response = await apiService.get<{ destinations: Destination[] }>('/destinations/search', {
        params: { q: query },
      });
      return response.destinations;
    },
    ...CACHE_CONFIG,
    enabled: query.length >= 2,
  });
};

// ─────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────

/**
 * useToggleFavorite
 * Toggle favorite with optimistic update
 */
export const useToggleFavorite = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (destinationId: string): Promise<{ isFavorite: boolean }> => {
      const response = await apiService.post<{ isFavorite: boolean }>('/favorites/toggle', {
        destinationId,
      });
      return response;
    },
    
    // Optimistic update
    onMutate: async (destinationId) => {
      // Cancel ongoing refetches
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.favorites.all 
      });
      
      // Snapshot previous value
      const previousFavorites = queryClient.getQueryData<Destination[]>(
        queryKeys.favorites.list()
      );
      
      // Optimistically update favorites list
      queryClient.setQueryData<Destination[]>(
        queryKeys.favorites.list(),
        (old = []) => {
          const exists = old.some(d => d.id === destinationId);
          if (exists) {
            return old.filter(d => d.id !== destinationId);
          }
          // Add placeholder (will be replaced by server response)
          return [...old, { id: destinationId } as Destination];
        }
      );
      
      // Update destination detail if cached
      queryClient.setQueryData<DestinationDetailResponse>(
        queryKeys.destinations.detail(destinationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            destination: {
              ...old.destination,
              isFavorite: !old.destination.isFavorite,
            },
          };
        }
      );
      
      return { previousFavorites };
    },
    
    // Rollback on error
    onError: (err, destinationId, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(
          queryKeys.favorites.list(),
          context.previousFavorites
        );
      }
    },
    
    // Always refetch after success/error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all });
    },
  });
};

/**
 * useFavorites
 * Fetch user's favorite destinations
 */
export const useFavorites = () => {
  return useQuery({
    queryKey: queryKeys.favorites.list(),
    queryFn: async (): Promise<Destination[]> => {
      const response = await apiService.get<{ favorites: Destination[] }>('/favorites');
      return response.favorites;
    },
    staleTime: 2 * 60 * 1000,   // 2 minutes
    gcTime: 15 * 60 * 1000,     // 15 minutes (React Query v5)
  });
};

/**
 * useIsFavorite
 * Check if a destination is favorited
 */
export const useIsFavorite = (destinationId: string) => {
  const { data: favorites = [] } = useFavorites();
  return useMemo(
    () => favorites.some((f: Destination) => f.id === destinationId),
    [favorites, destinationId]
  );
};

// ─────────────────────────────────────────────────────────────
// DERIVED DATA HOOKS
// ─────────────────────────────────────────────────────────────

/**
 * useFilteredDestinations
 * Filter destinations based on user preferences
 */
export const useFilteredDestinations = (
  destinations: Destination[]
) => {
  const preferences = usePreferenceStore(
    useCallback((state) => state.preferences, [])
  );
  
  return useMemo(() => {
    if (!destinations.length) return [];
    
    let filtered = [...destinations];
    
    // Filter by budget
    if (preferences.budgetLevel) {
      filtered = filtered.filter(d => 
        d.budgetLevel === preferences.budgetLevel || !d.budgetLevel
      );
    }
    
    // Filter by travel style (using category field)
    if (preferences.travelStyles.length > 0) {
      filtered = filtered.filter(d =>
        d.category?.some((c: string) => 
          preferences.travelStyles.includes(c as any)
        )
      );
    }
    
    // Sort by preference
    filtered.sort((a, b) => {
      const scoreA = (a.rating || 0) + (a.popularity || 0) * 0.1;
      const scoreB = (b.rating || 0) + (b.popularity || 0) * 0.1;
      return scoreB - scoreA;
    });
    
    return filtered;
  }, [destinations, preferences]);
};

export default useDestinations;