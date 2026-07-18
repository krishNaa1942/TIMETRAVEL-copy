/**
 * Ranking Engine
 * ==============
 * Handles scoring, diversity injection, tie-breaking, and filtering.
 */

import {
  DestinationFeatures,
  FeatureVector,
  ScoreBreakdown,
  RankedDestination,
} from '../../types/recommendations';
import { ScoringEngine, scoringEngine } from './scoringEngine';
import { FeatureEngineer } from './featureEngineer';
import { UserProfile, UserContext } from '../../types/recommendations';

export interface RankingConfig {
  enableDiversity: boolean;
  diversityThreshold: number;
  maxSameCategory: number;
  minScoreThreshold: number;
}

const DEFAULT_RANKING_CONFIG: RankingConfig = {
  enableDiversity: true,
  diversityThreshold: 0.1,
  maxSameCategory: 2,
  minScoreThreshold: 40,
};

/**
 * Ranking Engine
 * 
 * Process:
 * 1. Initial scoring
 * 2. Diversity injection
 * 3. Tie-breaking
 * 4. Filtering
 */
export class RankingEngine {
  private scoringEngine: ScoringEngine;
  private config: RankingConfig;

  constructor(
    engine: ScoringEngine = scoringEngine,
    config: RankingConfig = DEFAULT_RANKING_CONFIG
  ) {
    this.scoringEngine = engine;
    this.config = config;
  }

  /**
   * Rank destinations
   */
  rank(
    destinations: DestinationFeatures[],
    user: UserProfile,
    context: UserContext
  ): RankedDestination[] {
    // 1. Score all destinations
    let scored = destinations.map((destination) => {
      const featureVector = FeatureEngineer.generateFeatureVector(destination, user, context);
      const score = this.scoringEngine.calculateScore(featureVector);
      const scoreBreakdown = this.scoringEngine.getScoreBreakdown(featureVector);
      return { destination, featureVector, score, scoreBreakdown };
    });

    // 2. Filter by minimum threshold
    scored = scored.filter((s) => s.score >= this.config.minScoreThreshold);

    // 3. Sort by score (descending), tie-breaker: quality
    scored.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) < 1) {
        return b.featureVector.features.quality - a.featureVector.features.quality;
      }
      return scoreDiff;
    });

    // 4. Apply diversity
    if (this.config.enableDiversity) {
      scored = this.applyDiversity(scored);
    }

    // 5. Generate explanations and assign ranks
    return scored.map((s, index) => ({
      id: s.destination.id,
      destination: s.destination,
      score: s.score,
      scoreBreakdown: s.scoreBreakdown,
      rank: index + 1,
      explanations: this.generateExplanations(s.scoreBreakdown, s.featureVector),
      tags: this.generateTags(s.destination, s.featureVector),
      featureVector: s.featureVector,
    }));
  }

  /**
   * Apply diversity to prevent same-type clustering
   */
  private applyDiversity(
    scored: Array<{
      destination: DestinationFeatures;
      featureVector: FeatureVector;
      score: number;
      scoreBreakdown: ScoreBreakdown;
    }>
  ): typeof scored {
    if (scored.length === 0) return scored;

    const result: typeof scored = [];
    const remaining = [...scored];
    let lastCategory: string | null = null;
    let consecutiveCount = 0;

    while (remaining.length > 0) {
      let bestIndex = -1;
      let bestScore = -1;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const primaryCategory = item.destination.categories[0] || 'other';

        const isSameAsLast = primaryCategory === lastCategory;
        const wouldViolateConstraint =
          isSameAsLast && consecutiveCount >= this.config.maxSameCategory;

        if (!wouldViolateConstraint && item.score > bestScore) {
          bestIndex = i;
          bestScore = item.score;
        }
      }

      if (bestIndex === -1) {
        bestIndex = 0;
        consecutiveCount = 0;
      }

      const selected = remaining.splice(bestIndex, 1)[0];
      const primaryCategory = selected.destination.categories[0] || 'other';

      if (primaryCategory === lastCategory) {
        consecutiveCount++;
      } else {
        consecutiveCount = 1;
        lastCategory = primaryCategory;
      }

      result.push(selected);
    }

    return result;
  }

  /**
   * Generate human-readable explanations
   */
  private generateExplanations(
    breakdown: ScoreBreakdown,
    featureVector: FeatureVector
  ): string[] {
    const explanations: string[] = [];
    const components = breakdown.components;

    const sortedComponents = Object.entries(components).sort(
      (a, b) => b[1].contribution - a[1].contribution
    );

    for (const [_, value] of sortedComponents.slice(0, 3)) {
      if (value.contribution > 5) {
        explanations.push(value.description);
      }
    }

    if (featureVector.rawValues.preferenceMatches.length > 0) {
      explanations.push(...featureVector.rawValues.preferenceMatches.slice(0, 2));
    }

    return [...new Set(explanations)].slice(0, 4);
  }

  /**
   * Generate tags for UI
   */
  private generateTags(
    destination: DestinationFeatures,
    featureVector: FeatureVector
  ): string[] {
    const tags: string[] = [];

    if (destination.rating >= 4.5) tags.push('Top Rated');
    if (featureVector.features.trending > 0.7) tags.push('Trending');
    if (featureVector.features.budgetFit > 0.8) tags.push('Budget Friendly');
    if (featureVector.features.quality > 0.85) tags.push('High Quality');

    if (destination.categories.length > 0) {
      tags.push(destination.categories[0].charAt(0).toUpperCase() + destination.categories[0].slice(1));
    }

    return tags.slice(0, 3);
  }
}

// Singleton instance
export const rankingEngine = new RankingEngine();