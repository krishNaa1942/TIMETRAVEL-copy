import type {
  AIInsight,
  AIAssistantQuery,
  AIAssistantResponse,
  Achievement,
  Badge,
  EnhancedTravelStats,
  FinancialHealth,
  SpendingCategory,
  TravelDNA,
  TravelPersonality,
  TravelPrediction,
  TravelStory,
  TravelStreak,
  UserLevel,
} from "@/types/travelIntelligence";
import type { TravelStats } from "@/services/stats";

export type {
  AIInsight,
  AIAssistantQuery,
  AIAssistantResponse,
  Achievement,
  Badge,
  EnhancedTravelStats,
  FinancialHealth,
  SpendingCategory,
  TravelDNA,
  TravelPersonality,
  TravelPrediction,
  TravelStory,
  TravelStreak,
  UserLevel,
  TravelStats,
};

export type TravelSectionKey = "overview" | "intelligence" | "community";

export interface TravelIntelligenceSnapshot {
  rawStats: TravelStats;
  summary: EnhancedTravelStats;
  dna: TravelDNA;
  personality: TravelPersonality;
  insights: AIInsight[];
  predictions: TravelPrediction[];
  financialHealth: FinancialHealth;
  spendingCategories: SpendingCategory[];
  level: UserLevel;
  streaks: TravelStreak[];
  badges: Badge[];
  achievements: Achievement[];
  stories: TravelStory[];
  hasData: boolean;
  lastUpdatedAt: number;
}

export interface TravelIntelligenceViewModel {
  snapshot: TravelIntelligenceSnapshot | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isOffline: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dismissInsight: (id: string) => void;
  askAI: (query: string) => Promise<AIAssistantResponse>;
  isAiLoading: boolean;
  aiError: string | null;
  lastUpdatedLabel: string;
}
