import type {
  ComparisonCandidateScore,
  ComparisonFactorKey,
  ComparisonInsight,
} from "../types";
import {
  formatCurrency,
  formatDelta,
  formatPercent,
  formatSignedPercent,
  formatTemperature,
  getCategoryLabel,
} from "../utils/formatters";

const buildInsightId = (
  prefix: string,
  winnerId: string,
  runnerUpId: string,
): string => `${prefix}-${winnerId}-${runnerUpId}`;

const getRunnerUp = (
  candidates: ComparisonCandidateScore[],
): ComparisonCandidateScore | null => candidates[1] ?? null;

const getFactorScore = (
  candidate: ComparisonCandidateScore,
  factor: ComparisonFactorKey,
) => candidate.factorScores.find((score) => score.key === factor);

const createInsight = (
  category: ComparisonInsight["category"],
  title: string,
  description: string,
  deltaLabel: string,
  tone: ComparisonInsight["tone"],
  icon: string,
  winnerDestinationId?: string,
  runnerUpDestinationId?: string,
): ComparisonInsight => ({
  id: buildInsightId(
    category,
    winnerDestinationId ?? "winner",
    runnerUpDestinationId ?? "runner",
  ),
  category,
  title,
  description,
  deltaLabel,
  tone,
  icon,
  winnerDestinationId,
  runnerUpDestinationId,
});

export const buildComparisonInsights = (
  candidates: ComparisonCandidateScore[],
  factorOrder: ComparisonFactorKey[],
): ComparisonInsight[] => {
  const winner = candidates[0];
  const runnerUp = getRunnerUp(candidates);

  if (!winner || !runnerUp) {
    return [];
  }

  const insights: ComparisonInsight[] = [];

  const budgetWinner = getFactorScore(winner, "budget");
  const budgetRunner = getFactorScore(runnerUp, "budget");
  if (
    budgetWinner?.rawValue != null &&
    budgetRunner?.rawValue != null &&
    budgetRunner.rawValue > 0
  ) {
    const savings = budgetRunner.rawValue - budgetWinner.rawValue;
    const savingsPercent = (savings / budgetRunner.rawValue) * 100;

    if (savings > 0) {
      insights.push(
        createInsight(
          "cost",
          `${winner.destination.label} is ${Math.round(savingsPercent)}% cheaper`,
          `${winner.destination.label} saves ${formatCurrency(savings)} compared with ${runnerUp.destination.label}, which makes it the stronger value pick for budget-sensitive trips.`,
          `${formatCurrency(savings)} saved`,
          "success",
          "cash-multiple",
          winner.destination.id,
          runnerUp.destination.id,
        ),
      );
    }
  }

  const safetyWinner = getFactorScore(winner, "safety");
  const safetyRunner = getFactorScore(runnerUp, "safety");
  if (safetyWinner?.rawValue != null && safetyRunner?.rawValue != null) {
    const safetyGap = safetyWinner.rawValue - safetyRunner.rawValue;

    if (Math.abs(safetyGap) >= 0.6) {
      const saferDestination = safetyGap >= 0 ? winner : runnerUp;
      const otherDestination = safetyGap >= 0 ? runnerUp : winner;

      insights.push(
        createInsight(
          "risk",
          `${saferDestination.destination.label} is safer`,
          `${saferDestination.destination.label} leads on safety by ${Math.abs(safetyGap).toFixed(1)} points over ${otherDestination.destination.label}, making it the lower-risk choice for this trip.`,
          `${Math.abs(safetyGap).toFixed(1)} safety points`,
          safetyGap >= 0 ? "success" : "danger",
          "shield-check",
          saferDestination.destination.id,
          otherDestination.destination.id,
        ),
      );
    }
  }

  const weatherWinner = getFactorScore(winner, "weather");
  const weatherRunner = getFactorScore(runnerUp, "weather");
  if (weatherWinner?.rawValue != null && weatherRunner?.rawValue != null) {
    const weatherGap = Math.abs(
      weatherWinner.rawValue - weatherRunner.rawValue,
    );
    if (weatherGap >= 1) {
      const warmer =
        weatherWinner.rawValue >= weatherRunner.rawValue ? winner : runnerUp;
      const cooler = warmer === winner ? runnerUp : winner;

      insights.push(
        createInsight(
          "comfort",
          `${warmer.destination.label} offers better weather comfort`,
          `${warmer.destination.label} is ${formatTemperature(weatherGap)} more comfortable than ${cooler.destination.label} based on the current temperature and forecast blend.`,
          `${formatTemperature(weatherGap)} edge`,
          "warning",
          "weather-partly-cloudy",
          warmer.destination.id,
          cooler.destination.id,
        ),
      );
    }
  }

  const crowdWinner = getFactorScore(winner, "crowd");
  const crowdRunner = getFactorScore(runnerUp, "crowd");
  if (crowdWinner?.rawValue != null && crowdRunner?.rawValue != null) {
    const crowdGap = crowdRunner.rawValue - crowdWinner.rawValue;
    if (crowdGap > 0) {
      insights.push(
        createInsight(
          "comfort",
          `${winner.destination.label} feels less crowded`,
          `${winner.destination.label} has a lighter crowd profile by ${formatPercent(crowdGap)} compared with ${runnerUp.destination.label}, which usually means easier movement and a calmer trip.`,
          `${formatPercent(crowdGap)} lighter crowd`,
          "info",
          "account-group-outline",
          winner.destination.id,
          runnerUp.destination.id,
        ),
      );
    }
  }

  const experienceWinner = getFactorScore(winner, "experience");
  const experienceRunner = getFactorScore(runnerUp, "experience");
  if (
    experienceWinner?.rawValue != null &&
    experienceRunner?.rawValue != null
  ) {
    const experienceGap = experienceWinner.rawValue - experienceRunner.rawValue;
    if (experienceGap >= 5) {
      insights.push(
        createInsight(
          "experience",
          `${winner.destination.label} delivers a richer experience`,
          `${winner.destination.label} leads on destination richness and travel appeal by ${formatPercent(experienceGap)} against ${runnerUp.destination.label}.`,
          `${formatPercent(experienceGap)} richer`,
          "success",
          "star-four-points",
          winner.destination.id,
          runnerUp.destination.id,
        ),
      );
    }
  }

  if (insights.length === 0) {
    insights.push(
      createInsight(
        "experience",
        `${winner.destination.label} is the strongest overall fit`,
        `${winner.destination.label} has the best combined score across ${factorOrder.length} decision factors, with no single trade-off strong enough to outweigh its lead.`,
        "Balanced lead",
        "info",
        "sparkles",
        winner.destination.id,
        runnerUp.destination.id,
      ),
    );
  }

  return insights;
};

export const buildWinnerReasoning = (
  candidates: ComparisonCandidateScore[],
  factorOrder: ComparisonFactorKey[],
  factorValues: Record<ComparisonFactorKey, string>,
): string => {
  const winner = candidates[0];
  const runnerUp = candidates[1];

  if (!winner || !runnerUp) {
    return "Not enough destinations were selected to determine a winner.";
  }

  const leaderFactors = winner.factorScores
    .slice()
    .sort((left, right) => right.normalizedValue - left.normalizedValue)
    .slice(0, 2)
    .map((score) => score.label);

  const runnerUpFactors = runnerUp.factorScores
    .slice()
    .sort((left, right) => right.normalizedValue - left.normalizedValue)
    .slice(0, 1)
    .map((score) => score.label);

  const topFactorsText = leaderFactors.join(" and ");
  const tradeOffText =
    runnerUpFactors.length > 0 ? runnerUpFactors[0] : factorOrder[0];
  const categoryText =
    factorValues.budget !== "N/A"
      ? `The strongest visible advantage is ${topFactorsText.toLowerCase()}`
      : "The strongest visible advantage is the combined score";

  return `${winner.destination.label} wins because it leads on ${topFactorsText.toLowerCase()} while keeping the trade-off against ${runnerUp.destination.label} manageable. ${categoryText}; ${runnerUp.destination.label} only pulls ahead on ${tradeOffText.toLowerCase()} in a narrow pocket of the analysis.`;
};
