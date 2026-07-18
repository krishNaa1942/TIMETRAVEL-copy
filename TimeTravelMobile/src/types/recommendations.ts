/**
 * Recommendation System Types
 * ===========================
 * Production-grade type definitions for the AI recommendation system.
 * 
 * CRITICAL: All scores are deterministic - same inputs always produce same outputs.
 */

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

export type TravelStyle = 
  | 'beach' 
  | 'adventure' 
  | 'cultural' 
  | 'spiritual' 
  | 'nature' 
  | 'luxury' 
  | 'budget';

export type BudgetTier = 'budget' | 'mid-range' | 'luxury';

export type Season = 'summer' | 'winter' | 'monsoon' | 'spring' | 'any';

export type GroupType = 'solo' | 'couple' | 'family' | 'friends' | 'business';

export type InteractionType = 'view' | 'favorite' | 'share' | 'book' | 'review';

// ─────────────────────────────────────────────────────────────
// USER MODELING
// ─────────────────────────────────────────────────────────────

export interface UserPreferenceWeights {
  travelStyleAffinity: Record<TravelStyle, number>;
  budgetSensitivity: number;
  seasonFlexibility: number;
  distanceTolerance: number;
  popularityWeight: number;
}

export interface UserBehaviorMetrics {
  totalSearches: number;
  totalViews: number;
  totalBookings: number;
  totalFavorites: number;
  averageSessionDuration: number;
  searchToViewRatio: number;
  viewToBookRatio: number;
  preferredBookingLeadTime: number;
  averageTripDuration: number;
}

export interface UserInteraction {
  destinationId: string;
  interactionType: InteractionType;
  timestamp: number;
  dwellTime?: number;
  scrollDepth?: number;
  conversionAction?: boolean;
}

export interface ExplicitPreferences {
  travelStyles: TravelStyle[];
  budgetTier: BudgetTier;
  budgetRange: [number, number];
  preferredSeasons: Season[];
  groupType: GroupType;
  accessibilityNeeds: string[];
  dietaryRestrictions: string[];
}

export interface ImplicitPreferences {
  inferredStyles: TravelStyle[];
  styleConfidence: Record<TravelStyle, number>;
  pricePointPreference: number;
  regionAffinity: Record<string, number>;
  activityAffinity: Record<string, number>;
}

export interface UserProfile {
  id: string;
  explicitPreferences: ExplicitPreferences;
  implicitPreferences: ImplicitPreferences;
  preferenceWeights: UserPreferenceWeights;
  behaviorMetrics: UserBehaviorMetrics;
  recentInteractions: UserInteraction[];
  createdAt: number;
  lastActive: number;
  preferencesLastUpdated: number;
}

export interface UserContext {
  currentLocation?: { latitude: number; longitude: number };
  currentSeason: Season;
  requestTime: number;
  tripDuration?: number;
  travelDates?: { start: Date; end: Date };
  groupSize?: number;
  occasion?: string;
  filters: {
    maxBudget?: number;
    regions?: string[];
    excludeRegions?: string[];
    activities?: string[];
    minRating?: number;
  };
}

// ─────────────────────────────────────────────────────────────
// DESTINATION FEATURES
// ─────────────────────────────────────────────────────────────

export interface DestinationFeatures {
  id: string;
  name: string;
  region: string;
  country: string;
  categories: TravelStyle[];
  activities: string[];
  cuisineTypes: string[];
  rating: number;
  reviewCount: number;
  avgDailyCost: number;
  bookingCount: number;
  distanceFromUser?: number;
  normalizedPopularity: number;
  normalizedRating: number;
  normalizedCost: number;
  peakSeason: Season;
  offPeakSeason: Season;
  currentSeasonScore: number;
  trendingScore: number;
  socialScore: number;
  safetyScore: number;
  infrastructureScore: number;
  accessibilityScore: number;
}

export interface RecommendationFeatures {
  preferenceMatch: number;
  budgetFit: number;
  seasonality: number;
  popularity: number;
  quality: number;
  distance: number;
  trending: number;
  socialProof: number;
  recency: number;
  diversity: number;
}

export interface FeatureVector {
  features: RecommendationFeatures;
  rawValues: {
    preferenceMatches: string[];
    budgetDelta: number;
    seasonalFactors: string[];
    qualityFactors: string[];
  };
}

// ─────────────────────────────────────────────────────────────
// SCORING & RANKING
// ─────────────────────────────────────────────────────────────

export interface ScoringWeights {
  preferenceMatch: number;
  budgetFit: number;
  seasonality: number;
  popularity: number;
  quality: number;
  distance: number;
  trending: number;
  socialProof: number;
  recency: number;
}

export interface ScoreBreakdown {
  total: number;
  components: {
    [key in keyof RecommendationFeatures]: {
      score: number;
      weight: number;
      contribution: number;
      label: string;
      description: string;
    }
  };
}

export interface ScoreBreakdownResponse {
  preference_match: number;
  budget_fit: number;
  seasonality: number;
  popularity: number;
  quality: number;
  distance: number;
  trending: number;
  social_proof: number;
}

// ─────────────────────────────────────────────────────────────
// RECOMMENDATION RESULT
// ─────────────────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  name: string;
  country: string;
  region: string;
  score: number;
  score_breakdown: ScoreBreakdownResponse;
  explanations: string[];
  tags: string[];
  rating: number;
  avg_daily_cost: number;
  categories: string[];
  image_url?: string;
}

export interface RankedDestination {
  id: string;
  destination: DestinationFeatures;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  rank: number;
  explanations: string[];
  tags: string[];
  featureVector?: FeatureVector;
}

export interface DetailedExplanation {
  summary: string;
  factors: Array<{
    name: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
    percentage: number;
  }>;
  tips: string[];
}

// ─────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  total: number;
  context: {
    season: string;
    trip_duration: number;
    group_size: number;
    budget_max?: number;
  };
  generated_at: string;
}

export interface RecommendationsParams {
  season?: string;
  trip_duration?: number;
  group_size?: number;
  budget_max?: number;
  limit?: number;
  offset?: number;
}

// ─────────────────────────────────────────────────────────────
// DEFAULT VALUES
// ─────────────────────────────────────────────────────────────

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  preferenceMatch: 0.30,
  budgetFit: 0.15,
  seasonality: 0.10,
  popularity: 0.10,
  quality: 0.15,
  distance: 0.05,
  trending: 0.05,
  socialProof: 0.05,
  recency: 0.05,
};

export const DEFAULT_USER_PREFERENCE_WEIGHTS: UserPreferenceWeights = {
  travelStyleAffinity: {
    beach: 0.5,
    adventure: 0.5,
    cultural: 0.5,
    spiritual: 0.5,
    nature: 0.5,
    luxury: 0.5,
    budget: 0.5,
  },
  budgetSensitivity: 0.5,
  seasonFlexibility: 0.5,
  distanceTolerance: 0.5,
  popularityWeight: 0.5,
};

export const DEFAULT_EXPLICIT_PREFERENCES: ExplicitPreferences = {
  travelStyles: [],
  budgetTier: 'mid-range',
  budgetRange: [50, 300],
  preferredSeasons: ['any'],
  groupType: 'couple',
  accessibilityNeeds: [],
  dietaryRestrictions: [],
};

export const DEFAULT_IMPLICIT_PREFERENCES: ImplicitPreferences = {
  inferredStyles: [],
  styleConfidence: {
    beach: 0.5,
    adventure: 0.5,
    cultural: 0.5,
    spiritual: 0.5,
    nature: 0.5,
    luxury: 0.5,
    budget: 0.5,
  },
  pricePointPreference: 150,
  regionAffinity: {},
  activityAffinity: {},
};