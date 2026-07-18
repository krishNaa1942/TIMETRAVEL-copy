/**
 * Phrasebook Feature Types
 * Production-grade type definitions for the AI Phrasebook system
 */

// ============================================
// CORE PHRASE TYPES
// ============================================

export interface Phrase {
  id: string;
  english: string;
  local: string;
  pronunciation?: string;
  transliteration?: string;
  category: PhraseCategory;
  subcategory?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  audioUrl?: string;
  isOfflineAvailable?: boolean;
}

export type PhraseCategory = 
  | 'greetings'
  | 'food'
  | 'transport'
  | 'emergency'
  | 'shopping'
  | 'directions'
  | 'accommodation'
  | 'health'
  | 'social'
  | 'money'
  | 'time'
  | 'weather';

export interface PhraseCategoryConfig {
  key: PhraseCategory;
  label: string;
  icon: string;
  color: string;
  emoji: string;
  priority: number; // For sorting
}

// ============================================
// DESTINATION & LANGUAGE
// ============================================

export interface DestinationLanguage {
  destinationId: string;
  destinationName: string;
  language: string;
  languageCode: string;
  script?: string;
  nativeName?: string;
  phrasesCount: number;
  isRTL: boolean; // Right-to-left language
}

export interface PhrasebookData {
  destination: DestinationLanguage;
  phrases: Phrase[];
  lastUpdated: number;
  version: string;
}

// ============================================
// USER INTERACTIONS
// ============================================

export interface UserPhraseInteraction {
  phraseId: string;
  viewCount: number;
  lastViewedAt: number;
  isBookmarked: boolean;
  bookmarkedAt?: number;
  playCount: number;
  lastPlayedAt?: number;
}

export interface RecentPhrase {
  phrase: Phrase;
  accessedAt: number;
  context?: UserContext;
}

// ============================================
// AI & CONTEXT
// ============================================

export type UserContext = 
  | 'restaurant'
  | 'airport'
  | 'hotel'
  | 'train_station'
  | 'market'
  | 'hospital'
  | 'tourist_attraction'
  | 'beach'
  | 'mountain'
  | 'city_center'
  | 'custom';

export interface ContextualSuggestion {
  phrase: Phrase;
  relevanceScore: number;
  reason: string;
  context: UserContext;
}

export interface AIRecommendation {
  phrases: Phrase[];
  context: UserContext;
  confidence: number;
  generatedAt: number;
}

// ============================================
// SEARCH
// ============================================

export interface SearchResult {
  phrase: Phrase;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  field: 'english' | 'local' | 'pronunciation' | 'tags';
  indices: [number, number];
  value: string;
}

export interface SearchOptions {
  fuzzy: boolean;
  maxResults: number;
  threshold: number;
  includeFields: ('english' | 'local' | 'pronunciation' | 'tags')[];
}

// ============================================
// VOICE
// ============================================

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceConfig {
  language: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface STTResult {
  text: string;
  confidence: number;
  language: string;
  isFinal: boolean;
}

export interface TTSOptions extends VoiceConfig {
  onDone?: () => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
}

// ============================================
// CACHE & OFFLINE
// ============================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
  checksum?: string;
}

export interface OfflineStatus {
  isOnline: boolean;
  lastSyncAt: number | null;
  pendingChanges: number;
  cacheSize: number;
}

// ============================================
// UI STATE
// ============================================

export interface PhrasebookUIState {
  searchQuery: string;
  activeCategory: PhraseCategory | 'all';
  showBookmarksOnly: boolean;
  sortBy: 'relevance' | 'alphabetical' | 'recent' | 'frequency';
  viewMode: 'list' | 'grid';
  isVoiceModalVisible: boolean;
}

// ============================================
// ANALYTICS
// ============================================

export interface PhrasebookAnalytics {
  screenViewTime: number;
  phrasesViewed: number;
  phrasesPlayed: number;
  searchesPerformed: number;
  categoriesExplored: string[];
  mostUsedPhrases: string[];
}