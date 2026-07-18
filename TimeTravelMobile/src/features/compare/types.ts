import type { CompareProfile, CompareResult } from "@/services/compare";
import type { Destination } from "@/types";

export type { CompareProfile, CompareResult, Destination };

export const MAX_COMPARE_DESTINATIONS = 5;
export const MIN_COMPARE_DESTINATIONS = 2;

export type ComparisonPriority =
  | "budget"
  | "safety"
  | "weather"
  | "balanced"
  | "crowd"
  | "experience";
export type ComparisonCategory = "cost" | "comfort" | "risk" | "experience";
export type ComparisonFactorKey =
  | "budget"
  | "safety"
  | "weather"
  | "crowd"
  | "seasonality"
  | "experience";
export type ComparisonFactorDirection = "higher" | "lower" | "closer";
export type ComparisonDataSource = "live" | "cache" | "mock";
export type ComparisonTone = "success" | "warning" | "danger" | "info";

export interface CompareRouteParams {
  dest1?: string;
  dest2?: string;
  days?: number;
  familySize?: number;
  travelClass?: string;
  priority?: ComparisonPriority;
}

export interface ComparisonPreferences {
  priority: ComparisonPriority;
  days: number;
  familySize: number;
  travelClass: string;
}

export interface ComparisonFactorSpec {
  key: ComparisonFactorKey;
  label: string;
  category: ComparisonCategory;
  direction: ComparisonFactorDirection;
  icon: string;
  description: string;
}

export interface ComparisonAggregateMetrics {
  budgetTotal: number | null;
  safetyScore: number | null;
  weatherTemperature: number | null;
  weatherFeelsLike: number | null;
  weatherHumidity: number | null;
  weatherWindSpeed: number | null;
  crowdIndex: number | null;
  seasonalityScore: number | null;
  experienceScore: number | null;
  dataCompleteness: number;
  profileCount: number;
}

export interface ComparisonFactorScore {
  key: ComparisonFactorKey;
  label: string;
  category: ComparisonCategory;
  direction: ComparisonFactorDirection;
  rawValue: number | null;
  normalizedValue: number;
  weight: number;
  formattedValue: string;
  note: string;
  isWinner: boolean;
}

export interface ComparisonCandidateScore {
  destination: Destination;
  metrics: ComparisonAggregateMetrics;
  factorScores: ComparisonFactorScore[];
  totalScore: number;
  rank: number;
  confidence: number;
  highlights: string[];
}

export interface ComparisonInsight {
  id: string;
  category: ComparisonCategory;
  title: string;
  description: string;
  deltaLabel: string;
  tone: ComparisonTone;
  icon: string;
  winnerDestinationId?: string;
  runnerUpDestinationId?: string;
}

export interface ComparisonAnalysisSummary {
  selectedCount: number;
  source: ComparisonDataSource;
  hasPartialData: boolean;
  winnerLabel: string;
  winningScore: number;
  confidence: number;
  explanation: string;
}

export interface ComparisonAnalysis {
  candidates: ComparisonCandidateScore[];
  winner: ComparisonCandidateScore | null;
  insights: ComparisonInsight[];
  reasoning: string;
  confidence: number;
  source: ComparisonDataSource;
  hasPartialData: boolean;
  lastUpdatedAt: number;
  factorOrder: ComparisonFactorKey[];
  summary: ComparisonAnalysisSummary;
}

export interface ComparisonSessionSnapshot {
  destinations: Destination[];
  preferences: ComparisonPreferences;
  profilesByDestination: Record<string, CompareProfile[]>;
  source: ComparisonDataSource;
  hasPartialData: boolean;
  lastUpdatedAt: number;
}

export interface CompareViewModel {
  destinations: Destination[];
  selectedDestinations: Destination[];
  activeDestinationId: string | null;
  activeDestinationIndex: number;
  analysis: ComparisonAnalysis | null;
  isLoadingDestinations: boolean;
  isLoadingAnalysis: boolean;
  isRefreshing: boolean;
  isOffline: boolean;
  error: string | null;
  canCompare: boolean;
  maxDestinations: number;
  priority: ComparisonPriority;
  days: number;
  familySize: number;
  travelClass: string;
  source: ComparisonDataSource | null;
  lastUpdatedLabel: string;
  toggleDestination: (destination: Destination) => void;
  removeDestination: (destinationId: string) => void;
  setActiveDestination: (destinationId: string) => void;
  swapTopTwo: () => void;
  setPriority: (priority: ComparisonPriority) => void;
  setDays: (days: number) => void;
  setFamilySize: (familySize: number) => void;
  setTravelClass: (travelClass: string) => void;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}
