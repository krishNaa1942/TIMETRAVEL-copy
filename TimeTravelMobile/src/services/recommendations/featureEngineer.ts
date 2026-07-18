/**
 * Feature Engineering Service
 * ===========================
 * Converts raw data into normalized scoring features.
 * 
 * CRITICAL: All features MUST be normalized to 0-1 range
 * CRITICAL: NO RANDOMNESS - deterministic calculations only
 */

import {
  TravelStyle,
  UserProfile,
  UserContext,
  DestinationFeatures,
  RecommendationFeatures,
  FeatureVector,
} from '../../types/recommendations';

/**
 * Feature Engineering Service
 * 
 * All methods are DETERMINISTIC - same inputs always produce same outputs.
 */
export class FeatureEngineer {
  
  // ─────────────────────────────────────────────────────────────
  // NORMALIZATION FUNCTIONS (DETERMINISTIC)
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Normalize value to 0-1 range using min-max scaling
   */
  private static normalizeMinMax(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    const normalized = (value - min) / (max - min);
    return Math.max(0, Math.min(1, normalized));
  }
  
  /**
   * Normalize value using sigmoid (handles outliers better)
   */
  private static normalizeSigmoid(value: number, midpoint: number, steepness: number = 1): number {
    return 1 / (1 + Math.exp(-steepness * (value - midpoint)));
  }
  
  /**
   * Normalize rating to 0-1 (assumes 0-5 scale)
   */
  private static normalizeRating(rating: number): number {
    return Math.max(0, Math.min(1, rating / 5));
  }
  
  // ─────────────────────────────────────────────────────────────
  // PREFERENCE MATCH CALCULATION (DETERMINISTIC)
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Calculate preference match score
   * 
   * Formula:
   *   styleMatch = weighted average of style affinities
   *   activityMatch = Jaccard similarity of activities
   *   regionMatch = region affinity if exists
   */
  static calculatePreferenceMatch(
    destination: DestinationFeatures,
    user: UserProfile,
    _context: UserContext
  ): { score: number; matches: string[] } {
    const matches: string[] = [];
    let totalScore = 0;
    let totalWeight = 0;
    
    // 1. Travel Style Match (Weight: 0.5)
    const styleScore = this.calculateStyleMatch(
      destination.categories,
      user.implicitPreferences.inferredStyles,
      user.preferenceWeights.travelStyleAffinity
    );
    if (styleScore > 0.5 && destination.categories.length > 0) {
      matches.push(`Matches your ${destination.categories.slice(0, 2).join(' & ')} interests`);
    }
    totalScore += styleScore * 0.5;
    totalWeight += 0.5;
    
    // 2. Activity Match (Weight: 0.3)
    const activityScore = this.calculateActivityMatch(
      destination.activities,
      user.implicitPreferences.activityAffinity
    );
    if (activityScore > 0.6) {
      const matchingActivities = this.getMatchingActivities(
        destination.activities,
        user.implicitPreferences.activityAffinity
      );
      if (matchingActivities.length > 0) {
        matches.push(`Features ${matchingActivities.slice(0, 2).join(', ')} activities`);
      }
    }
    totalScore += activityScore * 0.3;
    totalWeight += 0.3;
    
    // 3. Region Match (Weight: 0.2)
    const regionScore = user.implicitPreferences.regionAffinity[destination.region] ?? 0.5;
    if (regionScore > 0.6) {
      matches.push('Popular with travelers who share your interests');
    }
    totalScore += regionScore * 0.2;
    totalWeight += 0.2;
    
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0.5;
    
    return {
      score: Math.round(finalScore * 1000) / 1000,
      matches: matches.slice(0, 3),
    };
  }
  
  private static calculateStyleMatch(
    destCategories: TravelStyle[],
    userStyles: TravelStyle[],
    styleAffinity: Record<TravelStyle, number>
  ): number {
    if (destCategories.length === 0) return 0.5;
    
    let matchScore = 0;
    for (const category of destCategories) {
      const affinity = styleAffinity[category] ?? 0.3;
      if (userStyles.includes(category)) {
        matchScore += 1 * (0.5 + affinity * 0.5);
      } else {
        matchScore += affinity * 0.3;
      }
    }
    
    return Math.min(1, matchScore / destCategories.length);
  }
  
  private static calculateActivityMatch(
    destActivities: string[],
    userAffinities: Record<string, number>
  ): number {
    if (destActivities.length === 0) return 0.5;
    if (Object.keys(userAffinities).length === 0) return 0.5;
    
    let totalAffinity = 0;
    for (const activity of destActivities) {
      totalAffinity += userAffinities[activity] ?? 0.3;
    }
    
    return Math.min(1, totalAffinity / destActivities.length);
  }
  
  private static getMatchingActivities(
    destActivities: string[],
    userAffinities: Record<string, number>
  ): string[] {
    return destActivities
      .filter(activity => (userAffinities[activity] ?? 0) > 0.5)
      .sort((a, b) => (userAffinities[b] ?? 0) - (userAffinities[a] ?? 0));
  }
  
  // ─────────────────────────────────────────────────────────────
  // BUDGET FIT CALCULATION (DETERMINISTIC)
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Calculate budget fit score
   * 
   * Formula:
   *   If cost within range: score = 1.0
   *   If below range: score = 0.85 (under budget is okay)
   *   If above range: score = 1 - ((cost - max) / max) * penalty
   */
  static calculateBudgetFit(
    avgDailyCost: number,
    budgetRange: [number, number],
    budgetSensitivity: number
  ): { score: number; delta: number } {
    const [minBudget, maxBudget] = budgetRange;
    
    // Perfect fit
    if (avgDailyCost >= minBudget && avgDailyCost <= maxBudget) {
      return { score: 1.0, delta: 0 };
    }
    
    // Under budget
    if (avgDailyCost < minBudget) {
      const underPercent = (minBudget - avgDailyCost) / minBudget;
      const score = 0.85 - (underPercent * 0.2);
      return {
        score: Math.max(0.5, score),
        delta: -(minBudget - avgDailyCost),
      };
    }
    
    // Over budget
    const overPercent = (avgDailyCost - maxBudget) / maxBudget;
    const penalty = overPercent * budgetSensitivity;
    const score = Math.max(0, 1 - penalty);
    
    return {
      score: Math.round(score * 1000) / 1000,
      delta: avgDailyCost - maxBudget,
    };
  }
  
  // ─────────────────────────────────────────────────────────────
  // SEASONALITY CALCULATION (DETERMINISTIC)
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Calculate seasonality score
   * NO RANDOMNESS - all scores from data
   */
  static calculateSeasonality(
    destination: DestinationFeatures,
    plannedSeason: string
  ): { score: number; factors: string[] } {
    const factors: string[] = [];
    
    if (destination.peakSeason === plannedSeason) {
      factors.push(`Peak season for ${destination.name}`);
      return { score: 1.0, factors };
    }
    
    if (destination.offPeakSeason === plannedSeason) {
      factors.push('Off-peak rates available');
      return { score: 0.6, factors };
    }
    
    if (destination.currentSeasonScore > 0.8) {
      factors.push('Great weather this time of year');
    } else if (destination.currentSeasonScore > 0.6) {
      factors.push('Good seasonal timing');
    }
    
    return {
      score: destination.currentSeasonScore,
      factors,
    };
  }
  
  // ─────────────────────────────────────────────────────────────
  // POPULARITY CALCULATION (DETERMINISTIC)
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Calculate normalized popularity score
   * Uses log scaling to handle wide range of booking counts
   */
  static calculatePopularity(
    bookingCount: number,
    reviewCount: number,
    rating: number
  ): number {
    // Log scale for booking count
    const bookingScore = this.normalizeSigmoid(
      Math.log10(bookingCount + 1),
      3,
      1
    );
    
    const reviewScore = this.normalizeSigmoid(
      Math.log10(reviewCount + 1),
      2.5,
      1
    );
    
    const ratingScore = this.normalizeRating(rating);
    
    return bookingScore * 0.3 + reviewScore * 0.2 + ratingScore * 0.5;
  }
  
  // ─────────────────────────────────────────────────────────────
  // QUALITY CALCULATION (DETERMINISTIC)
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Calculate overall quality score
   */
  static calculateQuality(
    destination: DestinationFeatures
  ): { score: number; factors: string[] } {
    const factors: string[] = [];
    
    const weighted =
      destination.safetyScore * 0.4 +
      destination.infrastructureScore * 0.25 +
      destination.accessibilityScore * 0.15 +
      this.normalizeRating(destination.rating) * 0.2;
    
    if (destination.safetyScore > 0.9) {
      factors.push('Excellent safety rating');
    }
    if (destination.rating >= 4.5) {
      factors.push(`Highly rated (${destination.rating.toFixed(1)}/5)`);
    }
    
    return {
      score: Math.round(weighted * 1000) / 1000,
      factors,
    };
  }
  
  // ─────────────────────────────────────────────────────────────
  // DISTANCE CALCULATION (DETERMINISTIC)
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Calculate distance score
   * Closer destinations score higher
   */
  static calculateDistance(
    distanceKm: number | undefined,
    userDistanceTolerance: number
  ): number {
    if (distanceKm === undefined) return 0.5;
    
    const maxDistance = 5000;
    const proximityScore = 1 - Math.min(1, distanceKm / maxDistance);
    
    return proximityScore * (0.5 + userDistanceTolerance * 0.5);
  }
  
  // ─────────────────────────────────────────────────────────────
  // SOCIAL PROOF CALCULATION
  // ─────────────────────────────────────────────────────────────
  
  private static calculateSocialProof(destination: DestinationFeatures): number {
    const ratingScore = this.normalizeRating(destination.rating);
    const reviewScore = this.normalizeSigmoid(
      Math.log10(destination.reviewCount + 1),
      2,
      1
    );
    
    return ratingScore * 0.5 + reviewScore * 0.3 + destination.socialScore * 0.2;
  }
  
  // ─────────────────────────────────────────────────────────────
  // FULL FEATURE VECTOR GENERATION
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Generate complete feature vector for a destination
   */
  static generateFeatureVector(
    destination: DestinationFeatures,
    user: UserProfile,
    context: UserContext
  ): FeatureVector {
    const preferenceResult = this.calculatePreferenceMatch(destination, user, context);
    const budgetResult = this.calculateBudgetFit(
      destination.avgDailyCost,
      user.explicitPreferences.budgetRange,
      user.preferenceWeights.budgetSensitivity
    );
    const seasonalResult = this.calculateSeasonality(destination, context.currentSeason);
    const qualityResult = this.calculateQuality(destination);
    
    const features: RecommendationFeatures = {
      preferenceMatch: preferenceResult.score,
      budgetFit: budgetResult.score,
      seasonality: seasonalResult.score,
      popularity: this.calculatePopularity(
        destination.bookingCount,
        destination.reviewCount,
        destination.rating
      ),
      quality: qualityResult.score,
      distance: this.calculateDistance(
        destination.distanceFromUser,
        user.preferenceWeights.distanceTolerance
      ),
      trending: destination.trendingScore,
      socialProof: this.calculateSocialProof(destination),
      recency: 0.5,
      diversity: 0.5,
    };
    
    return {
      features,
      rawValues: {
        preferenceMatches: preferenceResult.matches,
        budgetDelta: budgetResult.delta,
        seasonalFactors: seasonalResult.factors,
        qualityFactors: qualityResult.factors,
      },
    };
  }
}