/**
 * React Query Keys Factory
 * Centralized query key management for consistent cache handling
 *
 * Benefits:
 * - Type-safe query keys
 * - Consistent invalidation patterns
 * - Easy cache management
 * - Debuggable query structure
 */

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface DestinationFilters {
  query?: string;
  category?: string;
  region?: string;
  budget?: "budget" | "mid-range" | "luxury";
  season?: "summer" | "winter" | "monsoon" | "any";
  sortBy?: "rating" | "popularity" | "price";
}

export interface ItineraryFilters {
  status?: "planning" | "upcoming" | "ongoing" | "completed";
  destination?: string;
}

// ─────────────────────────────────────────────────────────────
// QUERY KEYS FACTORY
// ─────────────────────────────────────────────────────────────

export const queryKeys = {
  // ═══════════════════════════════════════════════════════════
  // USER & AUTH
  // ═══════════════════════════════════════════════════════════

  user: {
    all: ["user"] as const,
    profile: () => [...queryKeys.user.all, "profile"] as const,
    preferences: () => [...queryKeys.user.all, "preferences"] as const,
    stats: () => [...queryKeys.user.all, "stats"] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════════════════════════════

  profile: {
    all: ["profile"] as const,
    data: () => [...queryKeys.profile.all, "data"] as const,
    stats: () => [...queryKeys.profile.all, "stats"] as const,
    summary: () => [...queryKeys.profile.all, "summary"] as const,
    achievements: () => [...queryKeys.profile.all, "achievements"] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // DESTINATIONS
  // ═══════════════════════════════════════════════════════════

  destinations: {
    all: ["destinations"] as const,
    lists: () => [...queryKeys.destinations.all, "list"] as const,
    list: (filters: DestinationFilters) =>
      [...queryKeys.destinations.all, "list", filters] as const,
    details: () => [...queryKeys.destinations.all, "detail"] as const,
    detail: (id: string) =>
      [...queryKeys.destinations.all, "detail", id] as const,
    featured: () => [...queryKeys.destinations.all, "featured"] as const,
    trending: () => [...queryKeys.destinations.all, "trending"] as const,
    search: (query: string) =>
      [...queryKeys.destinations.all, "search", query] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // ITINERARIES
  // ═══════════════════════════════════════════════════════════

  itineraries: {
    all: ["itineraries"] as const,
    lists: () => [...queryKeys.itineraries.all, "list"] as const,
    list: (filters?: ItineraryFilters) =>
      [...queryKeys.itineraries.all, "list", filters] as const,
    details: () => [...queryKeys.itineraries.all, "detail"] as const,
    detail: (id: string) =>
      [...queryKeys.itineraries.all, "detail", id] as const,
    active: () => [...queryKeys.itineraries.all, "active"] as const,
    day: (itineraryId: string, dayNumber: number) =>
      [...queryKeys.itineraries.all, "day", itineraryId, dayNumber] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // FAVORITES
  // ═══════════════════════════════════════════════════════════

  favorites: {
    all: ["favorites"] as const,
    list: () => [...queryKeys.favorites.all, "list"] as const,
    check: (destinationId: string) =>
      [...queryKeys.favorites.all, "check", destinationId] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // TRIPS
  // ═══════════════════════════════════════════════════════════

  trips: {
    all: ["trips"] as const,
    lists: () => [...queryKeys.trips.all, "list"] as const,
    list: (status?: string) =>
      [...queryKeys.trips.all, "list", status] as const,
    details: () => [...queryKeys.trips.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.trips.all, "detail", id] as const,
    active: () => [...queryKeys.trips.all, "active"] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // AI & RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════

  ai: {
    all: ["ai"] as const,
    recommendations: (query: string, context?: Record<string, unknown>) =>
      [...queryKeys.ai.all, "recommendations", query, context] as const,
    itinerary: (
      destination: string,
      days: number,
      preferences?: Record<string, unknown>,
    ) =>
      [
        ...queryKeys.ai.all,
        "itinerary",
        destination,
        days,
        preferences,
      ] as const,
    chat: (sessionId: string) =>
      [...queryKeys.ai.all, "chat", sessionId] as const,
    insights: (destinationId: string) =>
      [...queryKeys.ai.all, "insights", destinationId] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // WEATHER
  // ═══════════════════════════════════════════════════════════

  weather: {
    all: ["weather"] as const,
    current: (latitude: number, longitude: number) =>
      [...queryKeys.weather.all, "current", latitude, longitude] as const,
    forecast: (latitude: number, longitude: number, days: number) =>
      [
        ...queryKeys.weather.all,
        "forecast",
        latitude,
        longitude,
        days,
      ] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // SAFETY
  // ═══════════════════════════════════════════════════════════

  safety: {
    all: ["safety"] as const,
    destination: (destinationId: string) =>
      [...queryKeys.safety.all, "destination", destinationId] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // CURRENCY
  // ═══════════════════════════════════════════════════════════

  currency: {
    all: ["currency"] as const,
    rates: (base: string, target: string) =>
      [...queryKeys.currency.all, "rates", base, target] as const,
    convert: (amount: number, from: string, to: string) =>
      [...queryKeys.currency.all, "convert", amount, from, to] as const,
  },

  // ═══════════════════════════════════════════════════════════
  // PACKING
  // ═══════════════════════════════════════════════════════════

  packing: {
    all: ["packing"] as const,
    list: (tripId: string) =>
      [...queryKeys.packing.all, "list", tripId] as const,
    suggestions: (destination: string, duration: number, season: string) =>
      [
        ...queryKeys.packing.all,
        "suggestions",
        destination,
        duration,
        season,
      ] as const,
  },
} as const;

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Invalidate all queries matching a prefix
 */
export const getInvalidateFilter = (keys: readonly unknown[]) => {
  return { queryKey: keys, exact: false };
};

/**
 * Get exact query filter for a specific query
 */
export const getExactFilter = (keys: readonly unknown[]) => {
  return { queryKey: keys, exact: true };
};

export default queryKeys;
