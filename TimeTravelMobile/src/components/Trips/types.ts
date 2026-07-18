/**
 * Trips Feature Types - Production Grade Type Definitions
 * Config-driven system for scalable feature management
 */

import { TripStackParamList, SocialStackParamList, SettingsStackParamList } from '@/navigation/types';

// ─────────────────────────────────────────────────────────────
// FEATURE CONFIGURATION TYPES
// ─────────────────────────────────────────────────────────────

export type FeatureCategory = 
  | 'planning' 
  | 'management' 
  | 'tracking' 
  | 'social' 
  | 'tools' 
  | 'insights'
  | 'premium';

export type FeatureStatus = 'active' | 'coming_soon' | 'beta' | 'premium' | 'disabled';

export interface FeatureBadge {
  text: string;
  color: string;
  backgroundColor: string;
}

export interface FeatureRoute {
  stack: string;
  screen: string;
  params?: Record<string, unknown>;
}

export interface FeatureConfig {
  id: string;
  title: string;
  description: string;
  emoji: string;
  icon?: string; // Lucide icon name alternative
  category: FeatureCategory;
  status: FeatureStatus;
  
  // Navigation
  screen?: keyof TripStackParamList | keyof SocialStackParamList | keyof SettingsStackParamList | string;
  route?: FeatureRoute;
  params?: Record<string, unknown>;
  deepLink?: string;
  
  // UI Customization
  gradient?: [string, string];
  accentColor?: string;
  badge?: FeatureBadge;
  
  // Behavior
  isPremium?: boolean;
  isOffline?: boolean;
  requiresAuth?: boolean;
  requiresTripId?: boolean;
  
  // Analytics
  analyticsEvent: string;
  analyticsCategory: string;
  
  // Personalization
  weight: number; // Default weight for recommendation algorithm
  tags: string[];
}

// ─────────────────────────────────────────────────────────────
// QUICK ACTION TYPES
// ─────────────────────────────────────────────────────────────

export type QuickActionType = 
  | 'resume_trip' 
  | 'add_expense' 
  | 'add_note' 
  | 'check_weather'
  | 'view_itinerary'
  | 'share_trip'
  | 'book_flight'
  | 'find_hotel';

export interface QuickAction {
  id: string;
  type: QuickActionType;
  title: string;
  subtitle?: string;
  icon: string;
  emoji: string;
  action: () => void;
  tripId?: string;
  urgency?: 'low' | 'medium' | 'high';
}

// ─────────────────────────────────────────────────────────────
// TRAVEL SUMMARY TYPES
// ─────────────────────────────────────────────────────────────

export interface UpcomingTrip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  progress: number; // 0-100
  daysUntil: number;
}

export interface TravelProgress {
  totalTrips: number;
  countriesVisited: number;
  citiesVisited: number;
  totalDistance: number; // in km
  totalSpent: number;
  tripsThisYear: number;
  upcomingTrips: number;
}

// ─────────────────────────────────────────────────────────────
// RECOMMENDATION TYPES
// ─────────────────────────────────────────────────────────────

export interface FeatureRecommendation {
  feature: FeatureConfig;
  score: number;
  reason: string;
  context: 'time_based' | 'behavior_based' | 'trip_based' | 'seasonal' | 'popular';
}

// ─────────────────────────────────────────────────────────────
// TRIPS STORE TYPES
// ─────────────────────────────────────────────────────────────

export interface TripsState {
  // Feature states
  features: FeatureConfig[];
  recentlyUsed: string[];
  favorites: string[];
  recommendations: FeatureRecommendation[];
  
  // Travel data
  upcomingTrips: UpcomingTrip[];
  travelProgress: TravelProgress | null;
  quickActions: QuickAction[];
  
  // UI State
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: number | null;
  
  // View preferences
  viewMode: 'grid' | 'list';
  selectedCategory: FeatureCategory | 'all';
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS TYPES
// ─────────────────────────────────────────────────────────────

export interface FeatureClickEvent {
  featureId: string;
  featureTitle: string;
  category: FeatureCategory;
  timestamp: number;
  sessionTime: number;
  screenContext: string;
}

export interface FeatureUsageStats {
  featureId: string;
  clickCount: number;
  lastUsed: number;
  averageSessionTime: number;
  conversionRate: number;
}