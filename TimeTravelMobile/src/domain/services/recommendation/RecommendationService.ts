/**
 * RecommendationService - Domain Service
 * 
 * Orchestrates destination recommendations using the scoring engine.
 * NO UI LOGIC - Pure business rules.
 */
import { Destination, DestinationFilter } from '../../models/Destination';
import { UserPreferences } from '../../models/UserPreferences';
import { DestinationScorer, ScoringContext, ScoreBreakdown } from './DestinationScorer';
import { getDestinationMetadata } from '../../constants/DestinationTags';

export interface RecommendationOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly minScore?: number;
  readonly includeBreakdown?: boolean;
}

export interface ScoredDestination {
  readonly destination: Destination;
  readonly score: number;
  readonly breakdown?: ScoreBreakdown;
}

export class RecommendationService {
  constructor(private readonly scorer: DestinationScorer) {}

  getRecommendations(
    destinations: readonly Destination[],
    preferences: UserPreferences,
    context: ScoringContext = {},
    options: RecommendationOptions = {}
  ): readonly Destination[] {
    const { limit = 10, offset = 0, minScore = 30 } = options;

    const scored = this.scoreAll(destinations, preferences, context);
    const filtered = scored
      .filter(s => s.score >= minScore)
      .sort((a, b) => b.score - a.score);

    return filtered.slice(offset, offset + limit).map(s => s.destination);
  }

  getTrending(destinations: readonly Destination[], limit: number = 6): readonly Destination[] {
    return [...destinations]
      .filter(d => (d.bookingCount ?? 0) >= 50)
      .sort((a, b) => (b.bookingCount ?? 0) - (a.bookingCount ?? 0))
      .slice(0, limit);
  }

  getBudgetFriendly(
    destinations: readonly Destination[],
    maxBudget: number,
    limit: number = 6
  ): readonly Destination[] {
    return [...destinations]
      .filter(d => (d.avgCost ?? Infinity) <= maxBudget)
      .sort((a, b) => (a.avgCost ?? 0) - (b.avgCost ?? 0))
      .slice(0, limit);
  }

  getSeasonalDestinations(
    destinations: readonly Destination[],
    month: string,
    limit: number = 6
  ): readonly Destination[] {
    const normalizedMonth = month.toLowerCase();
    
    return destinations
      .filter(dest => {
        const meta = getDestinationMetadata(dest.id);
        return meta?.bestMonths.some(m => m.toLowerCase() === normalizedMonth);
      })
      .slice(0, limit);
  }

  filter(
    destinations: readonly Destination[],
    filter: DestinationFilter
  ): readonly Destination[] {
    return destinations.filter(dest => {
      if (filter.regions?.length) {
        if (!filter.regions.some(r => dest.region.toLowerCase() === r.toLowerCase())) {
          return false;
        }
      }

      if (filter.categories?.length) {
        const destCats = dest.category ?? [];
        if (!filter.categories.some(c => destCats.some(dc => dc.toLowerCase() === c.toLowerCase()))) {
          return false;
        }
      }

      if (filter.maxBudget !== undefined && dest.avgCost !== undefined) {
        if (dest.avgCost > filter.maxBudget) return false;
      }

      if (filter.minRating !== undefined && dest.rating !== undefined) {
        if (dest.rating < filter.minRating) return false;
      }

      return true;
    });
  }

  explainRecommendation(
    destination: Destination,
    preferences: UserPreferences,
    context: ScoringContext
  ): string[] {
    const breakdown = this.scorer.getScoreBreakdown(destination, preferences, context);
    const reasons: string[] = [];

    if (breakdown.preferenceMatch >= 80) reasons.push('Perfect match for your travel style');
    else if (breakdown.preferenceMatch >= 60) reasons.push('Matches your preferences');

    if (breakdown.popularity >= 80) reasons.push('Popular destination');
    if (breakdown.seasonality >= 90) reasons.push('Ideal time to visit');
    if (breakdown.budgetFit >= 80) reasons.push('Within your budget');
    if (breakdown.socialProof >= 80) reasons.push('Highly rated by travelers');

    return reasons.length > 0 ? reasons : ['Recommended for you'];
  }

  private scoreAll(
    destinations: readonly Destination[],
    preferences: UserPreferences,
    context: ScoringContext,
    includeBreakdown: boolean = false
  ): ScoredDestination[] {
    return destinations.map(dest => {
      const score = this.scorer.scoreDestination(dest, preferences, context);
      const breakdown = includeBreakdown
        ? this.scorer.getScoreBreakdown(dest, preferences, context)
        : undefined;

      return { destination: dest, score, breakdown };
    });
  }
}

export function createRecommendationService(
  scorer: DestinationScorer = new DestinationScorer()
): RecommendationService {
  return new RecommendationService(scorer);
}