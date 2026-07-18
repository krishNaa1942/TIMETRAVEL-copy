/**
 * useDestinationDetail Hook
 * Custom hook for fetching and managing destination detail data
 * Implements proper loading, error, and retry states
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Destination, WeatherData, SafetyData, UnsplashImage } from "@/types";
import { destinationsService } from "@/services/destinations";
import { weatherService } from "@/services/weather";
import { safetyService } from "@/services/safety";
import { favoritesService } from "@/services/favorites";

interface DestinationDetailState {
  heroImage: string | null;
  weather: WeatherData | null;
  safety: SafetyData | null;
  photos: UnsplashImage[];
  isFavorite: boolean;
  favoriteId: number | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasPartialError: boolean;
}

interface UseDestinationDetailReturn extends DestinationDetailState {
  refresh: () => Promise<void>;
  toggleFavorite: () => Promise<void>;
  retry: () => Promise<void>;
}

const initialState: DestinationDetailState = {
  heroImage: null,
  weather: null,
  safety: null,
  photos: [],
  isFavorite: false,
  favoriteId: null,
  isLoading: true,
  isRefreshing: false,
  error: null,
  hasPartialError: false,
};

export function useDestinationDetail(destination: Destination): UseDestinationDetailReturn {
  const [state, setState] = useState<DestinationDetailState>(initialState);
  const isMounted = useRef(true);
  const abortController = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!destination?.label) return;

    // Cancel any in-flight requests
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    setState(prev => ({
      ...prev,
      [isRefresh ? 'isRefreshing' : 'isLoading']: true,
      error: null,
      hasPartialError: false,
    }));

    try {
      // Fetch all data in parallel with proper error handling per request
      const results = await Promise.allSettled([
        destinationsService.getHeroImage(destination.label),
        weatherService.getWeather(destination.label),
        safetyService.getSafety(destination.label),
        destinationsService.getDestinationImages(destination.label),
        favoritesService.check(destination.label),
      ]);

      const [heroResult, weatherResult, safetyResult, photosResult, favoriteResult] = results;

      if (!isMounted.current) return;

      // Process each result individually for graceful degradation
      const heroImage = heroResult.status === 'fulfilled' && heroResult.value
        ? heroResult.value.url_regular || heroResult.value.url_small || null
        : null;

      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
      const safety = safetyResult.status === 'fulfilled' ? safetyResult.value : null;
      const photos = photosResult.status === 'fulfilled' ? photosResult.value : [];

      const isFavorite = favoriteResult.status === 'fulfilled' && favoriteResult.value?.is_favorite;
      const favoriteId = favoriteResult.status === 'fulfilled' ? favoriteResult.value?.favorite?.id : null;

      // Check if we have any partial failures
      const hasPartialError = results.some(r => r.status === 'rejected');

      setState({
        heroImage,
        weather,
        safety,
        photos,
        isFavorite: isFavorite ?? false,
        favoriteId: favoriteId ?? null,
        isLoading: false,
        isRefreshing: false,
        error: null,
        hasPartialError,
      });
    } catch (err) {
      if (!isMounted.current) return;
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: err instanceof Error ? err.message : 'Failed to load destination details',
      }));
    }
  }, [destination?.label]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const retry = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  const toggleFavorite = useCallback(async () => {
    try {
      if (state.isFavorite && state.favoriteId) {
        await favoritesService.remove(state.favoriteId);
        setState(prev => ({
          ...prev,
          isFavorite: false,
          favoriteId: null,
        }));
      } else {
        const result = await favoritesService.add(destination.label);
        setState(prev => ({
          ...prev,
          isFavorite: true,
          favoriteId: result?.id ?? null,
        }));
      }
    } catch (err) {
      // Re-throw to let the component handle the error display
      throw err instanceof Error ? err : new Error('Failed to update favorite');
    }
  }, [state.isFavorite, state.favoriteId, destination.label]);

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchData();

    return () => {
      isMounted.current = false;
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [fetchData]);

  return {
    ...state,
    refresh,
    toggleFavorite,
    retry,
  };
}

export default useDestinationDetail;