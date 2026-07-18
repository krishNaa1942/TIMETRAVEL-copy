/**
 * User Behavior Store - AI Travel Identity System
 * Tracks user interactions, learns preferences, and generates travel personality
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface BehaviorEvent {
  type: 'click' | 'search' | 'save' | 'book' | 'share' | 'view' | 'rating';
  category: string;
  destination?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface CategoryPreference {
  category: string;
  score: number;
  interactions: number;
  lastInteraction: number;
}

export interface TravelPersonality {
  type: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  percentage: number;
}

export interface TravelDNA {
  explorer: number;
  foodie: number;
  luxury: number;
  adventure: number;
  culture: number;
  relaxation: number;
  budget: number;
  social: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface UserLevel {
  level: number;
  xp: number;
  xpToNext: number;
  title: string;
}

export interface UserBehaviorState {
  events: BehaviorEvent[];
  categoryPreferences: CategoryPreference[];
  searchHistory: string[];
  savedDestinations: string[];
  viewedDestinations: string[];
  travelDNA: TravelDNA;
  personality: TravelPersonality | null;
  level: UserLevel;
  badges: Badge[];
  streak: { current: number; longest: number; lastActivity: number };
  insights: string[];
  predictions: string[];
  nextActions: string[];
  
  trackEvent: (event: Omit<BehaviorEvent, 'timestamp'>) => void;
  recordSearch: (query: string) => void;
  recordSave: (destinationId: string) => void;
  recordView: (destinationId: string, category: string) => void;
  recordBooking: (destinationId: string, amount: number) => void;
  getTopCategories: (limit?: number) => CategoryPreference[];
  getXPProgress: () => number;
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const PERSONALITY_TYPES: Record<string, Omit<TravelPersonality, 'percentage'>> = {
  explorer: { type: 'explorer', label: 'Globe Trekker', description: 'You seek new horizons and hidden gems!', icon: '🌍', color: '#3B82F6' },
  foodie: { type: 'foodie', label: 'Culinary Voyager', description: 'You travel for tastes and culinary experiences!', icon: '🍽️', color: '#F59E0B' },
  luxury: { type: 'luxury', label: 'Luxury Connoisseur', description: 'You appreciate the finer things!', icon: '💎', color: '#8B5CF6' },
  adventure: { type: 'adventure', label: 'Thrill Seeker', description: 'Adrenaline is your fuel!', icon: '🏔️', color: '#EF4444' },
  culture: { type: 'culture', label: 'Culture Enthusiast', description: 'History and art captivate you!', icon: '🏛️', color: '#EC4899' },
  relaxation: { type: 'relaxation', label: 'Zen Wanderer', description: 'Peace and tranquility guide you!', icon: '🧘', color: '#10B981' },
  budget: { type: 'budget', label: 'Smart Traveler', description: 'You maximize value!', icon: '💡', color: '#06B6D4' },
  social: { type: 'social', label: 'Social Butterfly', description: 'Travel is better together!', icon: '🦋', color: '#F97316' },
};

const LEVEL_TITLES = ['Newcomer', 'Wanderer', 'Explorer', 'Adventurer', 'Globe Trotter', 'Jet Setter', 'World Citizen', 'Travel Master', 'Globe Master', 'Legendary Voyager'];

const AVAILABLE_BADGES: Omit<Badge, 'earnedAt'>[] = [
  { id: 'first_trip', name: 'First Steps', description: 'Completed your first trip', icon: '🎯', tier: 'bronze' },
  { id: 'globetrotter', name: 'Globe Trotter', description: 'Visited 10+ destinations', icon: '🌐', tier: 'gold' },
  { id: 'streak_7', name: 'Week Streak', description: '7 days of activity', icon: '🔥', tier: 'bronze' },
  { id: 'streak_30', name: 'Month Master', description: '30 days of activity', icon: '💪', tier: 'gold' },
  { id: 'food_hunter', name: 'Food Hunter', description: 'Explored restaurants', icon: '🍜', tier: 'silver' },
  { id: 'culture_vulture', name: 'Culture Vulture', description: 'Visited cultural sites', icon: '🎭', tier: 'gold' },
  { id: 'adventure_seeker', name: 'Adventure Seeker', description: 'Adventure activities', icon: '🏔️', tier: 'silver' },
  { id: 'beach_lover', name: 'Beach Lover', description: 'Visited beaches', icon: '🏖️', tier: 'bronze' },
];

const XP_VALUES: Record<string, number> = { click: 1, view: 2, search: 3, save: 5, share: 10, rating: 8, book: 50 };
const calculateXPForLevel = (level: number): number => Math.floor(100 * Math.pow(1.5, level - 1));

const initialState = {
  events: [] as BehaviorEvent[],
  categoryPreferences: [] as CategoryPreference[],
  searchHistory: [] as string[],
  savedDestinations: [] as string[],
  viewedDestinations: [] as string[],
  travelDNA: { explorer: 0, foodie: 0, luxury: 0, adventure: 0, culture: 0, relaxation: 0, budget: 0, social: 0 } as TravelDNA,
  personality: null as TravelPersonality | null,
  level: { level: 1, xp: 0, xpToNext: 100, title: LEVEL_TITLES[0] },
  badges: [] as Badge[],
  streak: { current: 0, longest: 0, lastActivity: Date.now() },
  insights: [] as string[],
  predictions: [] as string[],
  nextActions: [] as string[],
};

export const useUserBehaviorStore = create<UserBehaviorState>()(
  persist(
    (set, get) => ({
      ...initialState,

      trackEvent: (event) => {
        const fullEvent: BehaviorEvent = { ...event, timestamp: Date.now() };
        const events = [...get().events, fullEvent].slice(-1000);
        
        const categoryPrefs = [...get().categoryPreferences];
        const existingIdx = categoryPrefs.findIndex(p => p.category === event.category);
        
        if (existingIdx >= 0) {
          categoryPrefs[existingIdx] = {
            ...categoryPrefs[existingIdx],
            score: categoryPrefs[existingIdx].score + (XP_VALUES[event.type] || 1),
            interactions: categoryPrefs[existingIdx].interactions + 1,
            lastInteraction: Date.now(),
          };
        } else if (event.category) {
          categoryPrefs.push({ category: event.category, score: XP_VALUES[event.type] || 1, interactions: 1, lastInteraction: Date.now() });
        }

        const xpGained = XP_VALUES[event.type] || 1;
        const currentXP = get().level.xp + xpGained;
        let newLevel = get().level;
        
        if (currentXP >= get().level.xpToNext) {
          const newLevelNum = get().level.level + 1;
          newLevel = {
            level: newLevelNum,
            xp: currentXP - get().level.xpToNext,
            xpToNext: calculateXPForLevel(newLevelNum + 1),
            title: LEVEL_TITLES[Math.min(newLevelNum - 1, LEVEL_TITLES.length - 1)],
          };
        } else {
          newLevel = { ...get().level, xp: currentXP };
        }

        set({ events, categoryPreferences: categoryPrefs, level: newLevel });
      },

      recordSearch: (query) => {
        const searchHistory = [query, ...get().searchHistory.filter((q: string) => q !== query)].slice(0, 50);
        set({ searchHistory });
        get().trackEvent({ type: 'search', category: 'search', metadata: { query } });
      },

      recordSave: (destinationId) => {
        const savedDestinations = [destinationId, ...get().savedDestinations.filter((d: string) => d !== destinationId)];
        set({ savedDestinations });
        get().trackEvent({ type: 'save', category: 'destination', destination: destinationId });
      },

      recordView: (destinationId, category) => {
        const viewedDestinations = [destinationId, ...get().viewedDestinations.filter((d: string) => d !== destinationId)].slice(0, 100);
        set({ viewedDestinations });
        get().trackEvent({ type: 'view', category, destination: destinationId });
      },

      recordBooking: (destinationId, amount) => {
        get().trackEvent({ type: 'book', category: 'booking', destination: destinationId, metadata: { amount } });
      },

      getTopCategories: (limit = 5) => {
        return [...get().categoryPreferences].sort((a, b) => b.score - a.score).slice(0, limit);
      },

      getXPProgress: () => {
        const { xp, xpToNext } = get().level;
        return Math.min(100, (xp / xpToNext) * 100);
      },

      reset: () => set(initialState),
    }),
    {
      name: 'user-behavior-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        events: state.events,
        categoryPreferences: state.categoryPreferences,
        searchHistory: state.searchHistory,
        savedDestinations: state.savedDestinations,
        viewedDestinations: state.viewedDestinations,
        level: state.level,
        badges: state.badges,
        streak: state.streak,
      }),
    }
  )
);

// Selector hooks for computed values
export const useTravelDNA = () => useUserBehaviorStore((state) => state.travelDNA);
export const usePersonality = () => useUserBehaviorStore((state) => state.personality);
export const useUserLevel = () => useUserBehaviorStore((state) => state.level);
export const useBadges = () => useUserBehaviorStore((state) => state.badges);
export const useUserStreak = () => useUserBehaviorStore((state) => state.streak);