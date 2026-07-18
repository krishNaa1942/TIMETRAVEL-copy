/**
 * React Query Configuration
 * Production-grade server state management
 */

import { QueryClient } from "@tanstack/react-query";

// Retry configuration with exponential backoff
const retryDelay = (attemptIndex: number) => 
  Math.min(1000 * 2 ** attemptIndex, 30000);

// Determine if error is retryable
const retryCondition = (failureCount: number, error: any) => {
  // Don't retry on 4xx errors (client errors)
  if (error?.status >= 400 && error?.status < 500) {
    return false;
  }
  // Retry up to 3 times for server errors or network issues
  return failureCount < 3;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache data for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry configuration
      retry: retryCondition,
      retryDelay,
      // Don't refetch on window focus (better UX)
      refetchOnWindowFocus: false,
      // Refetch on reconnect (important for mobile)
      refetchOnReconnect: true,
      // Network mode
      networkMode: "online",
    },
    mutations: {
      // Retry mutations once on network failure
      retry: 1,
      networkMode: "online",
    },
  },
});

// Query keys factory for consistent key management
export const queryKeys = {
  // Auth
  auth: {
    user: ["auth", "user"] as const,
    session: ["auth", "session"] as const,
  },
  
  // Destinations
  destinations: {
    all: ["destinations"] as const,
    list: (filters?: Record<string, any>) => 
      ["destinations", "list", filters] as const,
    detail: (id: string) => 
      ["destinations", "detail", id] as const,
    search: (query: string) => 
      ["destinations", "search", query] as const,
    recommendations: (userId: string) => 
      ["destinations", "recommendations", userId] as const,
  },
  
  // Trips
  trips: {
    all: ["trips"] as const,
    list: (userId: string) => 
      ["trips", "list", userId] as const,
    detail: (id: string) => 
      ["trips", "detail", id] as const,
    itinerary: (id: string) => 
      ["trips", "itinerary", id] as const,
  },
  
  // User data
  user: {
    profile: (id: string) => 
      ["user", "profile", id] as const,
    preferences: (id: string) => 
      ["user", "preferences", id] as const,
    favorites: (id: string) => 
      ["user", "favorites", id] as const,
    stats: (id: string) => 
      ["user", "stats", id] as const,
    activities: (id: string) => 
      ["user", "activities", id] as const,
    insights: (id: string) => 
      ["user", "insights", id] as const,
  },
  
  // Weather
  weather: {
    current: (location: string) => 
      ["weather", "current", location] as const,
    forecast: (location: string) => 
      ["weather", "forecast", location] as const,
  },
  
  // Currency
  currency: {
    rates: ["currency", "rates"] as const,
    convert: (from: string, to: string) => 
      ["currency", "convert", from, to] as const,
  },
  
  // AI
  ai: {
    recommendations: (context: any) => 
      ["ai", "recommendations", context] as const,
    itinerary: (params: any) => 
      ["ai", "itinerary", params] as const,
    insights: (userId: string) => 
      ["ai", "insights", userId] as const,
  },
} as const;

// Helper to invalidate all queries for a specific key prefix
export const invalidateQueries = async (keyPrefix: string[]) => {
  await queryClient.invalidateQueries({ 
    queryKey: keyPrefix,
    exact: false 
  });
};

// Helper to set query data with proper typing
export const setQueryData = <T>(key: readonly unknown[], data: T) => {
  queryClient.setQueryData(key, data);
};

// Helper to get query data
export const getQueryData = <T>(key: readonly unknown[]): T | undefined => {
  return queryClient.getQueryData<T>(key);
};

export default queryClient;