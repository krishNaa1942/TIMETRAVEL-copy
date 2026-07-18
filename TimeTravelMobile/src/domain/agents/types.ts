/**
 * 🤖 AI AGENT TYPES
 * ================
 * Type definitions for AI agents and intelligence layer
 */

// ─────────────────────────────────────────────────────────────
// Travel Intent Types
// ─────────────────────────────────────────────────────────────

export type TravelIntentType =
  | 'plan_trip'
  | 'get_weather'
  | 'find_places'
  | 'get_recommendations'
  | 'create_itinerary'
  | 'modify_itinerary'
  | 'get_directions'
  | 'translate_phrase'
  | 'currency_convert'
  | 'general_query'
  | 'unknown';

export type DateRange = {
  start: Date | string;
  end: Date | string;
};

export type Budget = {
  min?: number;
  max?: number;
  currency?: string;
};

export type ExtractedEntities = {
  origin?: string;
  destination?: string;
  dates?: DateRange;
  budget?: Budget;
  travelers?: number;
  duration?: number; // in days
  preferences?: string[];
  activities?: string[];
  accommodationType?: 'hotel' | 'hostel' | 'apartment' | 'resort' | 'any';
  transportMode?: 'flight' | 'train' | 'bus' | 'car' | 'any';
  cuisine?: string[];
  language?: string;
};

export type TravelIntent = {
  type: TravelIntentType;
  entities: ExtractedEntities;
  confidence: number; // 0-1
  rawInput: string;
  suggestedFollowUp?: string[];
};

// ─────────────────────────────────────────────────────────────
// Conversation Context
// ─────────────────────────────────────────────────────────────

export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  intent?: TravelIntent;
};

export type ConversationContext = {
  id: string;
  messages: ConversationMessage[];
  currentTripId?: string;
  userPreferences?: UserPreferencesSummary;
  lastIntent?: TravelIntent;
  createdAt: number;
  updatedAt: number;
};

export type UserPreferencesSummary = {
  preferredDestinations?: string[];
  travelStyle?: 'budget' | 'moderate' | 'luxury';
  interests?: string[];
  dietaryRestrictions?: string[];
  accessibilityNeeds?: string[];
};

// ─────────────────────────────────────────────────────────────
// Recommendation Types
// ─────────────────────────────────────────────────────────────

export type RecommendationSource = 'ai' | 'collaborative' | 'content' | 'trending';

export type RecommendationReason = {
  factor: string;
  weight: number;
  explanation: string;
};

export type Recommendation = {
  id: string;
  type: 'destination' | 'activity' | 'restaurant' | 'hotel' | 'experience';
  name: string;
  description: string;
  score: number; // 0-100
  confidence: number; // 0-1
  reasons: RecommendationReason[];
  source: RecommendationSource;
  metadata?: Record<string, unknown>;
};

export type RankedResults<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
  rankingContext: {
    factors: string[];
    weights: Record<string, number>;
  };
};

// ─────────────────────────────────────────────────────────────
// Agent Response Types
// ─────────────────────────────────────────────────────────────

export type AgentResponseStatus = 'thinking' | 'streaming' | 'complete' | 'error';

export type AgentResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    processingTime: number;
    model?: string;
    tokensUsed?: number;
  };
};

// ─────────────────────────────────────────────────────────────
// Streaming Types
// ─────────────────────────────────────────────────────────────

export type StreamChunk = {
  type: 'text' | 'intent' | 'recommendation' | 'done' | 'error';
  content?: string;
  data?: unknown;
};

export type StreamConfig = {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
};

// ─────────────────────────────────────────────────────────────
// Intent Patterns
// ─────────────────────────────────────────────────────────────

export type IntentPattern = {
  type: TravelIntentType;
  patterns: RegExp[];
  keywords: string[];
  priority: number;
};

// ─────────────────────────────────────────────────────────────
// Export All
// ─────────────────────────────────────────────────────────────

export type AgentTypes = {
  TravelIntent: TravelIntent;
  TravelIntentType: TravelIntentType;
  ExtractedEntities: ExtractedEntities;
  ConversationContext: ConversationContext;
  Recommendation: Recommendation;
  RankedResults: RankedResults<unknown>;
  AgentResponse: AgentResponse<unknown>;
  StreamChunk: StreamChunk;
  StreamConfig: StreamConfig;
};
