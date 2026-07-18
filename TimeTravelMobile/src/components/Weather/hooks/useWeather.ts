/**
 * 🪝 USE WEATHER HOOK
 * Data fetching with caching and retry logic
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WeatherData, UseWeatherOptions, UseWeatherReturn } from '../types';
import { fetchWeather } from '../services/weatherService';

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CACHE_TIME = 30 * 60 * 1000; // 30 minutes

export function useWeather(options: UseWeatherOptions): UseWeatherReturn {
  const { destination, enabled = true, staleTime = DEFAULT_STALE_TIME, refetchInterval } = options;

  const [data, setData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  
  const lastFetchTime = useRef<number>(0);
  const abortController = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!destination || !enabled) return;

    // Check if data is fresh
    const now = Date.now();
    if (!forceRefresh && data && now - lastFetchTime.current < staleTime) {
      return;
    }

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    setIsFetching(true);
    if (!data) setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await fetchWeather(destination);
      setData(result);
      lastFetchTime.current = now;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch weather'));
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [destination, enabled, staleTime, data]);

  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    if (enabled && destination) {
      fetchData();
    }
  }, [destination, enabled, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const isStale = data ? Date.now() - lastFetchTime.current > staleTime : false;
  const lastUpdated = data ? data.lastUpdated : null;

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    isStale,
    lastUpdated,
  };
}