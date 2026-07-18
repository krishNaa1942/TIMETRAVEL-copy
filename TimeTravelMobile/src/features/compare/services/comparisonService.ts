import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import compareService from "@/services/compare";
import type { Destination } from "@/types";

import { analyzeComparison } from "../engine/scoringEngine";
import type {
  CompareProfile,
  ComparisonAnalysis,
  ComparisonDataSource,
  ComparisonPreferences,
  ComparisonSessionSnapshot,
} from "../types";

export interface ComparisonBundle {
  snapshot: ComparisonSessionSnapshot;
  analysis: ComparisonAnalysis;
  cacheKey: string;
}

interface ComparisonCachePayload extends ComparisonBundle {
  cachedAt: number;
}

const CACHE_PREFIX = "@compare_bundle_v1";
const LAST_CACHE_KEY = "@compare_bundle_last_v1";

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const buildLookup = (destinations: Destination[]): Map<string, Destination> => {
  const lookup = new Map<string, Destination>();

  destinations.forEach((destination) => {
    lookup.set(normalizeKey(destination.id), destination);
    lookup.set(normalizeKey(destination.label), destination);
  });

  return lookup;
};

const buildPairs = (
  destinations: Destination[],
): Array<[Destination, Destination]> => {
  const pairs: Array<[Destination, Destination]> = [];

  for (let index = 0; index < destinations.length; index += 1) {
    for (
      let innerIndex = index + 1;
      innerIndex < destinations.length;
      innerIndex += 1
    ) {
      pairs.push([destinations[index], destinations[innerIndex]]);
    }
  }

  return pairs;
};

const buildCacheKey = (
  destinations: Destination[],
  preferences: ComparisonPreferences,
): string => {
  const destinationKey = destinations
    .map((destination) => destination.id)
    .sort()
    .join("|");
  return [
    CACHE_PREFIX,
    destinationKey,
    preferences.priority,
    preferences.days,
    preferences.familySize,
    preferences.travelClass,
  ].join("::");
};

const buildMockSnapshot = (
  destinations: Destination[],
  preferences: ComparisonPreferences,
  lastUpdatedAt = Date.now(),
): ComparisonSessionSnapshot => ({
  destinations,
  preferences,
  profilesByDestination: Object.fromEntries(
    destinations.map((destination) => [destination.id, [] as CompareProfile[]]),
  ),
  source: "mock",
  hasPartialData: true,
  lastUpdatedAt,
});

const readCache = async (
  cacheKey: string,
): Promise<ComparisonBundle | null> => {
  const [directRaw, lastCacheKey] = await Promise.all([
    AsyncStorage.getItem(cacheKey),
    AsyncStorage.getItem(LAST_CACHE_KEY),
  ]);

  const parsePayload = (raw: string | null): ComparisonBundle | null => {
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as ComparisonCachePayload;

      if (!parsed.snapshot || !parsed.analysis) {
        return null;
      }

      return {
        snapshot: parsed.snapshot,
        analysis: parsed.analysis,
        cacheKey: parsed.cacheKey,
      };
    } catch {
      return null;
    }
  };

  const directBundle = parsePayload(directRaw);
  if (directBundle) {
    return directBundle;
  }

  if (lastCacheKey && lastCacheKey !== cacheKey) {
    return parsePayload(await AsyncStorage.getItem(lastCacheKey));
  }

  return null;
};

const writeCache = async (bundle: ComparisonBundle): Promise<void> => {
  const payload: ComparisonCachePayload = {
    ...bundle,
    cachedAt: Date.now(),
  };

  const serialized = JSON.stringify(payload);
  await Promise.all([
    AsyncStorage.setItem(bundle.cacheKey, serialized),
    AsyncStorage.setItem(LAST_CACHE_KEY, bundle.cacheKey),
  ]);
};

const buildLiveSnapshot = async (
  destinations: Destination[],
  preferences: ComparisonPreferences,
): Promise<ComparisonSessionSnapshot> => {
  const lookup = buildLookup(destinations);
  const pairs = buildPairs(destinations);

  if (pairs.length === 0) {
    throw new Error("Select at least two destinations to compare.");
  }

  const settledPairs = await Promise.allSettled(
    pairs.map(([left, right]) =>
      compareService.compare(
        left.label,
        right.label,
        preferences.days,
        preferences.familySize,
        preferences.travelClass,
      ),
    ),
  );

  const profilesByDestination = Object.fromEntries(
    destinations.map((destination) => [destination.id, [] as CompareProfile[]]),
  );

  let successCount = 0;

  settledPairs.forEach((entry) => {
    if (entry.status !== "fulfilled") {
      return;
    }

    successCount += 1;
    const { dest1, dest2 } = entry.value;
    const leftDestination = lookup.get(normalizeKey(dest1.destination));
    const rightDestination = lookup.get(normalizeKey(dest2.destination));

    if (leftDestination) {
      profilesByDestination[leftDestination.id].push(dest1);
    }

    if (rightDestination) {
      profilesByDestination[rightDestination.id].push(dest2);
    }
  });

  if (successCount === 0) {
    throw new Error("Unable to load comparison data from the server.");
  }

  const hasPartialData =
    successCount !== pairs.length ||
    destinations.some(
      (destination) => profilesByDestination[destination.id].length === 0,
    );

  return {
    destinations,
    preferences,
    profilesByDestination,
    source: hasPartialData ? "live" : "live",
    hasPartialData,
    lastUpdatedAt: Date.now(),
  };
};

export const comparisonService = {
  buildCacheKey,

  async loadComparisonBundle(
    destinations: Destination[],
    preferences: ComparisonPreferences,
  ): Promise<ComparisonBundle> {
    const cacheKey = buildCacheKey(destinations, preferences);
    const connection = await NetInfo.fetch();
    const isOffline =
      connection.isConnected === false ||
      connection.isInternetReachable === false;

    if (isOffline) {
      const cached = await readCache(cacheKey);
      if (cached) {
        return cached;
      }

      const snapshot = buildMockSnapshot(destinations, preferences);
      const analysis = analyzeComparison({
        destinations,
        profilesByDestination: snapshot.profilesByDestination,
        preferences,
        source: snapshot.source,
        hasPartialData: snapshot.hasPartialData,
        lastUpdatedAt: snapshot.lastUpdatedAt,
      });

      return {
        snapshot,
        analysis,
        cacheKey,
      };
    }

    try {
      const snapshot = await buildLiveSnapshot(destinations, preferences);
      const analysis = analyzeComparison({
        destinations,
        profilesByDestination: snapshot.profilesByDestination,
        preferences,
        source: snapshot.source,
        hasPartialData: snapshot.hasPartialData,
        lastUpdatedAt: snapshot.lastUpdatedAt,
      });

      const bundle: ComparisonBundle = {
        snapshot,
        analysis,
        cacheKey,
      };

      await writeCache(bundle);
      return bundle;
    } catch (error) {
      const cached = await readCache(cacheKey);
      if (cached) {
        return cached;
      }

      const snapshot = buildMockSnapshot(destinations, preferences);
      const analysis = analyzeComparison({
        destinations,
        profilesByDestination: snapshot.profilesByDestination,
        preferences,
        source: snapshot.source,
        hasPartialData: snapshot.hasPartialData,
        lastUpdatedAt: snapshot.lastUpdatedAt,
      });

      return {
        snapshot,
        analysis,
        cacheKey,
      };
    }
  },

  async loadCachedBundle(
    destinations: Destination[],
    preferences: ComparisonPreferences,
  ): Promise<ComparisonBundle | null> {
    const cacheKey = buildCacheKey(destinations, preferences);
    return readCache(cacheKey);
  },
};

export default comparisonService;
