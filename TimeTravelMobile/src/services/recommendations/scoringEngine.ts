/**
 * Scoring Engine
 * ==============
 * DETERMINISTIC scoring - same inputs ALWAYS produce same outputs.
 * NO RANDOMNESS - all calculations are mathematically determined.
 */

import {
  ScoringWeights,
  FeatureVector,
  ScoreBreakdown,
  RecommendationFeatures,
  DEFAULT_SCORING_WEIGHTS,
} from '../../types/recommendations';

/**
 * Scoring Engine
 * 
 * DETERMINISTIC: Same inputs ALWAYS produce same outputs
 * NO RANDOMNESS: All calculations are mathematically determined
 * EXPLAINABLE: Every score can be broken down into factors
 */
export class ScoringEngine {
  private weights: ScoringWeights;

  constructor(weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS) {
    this.weights = this.validateWeights(weights);
  }

  /**
   * Validate that weights sum to 1.0
   */
  private validateWeights(weights: ScoringWeights): ScoringWeights {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      console.warn(`Weights sum to ${sum}, normalizing to 1.0`);
      const normalized: ScoringWeights = {} as ScoringWeights;
      for (const [key, value] of Object.entries(weights)) {
        (normalized as any)[key] = value / sum;
      }
      return normalized;
    }
    return weights;
  }

  /**
   * Calculate final score (0-100)
   * 
   * Formula: score = Σ(feature_i × weight_i) × 100
   */
  calculateScore(featureVector: FeatureVector): number {
    const features = featureVector.features;

    // Weighted sum (deterministic)
    const rawScore =
      features.preferenceMatch * this.weights.preferenceMatch +
      features.budgetFit * this.weights.budgetFit +
      features.seasonality * this.weights.seasonality +
      features.popularity * this.weights.popularity +
      features.quality * this.weights.quality +
      features.distance * this.weights.distance +
      features.trending * this.weights.trending +
      features.socialProof * this.weights.socialProof +
      features.recency * this.weights.recency;

    // Convert to 0-100 scale
    const score = Math.round(rawScore * 100 * 10) / 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get detailed score breakdown for explainability
   */
  getScoreBreakdown(featureVector: FeatureVector): ScoreBreakdown {
    const features = featureVector.features;
    const total = this.calculateScore(featureVector);

    return {
      total,
      components: {
        preferenceMatch: {
          score: Math.round(features.preferenceMatch * 100),
          weight: this.weights.preferenceMatch,
          contribution: Math.round(features.preferenceMatch * this.weights.preferenceMatch * 100),
          label: 'Preference Match',
          description: featureVector.rawValues.preferenceMatches.join(', ') || 'Based on your travel style',
        },
        budgetFit: {
          score: Math.round(features.budgetFit * 100),
          weight: this.weights.budgetFit,
          contribution: Math.round(features.budgetFit * this.weights.budgetFit * 100),
          label: 'Budget Fit',
          description:
            featureVector.rawValues.budgetDelta > 0
              ? `$${featureVector.rawValues.budgetDelta} over your budget`
              : featureVector.rawValues.budgetDelta < 0
                ? 'Under your budget'
                : 'Within your budget',
        },
        seasonality: {
          score: Math.round(features.seasonality * 100),
          weight: this.weights.seasonality,
          contribution: Math.round(features.seasonality * this.weights.seasonality * 100),
          label: 'Seasonal',
          description: featureVector.rawValues.seasonalFactors.join(', ') || 'Good for your travel dates',
        },
        popularity: {
          score: Math.round(features.popularity * 100),
          weight: this.weights.popularity,
          contribution: Math.round(features.popularity * this.weights.popularity * 100),
          label: 'Popularity',
          description: 'Based on bookings and ratings',
        },
        quality: {
          score: Math.round(features.quality * 100),
          weight: this.weights.quality,
          contribution: Math.round(features.quality * this.weights.quality * 100),
          label: 'Quality',
          description: featureVector.rawValues.qualityFactors.join(', ') || 'Safety and infrastructure',
        },
        distance: {
          score: Math.round(features.distance * 100),
          weight: this.weights.distance,
          contribution: Math.round(features.distance * this.weights.distance * 100),
          label: 'Distance',
          description: 'Proximity to your location',
        },
        trending: {
          score: Math.round(features.trending * 100),
          weight: this.weights.trending,
          contribution: Math.round(features.trending * this.weights.trending * 100),
          label: 'Trending',
          description: 'Recent popularity growth',
        },
        socialProof: {
          score: Math.round(features.socialProof * 100),
          weight: this.weights.socialProof,
          contribution: Math.round(features.socialProof * this.weights.socialProof * 100),
          label: 'Social Proof',
          description: 'Reviews and ratings',
        },
        recency: {
          score: Math.round(features.recency * 100),
          weight: this.weights.recency,
          contribution: Math.round(features.recency * this.weights.recency * 100),
          label: 'Updated',
          description: 'Recently updated information',
        },
        diversity: {
          score: Math.round(features.diversity * 100),
          weight: 0,
          contribution: 0,
          label: 'Diversity',
          description: 'Variety in recommendations',
        },
      },
    };
  }

  /**
   * Update weights (for A/B testing)
   */
  updateWeights(newWeights: Partial<ScoringWeights>): void {
    this.weights = this.validateWeights({
      ...this.weights,
      ...newWeights,
    });
  }

  /**
   * Get current weights
   */
  getWeights(): ScoringWeights {
    return { ...this.weights };
  }
}

// Singleton instance
export const scoringEngine = new ScoringEngine();