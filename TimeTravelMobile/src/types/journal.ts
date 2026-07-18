/**
 * AI Travel Memory Engine - Type Definitions
 * Production-grade types for the Travel Memory System
 */

// ─────────────────────────────────────────────────────────────
// PLACE / LOCATION
// ─────────────────────────────────────────────────────────────

export interface JournalPlace {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country: string;
  countryCode?: string;
  lat: number;
  lng: number;
  placeId?: string; // Google Places ID
  types?: string[]; // locality, country, etc.
}

// ─────────────────────────────────────────────────────────────
// MEDIA
// ─────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  isPrimary?: boolean;
}

// ─────────────────────────────────────────────────────────────
// USER (SOCIAL)
// ─────────────────────────────────────────────────────────────

export interface JournalUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  notesCount: number;
  isFollowing?: boolean;
  isVerified?: boolean;
}

// ─────────────────────────────────────────────────────────────
// MOOD & SENTIMENT
// ─────────────────────────────────────────────────────────────

export type MoodType = 
  | 'excited' | 'happy' | 'relaxed' | 'grateful'
  | 'adventurous' | 'romantic' | 'nostalgic' | 'inspired'
  | 'peaceful' | 'curious' | 'tired' | 'neutral';

export type SentimentType = 'positive' | 'neutral' | 'negative';

export const MOOD_CONFIG: Record<MoodType, { emoji: string; label: string; color: string }> = {
  excited: { emoji: '🤩', label: 'Excited', color: '#F59E0B' },
  happy: { emoji: '😊', label: 'Happy', color: '#10B981' },
  relaxed: { emoji: '😌', label: 'Relaxed', color: '#06B6D4' },
  grateful: { emoji: '🥰', label: 'Grateful', color: '#EC4899' },
  adventurous: { emoji: '🧗', label: 'Adventurous', color: '#8B5CF6' },
  romantic: { emoji: '💕', label: 'Romantic', color: '#F43F5E' },
  nostalgic: { emoji: '🌅', label: 'Nostalgic', color: '#6366F1' },
  inspired: { emoji: '✨', label: 'Inspired', color: '#14B8A6' },
  peaceful: { emoji: '🕊️', label: 'Peaceful', color: '#0EA5E9' },
  curious: { emoji: '🧐', label: 'Curious', color: '#A855F7' },
  tired: { emoji: '😴', label: 'Tired', color: '#6B7280' },
  neutral: { emoji: '😐', label: 'Neutral', color: '#9CA3AF' },
};

// ─────────────────────────────────────────────────────────────
// TAGS & CATEGORIES
// ─────────────────────────────────────────────────────────────

export type TripType = 'solo' | 'couple' | 'family' | 'friends' | 'business' | 'group';

export type TravelCategory = 
  | 'beach' | 'mountains' | 'city' | 'countryside'
  | 'adventure' | 'food' | 'culture' | 'nightlife'
  | 'spiritual' | 'wildlife' | 'road_trip' | 'staycation';

export interface AutoTag {
  key: string;
  label: string;
  confidence: number; // 0-1
  type: 'trip_type' | 'category' | 'activity' | 'mood';
}

// ─────────────────────────────────────────────────────────────
// AI ANALYSIS
// ─────────────────────────────────────────────────────────────

export interface AIAnalysis {
  sentiment: SentimentType;
  sentimentScore: number; // -1 to 1
  tags: AutoTag[];
  summary: string;
  highlights: string[];
  recommendations: AIRecommendation[];
  detectedLanguage?: string;
  wordCount: number;
  readingTime: number; // minutes
}

export interface AIRecommendation {
  type: 'place' | 'activity' | 'food' | 'tip';
  title: string;
  description: string;
  placeId?: string;
  relevanceScore: number;
}

// ─────────────────────────────────────────────────────────────
// SOCIAL INTERACTIONS
// ─────────────────────────────────────────────────────────────

export interface Like {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  noteId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface SocialStats {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  viewsCount: number;
}

// ─────────────────────────────────────────────────────────────
// TRAVEL NOTE (MAIN ENTITY)
// ─────────────────────────────────────────────────────────────

export interface TravelNote {
  id: string;
  userId: string;
  user?: JournalUser;
  
  // Content
  title: string;
  content: string;
  htmlContent?: string; // Rich text version
  
  // Location (structured)
  destination: JournalPlace;
  
  // Media
  media: MediaItem[];
  primaryImage?: MediaItem;
  
  // Mood & Rating
  mood: MoodType;
  rating: number; // 1-5
  
  // AI Analysis
  aiAnalysis?: AIAnalysis;
  autoTags: AutoTag[];
  
  // Trip Info
  tripType?: TripType;
  travelDate?: string;
  tripDuration?: number; // days
  
  // Privacy
  isPublic: boolean;
  isFeatured?: boolean;
  
  // Social
  social: SocialStats;
  isLiked?: boolean;
  isSaved?: boolean;
  
  // Linked Entities
  linkedTripId?: string;
  linkedPlaceIds?: string[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// ─────────────────────────────────────────────────────────────
// DRAFT (Offline)
// ─────────────────────────────────────────────────────────────

export interface JournalDraft {
  id: string;
  title: string;
  content: string;
  destination?: JournalPlace;
  mood: MoodType;
  rating: number;
  mediaUris: string[]; // Local file URIs
  isPublic: boolean;
  lastSaved: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
}

// ─────────────────────────────────────────────────────────────
// FEED & PAGINATION
// ─────────────────────────────────────────────────────────────

export interface FeedFilter {
  destination?: string;
  mood?: MoodType;
  rating?: number;
  tripType?: TripType;
  category?: TravelCategory;
  dateFrom?: string;
  dateTo?: string;
}

export interface FeedSort {
  field: 'created_at' | 'popularity' | 'rating';
  order: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
}

// ─────────────────────────────────────────────────────────────
// INSIGHTS & ANALYTICS
// ─────────────────────────────────────────────────────────────

export interface TravelInsight {
  type: 'preference' | 'pattern' | 'recommendation' | 'milestone';
  title: string;
  description: string;
  icon: string;
  data?: Record<string, any>;
  createdAt: string;
}

export interface JournalStats {
  totalNotes: number;
  totalWords: number;
  totalCountries: number;
  totalCities: number;
  averageRating: number;
  mostVisitedCountry: string;
  mostFrequentMood: MoodType;
  currentStreak: number;
  longestStreak: number;
  totalLikes: number;
  totalComments: number;
}

// ─────────────────────────────────────────────────────────────
// BEHAVIOR TRACKING
// ─────────────────────────────────────────────────────────────

export interface JournalBehavior {
  notesCreated: number;
  notesLiked: number;
  notesSaved: number;
  commentsWritten: number;
  sharesMade: number;
  averageContentLength: number;
  preferredMoods: Record<MoodType, number>;
  preferredCategories: Record<TravelCategory, number>;
  peakWritingHours: number[];
  lastActiveDate: string;
}

// ─────────────────────────────────────────────────────────────
// GAMIFICATION
// ─────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  type: 'badge' | 'milestone' | 'streak';
  name: string;
  description: string;
  icon: string;
  earnedAt?: string;
  progress: number;
  target: number;
  isUnlocked: boolean;
}

export interface UserLevel {
  level: number;
  xp: number;
  xpToNext: number;
  title: string;
  benefits: string[];
}