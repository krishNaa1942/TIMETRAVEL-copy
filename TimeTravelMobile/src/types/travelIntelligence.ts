/**
 * AI Travel Intelligence OS - Type Definitions
 * Production-grade types for the Travel Intelligence System
 */

// ─────────────────────────────────────────────────────────────
// TRAVEL DNA - Behavioral Analysis
// ─────────────────────────────────────────────────────────────

export interface TravelDNA {
  explorer: number; // 0-100: How much they explore new places
  luxury: number; // 0-100: Preference for luxury experiences
  budget: number; // 0-100: Budget-conscious travel
  foodie: number; // 0-100: Food-focused travel
  adventure: number; // 0-100: Adventure activities
  culture: number; // 0-100: Cultural experiences
  relax: number; // 0-100: Relaxation-focused
  social: number; // 0-100: Group/social travel
  planner: number; // 0-100: How much they plan ahead
  spontaneous: number; // 0-100: Spontaneous travel
}

export interface TravelPersonality {
  type: string; // e.g., "The Cultural Explorer"
  tagline: string; // e.g., "You seek authentic local experiences"
  icon: string; // Emoji icon
  color: string; // Theme color
  description: string; // Full description
  strengths: string[]; // Travel strengths
  tips: string[]; // Personalized tips
}

// ─────────────────────────────────────────────────────────────
// AI INSIGHTS
// ─────────────────────────────────────────────────────────────

export type InsightType =
  | "achievement"
  | "pattern"
  | "prediction"
  | "recommendation"
  | "warning"
  | "milestone"
  | "trend"
  | "tip";

export type InsightPriority = "low" | "medium" | "high" | "urgent";

export interface AIInsight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionData?: Record<string, unknown>;
  createdAt: string;
  isRead: boolean;
  isDismissed: boolean;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// PREDICTIONS
// ─────────────────────────────────────────────────────────────

export interface TravelPrediction {
  type: "next_trip" | "budget" | "destination" | "frequency" | "season";
  confidence: number; // 0-1
  prediction: string;
  reasoning: string;
  data?: Record<string, unknown>;
  validUntil?: string;
}

export interface NextTripPrediction {
  likelyDates: {
    start: string;
    end: string;
    confidence: number;
  };
  likelyDestination: {
    name: string;
    country: string;
    confidence: number;
  };
  estimatedBudget: {
    min: number;
    max: number;
    currency: string;
  };
  tripType: string;
  reasoning: string[];
}

export interface BudgetPrediction {
  monthlyForecast: number;
  yearlyForecast: number;
  overspendRisk: number; // 0-1
  savingsOpportunity: number;
  categoryForecasts: Record<string, number>;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  type: "warning" | "tip" | "achievement";
  category: string;
  message: string;
  impact: number;
}

// ─────────────────────────────────────────────────────────────
// FINANCIAL INTELLIGENCE
// ─────────────────────────────────────────────────────────────

export interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
  trend: "up" | "down" | "stable";
  trendValue: number;
  budget?: number;
  status: "under" | "over" | "on-track";
  insights: string[];
}

export interface FinancialHealth {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  status: "excellent" | "good" | "fair" | "needs-attention" | "critical";
  insights: AIInsight[];
  recommendations: string[];
  budgetUtilization: number;
  savingsRate: number;
  avgTripCost: number;
  costTrend: number; // Percentage change
}

// ─────────────────────────────────────────────────────────────
// GAMIFICATION
// ─────────────────────────────────────────────────────────────

export interface UserLevel {
  level: number;
  xp: number;
  xpToNext: number;
  title: string; // e.g., "Novice Explorer"
  progress: number; // 0-100
  benefits: string[];
  icon: string;
}

export interface TravelStreak {
  current: number;
  longest: number;
  type: "trips" | "days" | "journal" | "planning";
  lastActivity: string;
  isActive: boolean;
  nextMilestone: number;
  milestoneReward: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "exploration" | "social" | "planning" | "financial" | "special";
  rarity: "common" | "rare" | "epic" | "legendary";
  earnedAt?: string;
  progress: number; // 0-100
  target: number;
  isUnlocked: boolean;
  xpReward: number;
}

export interface Achievement {
  id: string;
  type: "milestone" | "streak" | "special" | "hidden";
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  isSecret: boolean;
  xpEarned: number;
}

// ─────────────────────────────────────────────────────────────
// VISUALIZATION DATA
// ─────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesData {
  label: string;
  data: {
    date: string;
    value: number;
  }[];
  color: string;
}

export interface HeatmapData {
  date: string;
  intensity: number; // 0-1
  count: number;
  label?: string;
}

export interface RadialChartData {
  label: string;
  value: number;
  color: string;
  icon?: string;
}

// ─────────────────────────────────────────────────────────────
// STORY NARRATIVE
// ─────────────────────────────────────────────────────────────

export interface TravelStory {
  id: string;
  type: "summary" | "milestone" | "trend" | "comparison" | "memory";
  period: string; // e.g., "2024", "This Month"
  title: string;
  narrative: string;
  highlights: string[];
  stats: Record<string, number>;
  icon: string;
  shareableText: string; // Pre-formatted for sharing
}

export interface YearInReview {
  year: number;
  totalTrips: number;
  totalDestinations: number;
  totalCountries: number;
  totalDays: number;
  totalDistance: number; // km
  totalSpent: number;
  topDestinations: string[];
  topExperiences: string[];
  personality: TravelPersonality;
  stories: TravelStory[];
  achievements: Achievement[];
  comparedToLastYear: {
    trips: number; // Percentage change
    spending: number;
    destinations: number;
  };
}

// ─────────────────────────────────────────────────────────────
// AGGREGATE STATS
// ─────────────────────────────────────────────────────────────

export interface EnhancedTravelStats {
  // Core metrics
  trips: {
    total: number;
    thisMonth: number;
    thisYear: number;
    lastYear: number;
    trend: "up" | "down" | "stable";
    trendValue: number;
    avgDuration: number;
    longestTrip: number;
    shortestTrip: number;
  };

  destinations: {
    total: number;
    countries: number;
    cities: number;
    thisYear: number;
    mostVisited: string;
    wishlist: number;
  };

  spending: {
    total: number;
    thisMonth: number;
    thisYear: number;
    avgPerTrip: number;
    avgPerDay: number;
    currency: string;
  };

  engagement: {
    photosUploaded: number;
    journalsWritten: number;
    placesSaved: number;
    tripsShared: number;
  };

  time: {
    totalDays: number;
    avgTripLength: number;
    longestStreak: number;
    currentStreak: number;
  };

  comparisons: {
    vsLastMonth: Record<string, number>;
    vsLastYear: Record<string, number>;
    vsAverageUser: Record<string, number>;
  };
}

// ─────────────────────────────────────────────────────────────
// AI ASSISTANT
// ─────────────────────────────────────────────────────────────

export interface AIAssistantQuery {
  id: string;
  query: string;
  type: "insight" | "recommendation" | "prediction" | "comparison" | "help";
  context?: Record<string, unknown>;
}

export interface AIAssistantResponse {
  query: string;
  response: string;
  insights: AIInsight[];
  actions?: {
    label: string;
    data: Record<string, unknown>;
  }[];
  followUpQuestions: string[];
}

// ─────────────────────────────────────────────────────────────
// INTELLIGENCE STATE
// ─────────────────────────────────────────────────────────────

export interface TravelIntelligenceState {
  // Core data
  stats: EnhancedTravelStats | null;
  dna: TravelDNA | null;
  personality: TravelPersonality | null;

  // Insights
  insights: AIInsight[];
  predictions: TravelPrediction[];

  // Financial
  financialHealth: FinancialHealth | null;
  spendingCategories: SpendingCategory[];
  budgetPrediction: BudgetPrediction | null;

  // Gamification
  level: UserLevel | null;
  streaks: TravelStreak[];
  badges: Badge[];
  achievements: Achievement[];

  // Stories
  stories: TravelStory[];
  yearInReview: YearInReview | null;

  // UI State
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: string | null;

  // Personalization
  preferences: {
    insightPriority: InsightPriority[];
    mutedCategories: string[];
    customGoals: Record<string, number>;
  };
}
