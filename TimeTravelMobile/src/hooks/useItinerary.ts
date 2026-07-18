/**
 * useItinerary Hook
 * Premium AI-powered itinerary generation with caching, retry logic, and parallel fetching
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  itineraryService,
  ItineraryResponse,
  ItineraryDay,
} from "@/services/itinerary";
import { mapsService, RouteResult } from "@/services/maps";
import { weatherService } from "@/services/weather";
import { cache } from "@/utils/cache";
import {
  withRetry,
  categorizeError,
  AppError,
  parallelFetch,
  createAbortController,
  isAbortedError,
} from "@/utils/errorHandler";
import { useDebounce } from "./useDebounce";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { WeatherData } from "@/types";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ItineraryState {
  itinerary: ItineraryResponse | null;
  route: RouteResult | null;
  weather: WeatherData | null;
  images: string[];
  loading: boolean;
  error: AppError | null;
  isFromCache: boolean;
  progress: ItineraryProgress;
}

export interface ItineraryProgress {
  step: string;
  percentage: number;
}

export interface ParsedIntent {
  origin: string;
  destination: string;
  days: number;
  travelStyle: string[];
  budget: "economy" | "comfort" | "premium";
}

export interface UseItineraryOptions {
  autoFetch?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface UseItineraryReturn extends ItineraryState {
  generate: (query: string) => Promise<void>;
  cancel: () => void;
  retry: () => Promise<void>;
  clear: () => void;
  parseIntent: (query: string) => ParsedIntent;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const TRAVEL_STYLE_KEYWORDS: Record<string, string[]> = {
  adventure: ["trek", "hiking", "adventure", "mountain", "safari", "climb"],
  beach: ["beach", "coast", "sea", "island", "sand", "waves", "resort"],
  culture: [
    "temple",
    "heritage",
    "history",
    "culture",
    "monument",
    "fort",
    "palace",
  ],
  nature: ["nature", "forest", "wildlife", "park", "hill station", "green"],
  spiritual: [
    "temple",
    "spiritual",
    "pilgrimage",
    "ashram",
    "meditation",
    "yoga",
  ],
  luxury: ["luxury", "resort", "spa", "premium", "5-star", "exclusive"],
  budget: ["cheap", "budget", "hostel", "affordable", "backpack"],
};

const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// ─────────────────────────────────────────────────────────────
// INTENT PARSER
// ─────────────────────────────────────────────────────────────

function parseIntent(query: string): ParsedIntent {
  const lowerQuery = query.toLowerCase();

  // Extract origin (from X)
  const fromMatch = lowerQuery.match(
    /from\s+([a-zA-Z\s]+?)(?:\s+to|\s+for|\s+in|\s*$)/,
  );
  const origin = fromMatch ? fromMatch[1].trim() : "";

  // Extract destination (to X)
  const toMatch = lowerQuery.match(
    /to\s+([a-zA-Z\s]+?)(?:\s+for|\s+under|\s+in|\d|\s*$)/,
  );
  const destination = toMatch
    ? toMatch[1].trim()
    : extractDestinationFallback(query);

  // Extract days
  const daysMatch = lowerQuery.match(/(\d+)\s*-?\s*day/);
  const days = daysMatch ? parseInt(daysMatch[1]) : 3;

  // Extract travel style
  const travelStyle: string[] = [];
  for (const [style, keywords] of Object.entries(TRAVEL_STYLE_KEYWORDS)) {
    if (keywords.some((kw) => lowerQuery.includes(kw))) {
      travelStyle.push(style);
    }
  }

  // Extract budget level
  let budget: "economy" | "comfort" | "premium" = "economy";
  if (lowerQuery.includes("luxury") || lowerQuery.includes("premium")) {
    budget = "premium";
  } else if (lowerQuery.includes("comfort") || lowerQuery.includes("mid")) {
    budget = "comfort";
  }

  return { origin, destination, days, travelStyle, budget };
}

function extractDestinationFallback(query: string): string {
  // Remove common words and extract potential destination
  const cleaned = query
    .toLowerCase()
    .replace(/plan|trip|travel|visit|days?|from|to|for|under|in\b/g, "")
    .trim();

  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  return words.slice(0, 2).join(" ") || query.trim();
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useItinerary(
  options: UseItineraryOptions = {},
): UseItineraryReturn {
  const {
    autoFetch = false,
    cacheEnabled = true,
    cacheTTL = CACHE_TTL,
    maxRetries = 3,
    timeout = 30000,
  } = options;

  // State
  const [state, setState] = useState<ItineraryState>({
    itinerary: null,
    route: null,
    weather: null,
    images: [],
    loading: false,
    error: null,
    isFromCache: false,
    progress: { step: "idle", percentage: 0 },
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<string>("");
  const mountedRef = useRef(true);

  // Store
  const { setCachedItinerary, getCachedItinerary, logSearch } =
    useTravelIntelligence();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update progress
  const updateProgress = useCallback((step: string, percentage: number) => {
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, progress: { step, percentage } }));
    }
  }, []);

  // Cancel ongoing request
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      loading: false,
      progress: { step: "cancelled", percentage: 0 },
    }));
  }, []);

  // Clear state
  const clear = useCallback(() => {
    setState({
      itinerary: null,
      route: null,
      weather: null,
      images: [],
      loading: false,
      error: null,
      isFromCache: false,
      progress: { step: "idle", percentage: 0 },
    });
  }, []);

  // Main generate function
  const generate = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      lastQueryRef.current = query;
      const normalizedQuery = query.toLowerCase().trim();

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = createAbortController();

      // Reset state
      setState({
        itinerary: null,
        route: null,
        weather: null,
        images: [],
        loading: true,
        error: null,
        isFromCache: false,
        progress: { step: "starting", percentage: 5 },
      });

      const { origin, destination, days, budget } = parseIntent(query);

      // Check cache first
      if (cacheEnabled) {
        const cached = getCachedItinerary(normalizedQuery);
        if (cached) {
          const cachedItinerary = cached.itinerary as ItineraryResponse;
          const cachedRoute = cached.route as RouteResult;

          setState({
            itinerary: cachedItinerary,
            route: cachedRoute,
            weather: null,
            images: [],
            loading: false,
            error: null,
            isFromCache: true,
            progress: { step: "complete", percentage: 100 },
          });
          return;
        }

        // Also check local cache
        const localCached = await cache.get<{
          itinerary: ItineraryResponse;
          route: RouteResult;
        }>(`itinerary:${normalizedQuery}`);
        if (localCached) {
          setState({
            itinerary: localCached.itinerary,
            route: localCached.route,
            weather: null,
            images: [],
            loading: false,
            error: null,
            isFromCache: true,
            progress: { step: "complete", percentage: 100 },
          });
          return;
        }
      }

      try {
        updateProgress("fetching_route", 15);

        // Parallel fetch with graceful degradation
        const results = await parallelFetch(
          {
            route: async () => {
              if (!origin) return null;
              updateProgress("calculating_route", 25);
              return withRetry(
                () => mapsService.getRoute(origin, destination, "car"),
                { maxAttempts: maxRetries },
              );
            },
            itinerary: async () => {
              updateProgress("generating_itinerary", 35);
              return withRetry(
                () =>
                  itineraryService.generate(
                    destination,
                    days,
                    2,
                    budget,
                    query,
                  ),
                { maxAttempts: maxRetries },
              );
            },
            weather: async () => {
              updateProgress("fetching_weather", 60);
              try {
                return await weatherService.getWeather(destination);
              } catch {
                return null; // Weather is optional
              }
            },
          },
          {
            failFast: false,
            fallbacks: {
              route: null,
              weather: null,
            },
          },
        );

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        updateProgress("processing_results", 80);

        const itinerary = results.itinerary as ItineraryResponse | null;
        const route = results.route as RouteResult | null;
        const weather = results.weather as WeatherData | null;

        if (!itinerary) {
          throw new Error(
            "Unable to generate itinerary. Please try a different destination.",
          );
        }

        // Cache results
        if (cacheEnabled) {
          setCachedItinerary(normalizedQuery, {
            destination,
            days,
            itinerary,
            route,
          });
          await cache.set(
            `itinerary:${normalizedQuery}`,
            { itinerary, route },
            { ttl: cacheTTL },
          );
        }

        // Bug 2.3 fix: log the search to keep recent searches + inferred preferences up to date
        logSearch(query);

        updateProgress("complete", 100);

        setState({
          itinerary,
          route,
          weather,
          images: [],
          loading: false,
          error: null,
          isFromCache: false,
          progress: { step: "complete", percentage: 100 },
        });
      } catch (error: any) {
        if (isAbortedError(error)) {
          return; // Ignore abort errors
        }

        const appError = categorizeError(error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: appError,
          progress: { step: "error", percentage: 0 },
        }));
      }
    },
    [
      cacheEnabled,
      cacheTTL,
      maxRetries,
      getCachedItinerary,
      setCachedItinerary,
      updateProgress,
      logSearch,
    ],
  );

  // Retry last query
  const retry = useCallback(async () => {
    if (lastQueryRef.current) {
      await generate(lastQueryRef.current);
    }
  }, [generate]);

  return {
    ...state,
    generate,
    cancel,
    retry,
    clear,
    parseIntent,
  };
}

export default useItinerary;
