import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";

import { destinationsService } from "@/services/destinations";
import type { Destination } from "@/types";

import { comparisonService } from "../services/comparisonService";
import { formatRelativeTimeLabel } from "../utils/formatters";
import {
  CompareRouteParams,
  CompareViewModel,
  ComparisonPriority,
  MAX_COMPARE_DESTINATIONS,
  MIN_COMPARE_DESTINATIONS,
} from "../types";

const DEFAULT_PRIORITY: ComparisonPriority = "balanced";
const DEFAULT_DAYS = 5;
const DEFAULT_FAMILY_SIZE = 4;
const DEFAULT_TRAVEL_CLASS = "economy";

const DESTINATIONS_QUERY_KEY = ["compare", "destinations"] as const;

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const friendlyErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load comparison data right now.";
};

const clampSelection = (destinationIds: string[]): string[] =>
  destinationIds.slice(0, MAX_COMPARE_DESTINATIONS);

const sanitizeNumber = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && value !== undefined ? Math.max(1, value) : fallback;

export const useCompare = (
  initialParams: CompareRouteParams = {},
): CompareViewModel => {
  const netInfo = useNetInfo();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;

  const [selectedDestinationIds, setSelectedDestinationIds] = useState<
    string[]
  >([]);
  const [activeDestinationId, setActiveDestinationId] = useState<string | null>(
    null,
  );
  const [priority, setPriorityState] = useState<ComparisonPriority>(
    initialParams.priority ?? DEFAULT_PRIORITY,
  );
  const [days, setDaysState] = useState<number>(
    sanitizeNumber(initialParams.days, DEFAULT_DAYS),
  );
  const [familySize, setFamilySizeState] = useState<number>(
    sanitizeNumber(initialParams.familySize, DEFAULT_FAMILY_SIZE),
  );
  const [travelClass, setTravelClassState] = useState<string>(
    initialParams.travelClass ?? DEFAULT_TRAVEL_CLASS,
  );
  const initializedRef = useRef(false);

  const destinationsQuery = useQuery({
    queryKey: DESTINATIONS_QUERY_KEY,
    queryFn: destinationsService.getDestinations,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });

  const destinationLookup = useMemo(() => {
    const lookup = new Map<string, Destination>();

    destinationsQuery.data?.forEach((destination) => {
      lookup.set(normalizeKey(destination.id), destination);
      lookup.set(normalizeKey(destination.label), destination);
    });

    return lookup;
  }, [destinationsQuery.data]);

  useEffect(() => {
    if (
      initializedRef.current ||
      !destinationsQuery.data ||
      destinationsQuery.data.length === 0
    ) {
      return;
    }

    const initialIds = [initialParams.dest1, initialParams.dest2]
      .filter((value): value is string => Boolean(value))
      .map((value) => destinationLookup.get(normalizeKey(value)))
      .filter((destination): destination is Destination => Boolean(destination))
      .map((destination) => destination.id);

    const fallbackIds = destinationsQuery.data
      .slice(0, MIN_COMPARE_DESTINATIONS)
      .map((destination) => destination.id);
    const nextIds = clampSelection(
      Array.from(
        new Set(
          initialIds.length >= MIN_COMPARE_DESTINATIONS
            ? initialIds
            : fallbackIds,
        ),
      ),
    );

    setSelectedDestinationIds(nextIds);
    setActiveDestinationId(nextIds[0] ?? null);
    setPriorityState(initialParams.priority ?? DEFAULT_PRIORITY);
    setDaysState(sanitizeNumber(initialParams.days, DEFAULT_DAYS));
    setFamilySizeState(
      sanitizeNumber(initialParams.familySize, DEFAULT_FAMILY_SIZE),
    );
    setTravelClassState(initialParams.travelClass ?? DEFAULT_TRAVEL_CLASS);
    initializedRef.current = true;
  }, [destinationLookup, destinationsQuery.data, initialParams]);

  useEffect(() => {
    if (!destinationLookup.size || selectedDestinationIds.length === 0) {
      return;
    }

    setSelectedDestinationIds((current) =>
      current.filter((destinationId) =>
        destinationLookup.has(normalizeKey(destinationId)),
      ),
    );
  }, [destinationLookup]);

  useEffect(() => {
    if (selectedDestinationIds.length === 0) {
      setActiveDestinationId(null);
      return;
    }

    if (
      !activeDestinationId ||
      !selectedDestinationIds.includes(activeDestinationId)
    ) {
      setActiveDestinationId(selectedDestinationIds[0]);
    }
  }, [activeDestinationId, selectedDestinationIds]);

  const selectedDestinations = useMemo(
    () =>
      selectedDestinationIds
        .map((destinationId) =>
          destinationsQuery.data?.find(
            (destination) => destination.id === destinationId,
          ),
        )
        .filter((destination): destination is Destination =>
          Boolean(destination),
        ),
    [destinationsQuery.data, selectedDestinationIds],
  );

  const activeDestinationIndex = useMemo(() => {
    if (!activeDestinationId) {
      return 0;
    }

    const index = selectedDestinationIds.indexOf(activeDestinationId);
    return index >= 0 ? index : 0;
  }, [activeDestinationId, selectedDestinationIds]);

  const comparisonQuery = useQuery({
    queryKey: [
      "compare",
      "analysis",
      selectedDestinationIds.join("|"),
      priority,
      days,
      familySize,
      travelClass,
    ] as const,
    queryFn: async () =>
      comparisonService.loadComparisonBundle(selectedDestinations, {
        priority,
        days,
        familySize,
        travelClass,
      }),
    enabled:
      selectedDestinations.length >= MIN_COMPARE_DESTINATIONS &&
      destinationsQuery.isSuccess,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
  });

  const analysis = comparisonQuery.data?.analysis ?? null;
  const source = comparisonQuery.data?.snapshot.source ?? null;
  const lastUpdatedLabel = useMemo(
    () =>
      formatRelativeTimeLabel(
        comparisonQuery.data?.snapshot.lastUpdatedAt ??
          analysis?.lastUpdatedAt ??
          null,
      ),
    [analysis?.lastUpdatedAt, comparisonQuery.data?.snapshot.lastUpdatedAt],
  );

  const toggleDestination = useCallback(
    (destination: Destination) => {
      setSelectedDestinationIds((current) => {
        const exists = current.includes(destination.id);

        if (exists) {
          const next = current.filter(
            (destinationId) => destinationId !== destination.id,
          );
          if (activeDestinationId === destination.id) {
            setActiveDestinationId(next[0] ?? null);
          }
          return next;
        }

        if (current.length >= MAX_COMPARE_DESTINATIONS) {
          return [...current.slice(1), destination.id];
        }

        return [...current, destination.id];
      });

      setActiveDestinationId(destination.id);
    },
    [activeDestinationId],
  );

  const removeDestination = useCallback(
    (destinationId: string) => {
      setSelectedDestinationIds((current) => {
        const next = current.filter((item) => item !== destinationId);
        if (activeDestinationId === destinationId) {
          setActiveDestinationId(next[0] ?? null);
        }
        return next;
      });
    },
    [activeDestinationId],
  );

  const swapTopTwo = useCallback(() => {
    setSelectedDestinationIds((current) => {
      if (current.length < MIN_COMPARE_DESTINATIONS) {
        return current;
      }

      const next = [...current];
      [next[0], next[1]] = [next[1], next[0]];
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    await Promise.allSettled([
      destinationsQuery.refetch(),
      comparisonQuery.refetch(),
    ]);
  }, [comparisonQuery, destinationsQuery]);

  const retry = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const error = useMemo(() => {
    if (destinationsQuery.error && !destinationsQuery.data) {
      return friendlyErrorMessage(destinationsQuery.error);
    }

    if (comparisonQuery.error && !comparisonQuery.data) {
      return friendlyErrorMessage(comparisonQuery.error);
    }

    return null;
  }, [
    comparisonQuery.data,
    comparisonQuery.error,
    destinationsQuery.data,
    destinationsQuery.error,
  ]);

  return {
    destinations: destinationsQuery.data ?? [],
    selectedDestinations,
    activeDestinationId,
    activeDestinationIndex,
    analysis,
    isLoadingDestinations: destinationsQuery.isPending,
    isLoadingAnalysis:
      comparisonQuery.isPending &&
      selectedDestinations.length >= MIN_COMPARE_DESTINATIONS,
    isRefreshing: destinationsQuery.isFetching || comparisonQuery.isFetching,
    isOffline,
    error,
    canCompare: selectedDestinations.length >= MIN_COMPARE_DESTINATIONS,
    maxDestinations: MAX_COMPARE_DESTINATIONS,
    priority,
    days,
    familySize,
    travelClass,
    source,
    lastUpdatedLabel,
    toggleDestination,
    removeDestination,
    setActiveDestination: setActiveDestinationId,
    swapTopTwo,
    setPriority: setPriorityState,
    setDays: setDaysState,
    setFamilySize: setFamilySizeState,
    setTravelClass: setTravelClassState,
    refresh,
    retry,
  };
};

export default useCompare;
