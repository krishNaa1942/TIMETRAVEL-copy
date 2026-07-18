/**
 * DestinationScorer - Pure Domain Service
 * 
 * Implements multi-factor scoring algorithm for destinations.
 * COMPLETELY DETERMINISTIC - same inputs always produce same outputs.
 */
import { Destination } from '../../models/Destination';
import { UserPreferences, TravelStyle } from '../../models/UserPreferences';
import { getDestinationMetadata } from '../../constants/DestinationTags';

export interface ScoringWeights {
  readonly preferenceMatch: number;
  readonly popularity: number;
  readonly seasonality: number;
  readonly budgetFit: number;
  readonly socialProof: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  preferenceMatch: 0.35,
  popularity: 0.20,
  seasonality: 0.15,
  budgetFit: 0.20,
  socialProof: 0.10,
} as const;

export interface ScoringContext {
  readonly currentMonth?: string;
  readonly budgetRange?: readonly [number, number];
}

export interface ScoreBreakdown {
  readonly total: number;
  readonly preferenceMatch: number;
  readonly popularity: number;
  readonly seasonality: number;
  readonly budgetFit: number;
  readonly socialProof: number;
}

// Deterministic hash function for stable "random" values
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export class DestinationScorer {
  private readonly weights: ScoringWeights;

  constructor(weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS) {
    this.weights = weights;
  }

  scoreDestination(
    destination: Destination,
    preferences: UserPreferences,
    context: ScoringContext = {}
  ): number {
    const breakdown = this.getScoreBreakdown(destination, preferences, context);
    return breakdown.total;
  }

  getScoreBreakdown(
    destination: Destination,
    preferences: UserPreferences,
    context: ScoringContext
  ): ScoreBreakdown {
    const preferenceScore = this.calculatePreferenceMatch(destination, preferences);
    const popularityScore = this.calculatePopularity(destination);
    const seasonalityScore = this.calculateSeasonality(destination, context.currentMonth);
    const budgetScore = this.calculateBudgetFit(destination, context.budgetRange);
    const socialScore = this.calculateSocialProof(destination);

    const total = Math.round(
      preferenceScore * this.weights.preferenceMatch * 100 +
      popularityScore * this.weights.popularity * 100 +
      seasonalityScore * this.weights.seasonality * 100 +
      budgetScore * this.weights.budgetFit * 100 +
      socialScore * this.weights.socialProof * 100
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      preferenceMatch: Math.round(preferenceScore * 100),
      popularity: Math.round(popularityScore * 100),
      seasonality: Math.round(seasonalityScore * 100),
      budgetFit: Math.round(budgetScore * 100),
      socialProof: Math.round(socialScore * 100),
    };
  }

  private calculatePreferenceMatch(
    destination: Destination,
    preferences: UserPreferences
  ): number {
    const metadata = getDestinationMetadata(destination.id);
    
    if (preferences.travelStyles.length === 0) {
      return 0.5;
    }

    if (!metadata) {
      return this.fallbackPreferenceMatch(destination, preferences);
    }

    const destinationTags = metadata.tags;
    const userStyles = preferences.travelStyles;
    
    const matchingTags = destinationTags.filter(tag => 
      userStyles.includes(tag as TravelStyle)
    );

    const union = new Set([...destinationTags, ...userStyles]);
    const intersection = matchingTags.length;
    
    return intersection / Math.max(union.size, 1);
  }

  private fallbackPreferenceMatch(
    destination: Destination,
    preferences: UserPreferences
  ): number {
    if (!destination.category || destination.category.length === 0) {
      return 0.5;
    }

    const matching = destination.category.filter(cat =>
      preferences.travelStyles.some(style => 
        cat.toLowerCase().includes(style.toLowerCase())
      )
    );

    return matching.length / destination.category.length;
  }

  private calculatePopularity(destination: Destination): number {
    if (destination.bookingCount !== undefined) {
      return Math.min(1, destination.bookingCount / 1000);
    }

    if (destination.rating !== undefined) {
      return destination.rating / 5;
    }

    // Deterministic fallback based on ID
    const hash = hashString(destination.id);
    return 0.3 + (hash % 70) / 100; // 0.30 - 0.99
  }

  private calculateSeasonality(
    destination: Destination,
    currentMonth?: string
  ): number {
    if (!currentMonth) {
      return 0.7;
    }

    const metadata = getDestinationMetadata(destination.id);
    
    if (!metadata || metadata.bestMonths.length === 0) {
      if (destination.bestSeason) {
        return destination.bestSeason.toLowerCase().includes(currentMonth.toLowerCase()) 
          ? 1.0 
          : 0.5;
      }
      return 0.7;
    }

    return metadata.bestMonths.some(m => 
      m.toLowerCase() === currentMonth.toLowerCase()
    ) ? 1.0 : 0.5;
  }

  private calculateBudgetFit(
    destination: Destination,
    budgetRange?: readonly [number, number]
  ): number {
    if (!budgetRange || destination.avgCost === undefined) {
      return 0.7;
    }

    const [min, max] = budgetRange;
    const cost = destination.avgCost;

    if (cost >= min && cost <= max) {
      return 1.0;
    }

    if (cost < min) {
      return 0.8;
    }

    const overage = (cost - max) / max;
    return Math.max(0, 1 - overage);
  }

  private calculateSocialProof(destination: Destination): number {
    if (destination.rating === undefined) {
      // Deterministic fallback
      const hash = hashString(destination.id + '_rating');
      return 0.5 + (hash % 50) / 100; // 0.50 - 0.99
    }

    if (destination.rating >= 4.5) return 1.0;
    if (destination.rating >= 4.0) return 0.85;
    if (destination.rating >= 3.5) return 0.7;
    if (destination.rating >= 3.0) return 0.5;
    return Math.max(0.2, destination.rating / 5);
  }
}

export const defaultScorer = new DestinationScorer();