/**
 * useItinerary Hook (v2)
 * ======================
 * React Query backed generation flow over the backend background-job
 * pipeline:
 *
 *   generate(query)                 → POST /itinerary/jobs (server parses intent)
 *   poll GET /itinerary/jobs/:id     → live progress + streamed days + result
 *   cancel()                         → POST /itinerary/jobs/:id/cancel
 *   saveTrip(bulkPayload)            → POST /trips/planner/bulk (idempotent)
 *
 * Intent parsing, destination resolution and geocoding now happen
 * server-side (single authority), so the client no longer keeps a regex
 * parser or its own geocode/route fetches. A single AsyncStorage cache
 * layer provides offline-first results.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  itineraryService,
  ItineraryResponse,
  ItineraryDay,
  BulkSaveTripPayload,
  BulkSaveTripResult,
  CreateItineraryJobPayload,
  ItineraryJobStatus,
} from "@/services/itinerary";
import { weatherService } from "@/services/weather";
import { cache } from "@/utils/cache";
import { categorizeError, AppError } from "@/utils/errorHandler";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { useTripsStore } from "@/stores/tripsStore";
import { WeatherData } from "@/types";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const POLL_INTERVAL_MS = 1200;
const TERMINAL_STATUSES: Record<ItineraryJobStatus, boolean> = {
  queued: false,
  running: false,
  cancelling: false,
  done: true,
  error: true,
  cancelled: true,
};

export interface ItineraryProgress {
  step: string;
  percentage: number;
  dayCount: number;
}

export interface UseItineraryReturn {
  itinerary: ItineraryResponse | null;
  weather: WeatherData | null;
  loading: boolean;
  error: AppError | null;
  isFromCache: boolean;
  progress: ItineraryProgress;
  jobStatus: ItineraryJobStatus | null;
  jobId: string | null;
  cancel: () => void;
  retry: () => Promise<void>;
  clear: () => void;
  generate: (query: string, overrides?: CreateItineraryJobPayload) => Promise<void>;
  saving: boolean;
  savedTripId: number | null;
  saveTrip: (payload: BulkSaveTripPayload) => Promise<BulkSaveTripResult>;
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useItinerary(): UseItineraryReturn {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [cached, setCached] = useState<ItineraryResponse | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [savedTripId, setSavedTripId] = useState<number | null>(null);
  const lastQueryRef = useRef<string>("");
  const loggedRef = useRef(false);

  const { logSearch } = useTravelIntelligence();

  // ── Create job ─────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: CreateItineraryJobPayload) =>
      itineraryService.createJob(payload),
    onSuccess: (data) => setJobId(data.job_id),
  });

  // ── Cancel job ─────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: (id: string) => itineraryService.cancelJob(id),
  });

  // ── Poll the running job ────────────────────────────────────
  const jobQuery = useQuery({
    queryKey: ["itinerary-job", jobId],
    queryFn: () => itineraryService.getJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const snapshot = query.state.data;
      if (snapshot && TERMINAL_STATUSES[snapshot.status]) return false;
      return POLL_INTERVAL_MS;
    },
    retry: 2,
  });

  const snapshot = jobQuery.data;
  const isTerminal = snapshot ? TERMINAL_STATUSES[snapshot.status] : !jobId;

  // ── Live / final itinerary derived from the job or cache ────
  const itinerary = useMemo<ItineraryResponse | null>(() => {
    if (cached) return cached;
    if (!snapshot) return null;
    if (snapshot.status === "cancelled") return null;
    if (snapshot.status === "error") return null;
    if (snapshot.result) return snapshot.result;

    // Streaming preview: build a response from the days streamed so far.
    const p = (snapshot.params || {}) as Record<string, unknown>;
    return {
      destination: String(p.destination ?? ""),
      num_days: Number(p.num_days ?? 3),
      family_size: Number(p.family_size ?? 1),
      travel_class: String(p.travel_class ?? "economy"),
      interests: String(p.interests ?? ""),
      itinerary: (snapshot.itinerary as ItineraryDay[]) || [],
    };
  }, [cached, snapshot]);

  const destination = itinerary?.destination || null;

  // ── Weather (independent, cached 30m) ───────────────────────
  const weatherQuery = useQuery({
    queryKey: ["itinerary-weather", destination],
    queryFn: () => weatherService.getWeather(destination as string),
    enabled: Boolean(destination),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  // ── Error state ─────────────────────────────────────────────
  const error = useMemo<AppError | null>(() => {
    if (createMutation.error) return categorizeError(createMutation.error);
    if (jobQuery.isError) return categorizeError(jobQuery.error);
    if (snapshot?.status === "error") {
      return categorizeError(
        new Error(snapshot.error || "Generation failed."),
      );
    }
    return null;
  }, [createMutation.error, jobQuery.isError, jobQuery.error, snapshot]);

  const loading =
    (Boolean(jobId) && !isTerminal) || createMutation.isPending;

  // ── Generate ────────────────────────────────────────────────
  const generate = useCallback(
    async (queryText: string, overrides?: CreateItineraryJobPayload) => {
      const query = queryText.trim();
      if (!query && !overrides?.destination) return;

      const normalized = query.toLowerCase();
      lastQueryRef.current = normalized;
      loggedRef.current = false;
      setSavedTripId(null);
      setJobId(null);
      createMutation.reset();

      // Single cache layer (AsyncStorage) — no double-cache with the
      // travel-intelligence store anymore.
      if (query) {
        const hit = await cache.get<ItineraryResponse>(`itinerary:${normalized}`);
        if (hit) {
          setCached(hit);
          setFromCache(true);
          logSearch(query);
          return;
        }
      }

      setCached(null);
      setFromCache(false);
      await createMutation.mutateAsync(
        overrides ? { query, ...overrides } : { query },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createMutation, logSearch],
  );

  // On successful completion: log the search once + persist the single cache.
  const done = snapshot?.status === "done" && Boolean(snapshot?.result);
  useEffect(() => {
    if (!done) {
      loggedRef.current = false;
      return;
    }
    if (loggedRef.current) return;
    loggedRef.current = true;
    if (snapshot?.result && lastQueryRef.current) {
      cache
        .set(`itinerary:${lastQueryRef.current}`, snapshot.result, {
          ttl: CACHE_TTL,
        })
        .catch(() => {});
      logSearch(lastQueryRef.current);
    }
  }, [done, snapshot?.result, logSearch]);

  // ── Cancel ──────────────────────────────────────────────────
  const cancel = useCallback(() => {
    if (jobId && !isTerminal) cancelMutation.mutate(jobId);
  }, [jobId, isTerminal, cancelMutation]);

  // ── Retry last query ────────────────────────────────────────
  const retry = useCallback(async () => {
    if (lastQueryRef.current) {
      await generate(lastQueryRef.current);
    }
  }, [generate]);

  // ── Clear ───────────────────────────────────────────────────
  const clear = useCallback(() => {
    setJobId(null);
    setCached(null);
    setFromCache(false);
    setSavedTripId(null);
    createMutation.reset();
  }, [createMutation]);

  // ── Save trip (bulk, idempotent) ────────────────────────────
  const saveTripMutation = useMutation({
    mutationFn: (payload: BulkSaveTripPayload) =>
      itineraryService.bulkSaveTrip(payload),
    onSuccess: (data) => {
      setSavedTripId(data.trip.id);
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      // TripsScreen is store-backed — keep it in sync without blocking save.
      useTripsStore.getState().refresh().catch(() => {});
    },
  });

  const saveTrip = useCallback(
    async (payload: BulkSaveTripPayload): Promise<BulkSaveTripResult> => {
      return saveTripMutation.mutateAsync(payload);
    },
    [saveTripMutation],
  );

  const progress = useMemo<ItineraryProgress>(() => {
    if (!snapshot) {
      if (createMutation.isPending) {
        return { step: "starting", percentage: 5, dayCount: 0 };
      }
      return { step: "idle", percentage: 0, dayCount: 0 };
    }
    return {
      step: snapshot.step,
      percentage: snapshot.progress ?? 0,
      dayCount: snapshot.day_count ?? snapshot.itinerary?.length ?? 0,
    };
  }, [snapshot, createMutation.isPending]);

  return {
    itinerary,
    weather: weatherQuery.data ?? null,
    loading,
    error,
    isFromCache: fromCache,
    progress,
    jobStatus: snapshot?.status ?? null,
    jobId,
    cancel,
    retry,
    clear,
    generate,
    saving: saveTripMutation.isPending,
    savedTripId,
    saveTrip,
  };
}

export default useItinerary;