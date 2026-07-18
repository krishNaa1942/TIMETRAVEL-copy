import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import { statsService, type TravelStats } from "@/services/stats";
import travelIntelligenceEngine from "@/services/travelIntelligenceEngine";
import type {
  AIAssistantResponse,
  AIInsight,
  TravelIntelligenceSnapshot,
} from "../types";
import {
  formatCurrency,
  formatNumber,
  travelIntelligenceLogger,
} from "../utils";

type StatsEnvelope = {
  stats?: TravelStats;
  data?: TravelStats;
};

type CachedStatsPayload = {
  stats: TravelStats;
  savedAt: number;
};

const CACHE_KEY = "@travel_intelligence_stats_cache_v2";
const CACHE_TTL_MS = 5 * 60 * 1000;
const AI_TIMEOUT_MS = 4500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTravelStatsLike = (value: unknown): value is TravelStats => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.trips) &&
    typeof value.trips.total === "number" &&
    typeof value.trips.planning === "number" &&
    typeof value.trips.active === "number" &&
    typeof value.trips.completed === "number" &&
    typeof value.destinations_visited === "number" &&
    typeof value.places_visited === "number" &&
    typeof value.total_travel_days === "number" &&
    typeof value.total_spent === "number" &&
    isRecord(value.spending_breakdown) &&
    isRecord(value.reservations) &&
    typeof value.photos_uploaded === "number" &&
    typeof value.favorites_count === "number" &&
    Array.isArray(value.top_destinations) &&
    Array.isArray(value.budget_by_trip) &&
    isRecord(value.place_categories)
  );
};

const isStatsEnvelope = (value: unknown): value is StatsEnvelope =>
  isRecord(value) &&
  (isTravelStatsLike(value.stats) || isTravelStatsLike(value.data));

const normalizeStatsResponse = (response: unknown): TravelStats => {
  if (isTravelStatsLike(response)) {
    return response;
  }

  if (isStatsEnvelope(response)) {
    if (isTravelStatsLike(response.stats)) {
      return response.stats;
    }

    if (isTravelStatsLike(response.data)) {
      return response.data;
    }
  }

  throw new Error("Invalid travel stats response");
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error("AI assistant timed out.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const readCachedStats = async (): Promise<CachedStatsPayload | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedStatsPayload>;

    if (!parsed.stats || !isTravelStatsLike(parsed.stats)) {
      return null;
    }

    return {
      stats: parsed.stats,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch (error) {
    travelIntelligenceLogger("Failed to read cached stats", error);
    return null;
  }
};

const writeCachedStats = async (stats: TravelStats): Promise<void> => {
  const payload: CachedStatsPayload = {
    stats,
    savedAt: Date.now(),
  };

  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
};

const filterDismissedInsights = (
  insights: AIInsight[],
  dismissedIds: ReadonlySet<string>,
): AIInsight[] => insights.filter((insight) => !dismissedIds.has(insight.id));

const buildFollowUpQuestions = (queryType: AIAssistantQueryType): string[] => {
  switch (queryType) {
    case "prediction":
      return [
        "Show me travel predictions",
        "What should I budget next?",
        "What season suits me best?",
      ];
    case "recommendation":
      return [
        "Suggest destinations for me",
        "What is my travel style?",
        "Show me budget options",
      ];
    case "comparison":
      return [
        "Compare my spending trends",
        "Compare trip seasons",
        "Compare destination patterns",
      ];
    default:
      return [
        "Where should I travel next?",
        "How can I reduce expenses?",
        "What is my travel personality?",
      ];
  }
};

type AIAssistantQueryType =
  | "insight"
  | "prediction"
  | "recommendation"
  | "comparison"
  | "help";

const inferQueryType = (query: string): AIAssistantQueryType => {
  const normalized = query.toLowerCase();

  if (normalized.includes("predict") || normalized.includes("next")) {
    return "prediction";
  }

  if (normalized.includes("recommend") || normalized.includes("suggest")) {
    return "recommendation";
  }

  if (
    normalized.includes("compare") ||
    normalized.includes("versus") ||
    normalized.includes("vs")
  ) {
    return "comparison";
  }

  if (normalized.includes("help")) {
    return "help";
  }

  return "insight";
};

const buildAssistantResponse = (
  query: string,
  snapshot: TravelIntelligenceSnapshot,
): AIAssistantResponse => {
  const queryType = inferQueryType(query);
  const topDestination =
    snapshot.rawStats.top_destinations[0]?.destination ??
    "your favorite destination";
  const avgTripCost = formatCurrency(snapshot.summary.spending.avgPerTrip);
  const totalTrips = formatNumber(snapshot.rawStats.trips.total);
  const sharedDataPoint =
    snapshot.insights[0]?.title ?? snapshot.personality.type;

  let response = "";

  switch (queryType) {
    case "prediction":
      response = `Based on your ${totalTrips} trips and ${snapshot.dna.explorer}% explorer score, your next likely trip leans toward ${snapshot.predictions[0]?.prediction ?? "a new destination"}. Your average trip spend is ${avgTripCost}, so a balanced budget will help you keep exploring.`;
      break;
    case "recommendation":
      response = `Your travel personality looks like ${snapshot.personality.type}. A strong recommendation is to explore ${topDestination} style experiences, especially ones that match your ${sharedDataPoint.toLowerCase()}.`;
      break;
    case "comparison":
      response = `Compared with your current travel patterns, your strongest signals are ${snapshot.personality.tagline.toLowerCase()} and an average trip cost of ${avgTripCost}. The best next comparison is between premium and budget trips based on your spending mix.`;
      break;
    case "help":
      response = `I can help you understand your travel DNA, estimate your next trip, compare spending, and suggest destinations. Ask about your personality, budget, or predictions.`;
      break;
    default:
      response = `You have ${totalTrips} trips recorded, ${snapshot.rawStats.destinations_visited} destinations visited, and a ${snapshot.financialHealth.grade} financial grade. Your travel profile suggests ${snapshot.personality.tagline.toLowerCase()}.`;
      break;
  }

  return {
    query,
    response,
    insights: snapshot.insights.slice(0, 3),
    actions: [
      {
        label: "Open travel stats",
        data: { screen: "TravelStats" },
      },
      {
        label: "Review top destination",
        data: { destination: topDestination },
      },
    ],
    followUpQuestions: buildFollowUpQuestions(queryType),
  };
};

export const travelIntelligenceService = {
  async fetchStats(): Promise<TravelStats> {
    const connection = await NetInfo.fetch();
    const isOffline =
      connection.isConnected === false ||
      connection.isInternetReachable === false;

    if (isOffline) {
      const cached = await readCachedStats();
      if (cached) {
        travelIntelligenceLogger("Offline mode - using cached travel stats");
        return cached.stats;
      }
    }

    try {
      travelIntelligenceLogger("Fetching travel stats from API");
      const response = await statsService.getStats();
      const stats = normalizeStatsResponse(response);
      await writeCachedStats(stats);
      return stats;
    } catch (error) {
      travelIntelligenceLogger("Travel stats API failed", error);
      const cached = await readCachedStats();

      if (cached && Date.now() - cached.savedAt <= CACHE_TTL_MS) {
        travelIntelligenceLogger("Falling back to cached travel stats");
        return cached.stats;
      }

      throw error;
    }
  },

  async getCachedStats(): Promise<TravelStats | null> {
    const cached = await readCachedStats();
    return cached?.stats ?? null;
  },

  buildSnapshot(
    stats: TravelStats,
    dismissedInsightIds: ReadonlySet<string> = new Set(),
    lastUpdatedAt = Date.now(),
  ): TravelIntelligenceSnapshot {
    const dna = travelIntelligenceEngine.computeTravelDNA(stats);
    const personality = travelIntelligenceEngine.determinePersonality(dna);
    const insights = filterDismissedInsights(
      travelIntelligenceEngine.generateInsights(stats, dna),
      dismissedInsightIds,
    );
    const predictions = travelIntelligenceEngine.generatePredictions(
      stats,
      dna,
    );
    const financialHealth =
      travelIntelligenceEngine.computeFinancialHealth(stats);
    const spendingCategories =
      travelIntelligenceEngine.computeSpendingCategories(stats);
    const achievements = travelIntelligenceEngine.computeAchievements(stats);
    const level = travelIntelligenceEngine.computeUserLevel(
      travelIntelligenceEngine.calculateTotalXP(stats, achievements),
    );
    const streaks = travelIntelligenceEngine.computeStreaks(stats);
    const badges = travelIntelligenceEngine.computeBadges(stats);
    const stories = travelIntelligenceEngine.generateStories(stats);
    const summary = travelIntelligenceEngine.computeEnhancedStats(stats);

    return {
      rawStats: stats,
      summary,
      dna,
      personality,
      insights,
      predictions,
      financialHealth,
      spendingCategories,
      level,
      streaks,
      badges,
      achievements,
      stories,
      hasData:
        stats.trips.total > 0 ||
        stats.total_spent > 0 ||
        stats.destinations_visited > 0,
      lastUpdatedAt,
    };
  },

  async askAssistant(
    query: string,
    snapshot: TravelIntelligenceSnapshot,
  ): Promise<AIAssistantResponse> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new Error("Enter a question for the AI assistant.");
    }

    travelIntelligenceLogger("AI query", normalizedQuery);

    const response = await withTimeout(
      Promise.resolve(buildAssistantResponse(normalizedQuery, snapshot)),
      AI_TIMEOUT_MS,
    );

    travelIntelligenceLogger("AI response", response.response);
    return response;
  },
};

export type TravelIntelligenceService = typeof travelIntelligenceService;
