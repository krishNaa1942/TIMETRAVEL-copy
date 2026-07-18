import type { CompareProfile, Destination } from "../types";
import {
  ComparisonAnalysis,
  ComparisonAggregateMetrics,
  ComparisonCandidateScore,
  ComparisonDataSource,
  ComparisonFactorDirection,
  ComparisonFactorKey,
  ComparisonFactorScore,
  ComparisonFactorSpec,
  ComparisonPreferences,
  MAX_COMPARE_DESTINATIONS,
  MIN_COMPARE_DESTINATIONS,
} from "../types";
import {
  clamp,
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatScore,
  formatSignedPercent,
  formatTemperature,
} from "../utils/formatters";
import { buildComparisonInsights, buildWinnerReasoning } from "./insightEngine";

export { MAX_COMPARE_DESTINATIONS, MIN_COMPARE_DESTINATIONS } from "../types";

export const comparisonFactorSpecs: readonly ComparisonFactorSpec[] = [
  {
    key: "budget",
    label: "Budget",
    category: "cost",
    direction: "lower",
    icon: "cash-multiple",
    description: "Lower trip cost wins when budget matters.",
  },
  {
    key: "safety",
    label: "Safety",
    category: "risk",
    direction: "higher",
    icon: "shield-check",
    description: "Safer destinations score higher.",
  },
  {
    key: "weather",
    label: "Weather comfort",
    category: "comfort",
    direction: "higher",
    icon: "weather-partly-cloudy",
    description: "Comfortable weather and stable conditions win.",
  },
  {
    key: "crowd",
    label: "Crowd fit",
    category: "comfort",
    direction: "lower",
    icon: "account-group-outline",
    description: "Lower crowd pressure is better for calm trips.",
  },
  {
    key: "seasonality",
    label: "Season match",
    category: "experience",
    direction: "higher",
    icon: "calendar-star",
    description: "Better seasonal fit improves the experience.",
  },
  {
    key: "experience",
    label: "Experience",
    category: "experience",
    direction: "higher",
    icon: "star-four-points",
    description: "Higher ratings and richer destinations score better.",
  },
] as const;

const PRIORITY_WEIGHT_PRESETS: Record<
  ComparisonPreferences["priority"],
  Record<ComparisonFactorKey, number>
> = {
  balanced: {
    budget: 0.22,
    safety: 0.2,
    weather: 0.2,
    crowd: 0.12,
    seasonality: 0.13,
    experience: 0.13,
  },
  budget: {
    budget: 0.36,
    safety: 0.15,
    weather: 0.14,
    crowd: 0.1,
    seasonality: 0.12,
    experience: 0.13,
  },
  safety: {
    budget: 0.12,
    safety: 0.36,
    weather: 0.16,
    crowd: 0.1,
    seasonality: 0.12,
    experience: 0.14,
  },
  weather: {
    budget: 0.13,
    safety: 0.14,
    weather: 0.36,
    crowd: 0.1,
    seasonality: 0.15,
    experience: 0.12,
  },
  crowd: {
    budget: 0.15,
    safety: 0.16,
    weather: 0.13,
    crowd: 0.32,
    seasonality: 0.12,
    experience: 0.12,
  },
  experience: {
    budget: 0.12,
    safety: 0.12,
    weather: 0.15,
    crowd: 0.11,
    seasonality: 0.16,
    experience: 0.34,
  },
};

const currentSeason = (date = new Date()): string => {
  const month = date.getMonth();

  if (month >= 2 && month <= 5) return "summer";
  if (month >= 6 && month <= 8) return "monsoon";
  if (month >= 9 || month <= 0) return "winter";
  return "spring";
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const seasonAliases: Record<string, string[]> = {
  winter: ["winter", "cold", "snow", "cool"],
  summer: ["summer", "warm", "hot", "sunny"],
  monsoon: ["monsoon", "rain", "rainy", "wet"],
  spring: ["spring", "pleasant", "shoulder", "mild"],
};

const isSeasonMatch = (
  destinationSeason: string | undefined,
  season: string,
): boolean => {
  if (!destinationSeason) {
    return false;
  }

  const normalizedSeason = normalizeText(season);
  const normalizedDestinationSeason = normalizeText(destinationSeason);

  if (normalizedDestinationSeason.includes(normalizedSeason)) {
    return true;
  }

  const aliases = seasonAliases[normalizedSeason] ?? [];
  return aliases.some((alias) => normalizedDestinationSeason.includes(alias));
};

const average = (values: Array<number | null | undefined>): number | null => {
  const validValues = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  if (validValues.length === 0) {
    return null;
  }

  return (
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length
  );
};

const median = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
};

const minMax = (values: number[]): { min: number; max: number } | null => {
  if (values.length === 0) {
    return null;
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

const normalizeLinear = (
  value: number | null,
  range: { min: number; max: number } | null,
  direction: ComparisonFactorDirection,
): number => {
  if (value == null || !range) {
    return 0.5;
  }

  if (range.max === range.min) {
    return 0.5;
  }

  const normalized = (value - range.min) / (range.max - range.min);

  if (direction === "lower") {
    return 1 - normalized;
  }

  return normalized;
};

const normalizeCloser = (
  value: number | null,
  target: number | null,
  range: { min: number; max: number } | null,
): number => {
  if (value == null || target == null || !range) {
    return 0.5;
  }

  const maxDistance = Math.max(
    Math.abs(range.max - target),
    Math.abs(target - range.min),
  );
  if (maxDistance === 0) {
    return 0.5;
  }

  const distance = Math.abs(value - target);
  return clamp(1 - distance / maxDistance, 0, 1);
};

const countCompleteness = (metrics: ComparisonAggregateMetrics): number => {
  const possibleValues = 8;
  const availableValues = [
    metrics.budgetTotal,
    metrics.safetyScore,
    metrics.weatherTemperature,
    metrics.weatherFeelsLike,
    metrics.weatherHumidity,
    metrics.weatherWindSpeed,
    metrics.crowdIndex,
    metrics.experienceScore,
  ].filter((value) => typeof value === "number").length;

  return availableValues / possibleValues;
};

const budgetLevelScore = (level?: Destination["budgetLevel"]): number => {
  switch (level) {
    case "budget":
      return 1;
    case "mid-range":
      return 2;
    case "luxury":
      return 3;
    default:
      return 2;
  }
};

const estimateFallbackMetrics = (
  destination: Destination,
  selectionSize: number,
): ComparisonAggregateMetrics => {
  const popularity =
    typeof destination.popularity === "number" ? destination.popularity : null;
  const rating =
    typeof destination.rating === "number" ? destination.rating : null;
  const season = currentSeason();
  const seasonMatch = isSeasonMatch(destination.best_season, season) ? 1 : 0.6;

  const baseExperience = average([
    rating != null ? rating * 20 : null,
    popularity != null ? popularity : null,
    destination.category.length * 10,
  ]);

  return {
    budgetTotal: destination.priceRange
      ? (destination.priceRange.min + destination.priceRange.max) / 2
      : budgetLevelScore(destination.budgetLevel) *
        25000 *
        Math.max(selectionSize, 1),
    safetyScore: rating != null ? rating * 2 : null,
    weatherTemperature: null,
    weatherFeelsLike: null,
    weatherHumidity: null,
    weatherWindSpeed: null,
    crowdIndex: popularity,
    seasonalityScore: seasonMatch,
    experienceScore: baseExperience,
    dataCompleteness: rating == null && popularity == null ? 0.25 : 0.6,
    profileCount: 0,
  };
};

export const buildDestinationMetrics = (
  destination: Destination,
  profiles: CompareProfile[],
  selectionSize: number,
): ComparisonAggregateMetrics => {
  const weatherProfiles = profiles.filter((profile) => profile.weather != null);

  const budgetTotal = average(profiles.map((profile) => profile.budget.total));
  const safetyScore = average(
    profiles.map((profile) => profile.safety.overall_score),
  );
  const weatherTemperature = average(
    weatherProfiles.map((profile) => profile.weather?.temperature_c ?? null),
  );
  const weatherFeelsLike = average(
    weatherProfiles.map((profile) => profile.weather?.feels_like_c ?? null),
  );
  const weatherHumidity = average(
    weatherProfiles.map((profile) => profile.weather?.humidity ?? null),
  );
  const weatherWindSpeed = average(
    weatherProfiles.map((profile) => profile.weather?.wind_speed_kmh ?? null),
  );

  const fallbackMetrics = estimateFallbackMetrics(destination, selectionSize);
  const seasonalityScore = isSeasonMatch(
    destination.best_season,
    currentSeason(),
  )
    ? 1
    : fallbackMetrics.seasonalityScore;
  const experienceScore =
    average([
      destination.rating != null ? destination.rating * 20 : null,
      destination.popularity != null ? destination.popularity : null,
      destination.category.length * 10,
    ]) ?? fallbackMetrics.experienceScore;

  return {
    budgetTotal: budgetTotal ?? fallbackMetrics.budgetTotal,
    safetyScore: safetyScore ?? fallbackMetrics.safetyScore,
    weatherTemperature,
    weatherFeelsLike,
    weatherHumidity,
    weatherWindSpeed,
    crowdIndex: destination.popularity ?? fallbackMetrics.crowdIndex,
    seasonalityScore,
    experienceScore,
    dataCompleteness: Math.max(
      fallbackMetrics.dataCompleteness,
      countCompleteness({
        budgetTotal,
        safetyScore,
        weatherTemperature,
        weatherFeelsLike,
        weatherHumidity,
        weatherWindSpeed,
        crowdIndex: destination.popularity ?? null,
        seasonalityScore,
        experienceScore,
        dataCompleteness: 0,
        profileCount: profiles.length,
      }),
    ),
    profileCount: profiles.length,
  };
};

const getWeights = (
  preferences: ComparisonPreferences,
): Record<ComparisonFactorKey, number> => {
  const base = { ...PRIORITY_WEIGHT_PRESETS[preferences.priority] };

  if (preferences.familySize >= 5) {
    base.safety += 0.03;
    base.crowd += 0.03;
    base.experience -= 0.02;
  }

  if (preferences.days >= 7) {
    base.weather += 0.03;
    base.seasonality += 0.03;
  }

  const normalizedTravelClass = preferences.travelClass.toLowerCase();
  if (
    normalizedTravelClass.includes("business") ||
    normalizedTravelClass.includes("luxury")
  ) {
    base.experience += 0.03;
    base.budget -= 0.02;
  } else {
    base.budget += 0.02;
  }

  const total = Object.values(base).reduce((sum, weight) => sum + weight, 0);
  return Object.fromEntries(
    Object.entries(base).map(([key, weight]) => [key, weight / total]),
  ) as Record<ComparisonFactorKey, number>;
};

const buildFactorScore = (
  spec: ComparisonFactorSpec,
  rawValue: number | null,
  normalizedValue: number,
  weight: number,
  isWinner: boolean,
): ComparisonFactorScore => {
  switch (spec.key) {
    case "budget":
      return {
        key: spec.key,
        label: spec.label,
        category: spec.category,
        direction: spec.direction,
        rawValue,
        normalizedValue,
        weight,
        formattedValue: formatCurrency(rawValue),
        note: isWinner
          ? "Best value among the selected destinations."
          : "Higher overall trip cost.",
        isWinner,
      };
    case "safety":
      return {
        key: spec.key,
        label: spec.label,
        category: spec.category,
        direction: spec.direction,
        rawValue,
        normalizedValue,
        weight,
        formattedValue: formatScore(rawValue, 10),
        note: isWinner
          ? "Safest option in this set."
          : "Safer options exist in the comparison.",
        isWinner,
      };
    case "weather":
      return {
        key: spec.key,
        label: spec.label,
        category: spec.category,
        direction: spec.direction,
        rawValue,
        normalizedValue,
        weight,
        formattedValue: rawValue == null ? "N/A" : `${Math.round(rawValue)}°C`,
        note: isWinner
          ? "Weather comfort aligns best with current conditions."
          : "Weather is less aligned with the current trip window.",
        isWinner,
      };
    case "crowd":
      return {
        key: spec.key,
        label: spec.label,
        category: spec.category,
        direction: spec.direction,
        rawValue,
        normalizedValue,
        weight,
        formattedValue: formatCompactNumber(rawValue),
        note: isWinner
          ? "Lower crowd pressure and easier pacing."
          : "More crowded than the alternatives.",
        isWinner,
      };
    case "seasonality":
      return {
        key: spec.key,
        label: spec.label,
        category: spec.category,
        direction: spec.direction,
        rawValue,
        normalizedValue,
        weight,
        formattedValue: formatPercent(rawValue == null ? null : rawValue * 100),
        note: isWinner
          ? "Matches the current season well."
          : "Season fit is weaker than the leader.",
        isWinner,
      };
    case "experience":
    default:
      return {
        key: spec.key,
        label: spec.label,
        category: spec.category,
        direction: spec.direction,
        rawValue,
        normalizedValue,
        weight,
        formattedValue: formatScore(rawValue),
        note: isWinner
          ? "Richer destination experience and stronger destination signals."
          : "Experience score trails the winner.",
        isWinner,
      };
  }
};

const factorRawValue = (
  factor: ComparisonFactorKey,
  metrics: ComparisonAggregateMetrics,
): number | null => {
  switch (factor) {
    case "budget":
      return metrics.budgetTotal;
    case "safety":
      return metrics.safetyScore;
    case "weather": {
      const weatherValues = [
        metrics.weatherTemperature,
        metrics.weatherFeelsLike,
        metrics.weatherHumidity,
        metrics.weatherWindSpeed,
      ].filter((value): value is number => typeof value === "number");
      return average(weatherValues);
    }
    case "crowd":
      return metrics.crowdIndex;
    case "seasonality":
      return metrics.seasonalityScore == null
        ? null
        : metrics.seasonalityScore * 100;
    case "experience":
      return metrics.experienceScore;
    default:
      return null;
  }
};

const factorDirection = (
  factor: ComparisonFactorKey,
): ComparisonFactorDirection => {
  switch (factor) {
    case "budget":
    case "crowd":
      return "lower";
    case "weather":
      return "closer";
    case "safety":
    case "seasonality":
    case "experience":
    default:
      return "higher";
  }
};

export function analyzeComparison(input: {
  destinations: Destination[];
  profilesByDestination: Record<string, CompareProfile[]>;
  preferences: ComparisonPreferences;
  source: ComparisonDataSource;
  hasPartialData: boolean;
  lastUpdatedAt: number;
}): ComparisonAnalysis {
  const factorOrder: ComparisonFactorKey[] = [
    "budget",
    "safety",
    "weather",
    "crowd",
    "seasonality",
    "experience",
  ];
  const weights = getWeights(input.preferences);

  const candidates = input.destinations.map((destination) => {
    const profiles = input.profilesByDestination[destination.id] ?? [];
    const metrics = buildDestinationMetrics(
      destination,
      profiles,
      input.destinations.length,
    );
    return {
      destination,
      metrics,
      factorScores: [],
      totalScore: 0,
      rank: 0,
      confidence: 0,
      highlights: [],
    } satisfies ComparisonCandidateScore;
  });

  const factorRanges = factorOrder.reduce<
    Record<ComparisonFactorKey, { min: number; max: number } | null>
  >(
    (accumulator, factor) => {
      const rawValues = candidates
        .map((candidate) => factorRawValue(factor, candidate.metrics))
        .filter(
          (value): value is number =>
            typeof value === "number" && Number.isFinite(value),
        );

      accumulator[factor] = minMax(rawValues);
      return accumulator;
    },
    {
      budget: null,
      safety: null,
      weather: null,
      crowd: null,
      seasonality: null,
      experience: null,
    },
  );

  const weatherTemperatures = candidates
    .map((candidate) => candidate.metrics.weatherTemperature)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
  const weatherMedian = median(weatherTemperatures);

  const analysedCandidates = candidates.map((candidate) => {
    const factorScores = factorOrder.map((factor) => {
      const spec = comparisonFactorSpecs.find(
        (item) => item.key === factor,
      ) as ComparisonFactorSpec;
      const rawValue = factorRawValue(factor, candidate.metrics);
      const direction = factorDirection(factor);
      const range = factorRanges[factor];
      const normalizedValue =
        direction === "closer"
          ? normalizeCloser(rawValue, weatherMedian, range)
          : normalizeLinear(rawValue, range, direction);

      const dataCompletenessBoost =
        0.5 + candidate.metrics.dataCompleteness / 2;
      const contextualWeight = weights[factor] * dataCompletenessBoost;

      return buildFactorScore(
        spec,
        rawValue,
        normalizedValue,
        contextualWeight,
        false,
      );
    });

    const totalScore =
      factorScores.reduce(
        (sum, factor) => sum + factor.normalizedValue * factor.weight,
        0,
      ) * 100;
    const confidence = clamp(
      candidate.metrics.dataCompleteness * 0.55 + totalScore / 220,
      0.35,
      0.98,
    );

    return {
      ...candidate,
      factorScores,
      totalScore,
      confidence,
    };
  });

  const rankedCandidates = [...analysedCandidates].sort(
    (left, right) => right.totalScore - left.totalScore,
  );
  const winner = rankedCandidates[0] ?? null;
  const runnerUp = rankedCandidates[1] ?? null;

  const winnerFactorScores = winner
    ? winner.factorScores.map((score) => ({ ...score, isWinner: true }))
    : [];

  const maxScoresByFactor = factorOrder.reduce<
    Record<ComparisonFactorKey, string>
  >(
    (accumulator, factor) => {
      const topCandidate = rankedCandidates[0];
      const bestScore = topCandidate?.factorScores.find(
        (score) => score.key === factor,
      );
      accumulator[factor] = bestScore ? bestScore.formattedValue : "N/A";
      return accumulator;
    },
    {
      budget: "N/A",
      safety: "N/A",
      weather: "N/A",
      crowd: "N/A",
      seasonality: "N/A",
      experience: "N/A",
    },
  );

  const finalCandidates = rankedCandidates.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    factorScores: candidate.factorScores.map((score) => ({
      ...score,
      isWinner: winner?.destination.id === candidate.destination.id,
    })),
    highlights: candidate.factorScores
      .filter((score) => score.normalizedValue >= 0.7)
      .slice(0, 3)
      .map((score) => score.note),
  }));

  const winnerRanked = finalCandidates[0] ?? null;
  const reasoning = buildWinnerReasoning(
    finalCandidates,
    factorOrder,
    maxScoresByFactor,
  );
  const insights = buildComparisonInsights(finalCandidates, factorOrder);
  const confidence = winnerRanked
    ? clamp(
        winnerRanked.confidence * 0.6 +
          (winnerRanked.totalScore - (runnerUp?.totalScore ?? 0)) / 150,
        0,
        0.99,
      )
    : 0;

  const summary = {
    selectedCount: input.destinations.length,
    source: input.source,
    hasPartialData: input.hasPartialData,
    winnerLabel: winnerRanked?.destination.label ?? "No winner",
    winningScore: winnerRanked?.totalScore ?? 0,
    confidence,
    explanation: reasoning,
  };

  return {
    candidates: finalCandidates,
    winner: winnerRanked,
    insights,
    reasoning,
    confidence,
    source: input.source,
    hasPartialData: input.hasPartialData,
    lastUpdatedAt: input.lastUpdatedAt,
    factorOrder,
    summary,
  };
}

export const getFactorSpec = (
  factor: ComparisonFactorKey,
): ComparisonFactorSpec => {
  const spec = comparisonFactorSpecs.find((item) => item.key === factor);

  if (!spec) {
    throw new Error(`Missing factor spec for ${factor}`);
  }

  return spec;
};
