import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";

import { travelIntelligenceService } from "../services/travelIntelligenceService";
import type {
  TravelIntelligenceViewModel,
  TravelIntelligenceSnapshot,
} from "../types";
import { formatRelativeTimeLabel, travelIntelligenceLogger } from "../utils";

const TRAVEL_INTELLIGENCE_QUERY_KEY = ["travel-intelligence", "stats"] as const;

const getFriendlyErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load your travel intelligence right now.";
};

export const useTravelIntelligence = (): TravelIntelligenceViewModel => {
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(
    new Set(),
  );

  const netInfo = useNetInfo();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;

  const statsQuery = useQuery({
    queryKey: TRAVEL_INTELLIGENCE_QUERY_KEY,
    queryFn: travelIntelligenceService.fetchStats,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount: number, error: unknown) => {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("unauthorized") || message.includes("forbidden")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const snapshot = useMemo<TravelIntelligenceSnapshot | null>(() => {
    if (!statsQuery.data) {
      return null;
    }

    return travelIntelligenceService.buildSnapshot(
      statsQuery.data,
      dismissedInsights,
      statsQuery.dataUpdatedAt || Date.now(),
    );
  }, [dismissedInsights, statsQuery.data, statsQuery.dataUpdatedAt]);

  const aiMutation = useMutation({
    mutationFn: async (query: string) => {
      if (!snapshot) {
        throw new Error("Travel intelligence is not ready yet.");
      }

      return travelIntelligenceService.askAssistant(query, snapshot);
    },
    retry: 1,
    retryDelay: 800,
  });

  const refresh = useCallback(async () => {
    travelIntelligenceLogger("Refreshing travel intelligence");
    await statsQuery.refetch();
  }, [statsQuery]);

  const dismissInsight = useCallback((id: string) => {
    setDismissedInsights((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const askAI = useCallback(
    async (query: string) => aiMutation.mutateAsync(query),
    [aiMutation],
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!snapshot) {
      return "Waiting for data";
    }

    return formatRelativeTimeLabel(snapshot.lastUpdatedAt);
  }, [snapshot]);

  return {
    snapshot,
    isLoading: statsQuery.isPending,
    isRefreshing: statsQuery.isFetching && !statsQuery.isPending,
    isOffline,
    error: statsQuery.error ? getFriendlyErrorMessage(statsQuery.error) : null,
    refresh,
    dismissInsight,
    askAI,
    isAiLoading: aiMutation.isPending,
    aiError: aiMutation.error
      ? getFriendlyErrorMessage(aiMutation.error)
      : null,
    lastUpdatedLabel,
  };
};

export default useTravelIntelligence;
