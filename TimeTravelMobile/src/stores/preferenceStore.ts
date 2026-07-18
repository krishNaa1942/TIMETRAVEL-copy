/**
 * Preference Store (NEW)
 * ======================
 * 
 * SINGLE RESPONSIBILITY: User's local preferences and filters
 * 
 * This is CLIENT STATE - persisted locally, NOT from server.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type TravelStyle = 
  | 'beaches' 
  | 'adventure' 
  | 'budget' 
  | 'luxury' 
  | 'culture' 
  | 'nature' 
  | 'spiritual';

export type BudgetLevel = 'budget' | 'mid-range' | 'luxury';
export type Season = 'summer' | 'winter' | 'monsoon' | 'any';
export type GroupType = 'solo' | 'couple' | 'family' | 'friends';
export type SortBy = 'rating' | 'popularity' | 'price' | 'distance';
export type ViewMode = 'list' | 'grid' | 'map';

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  tripReminders: boolean;
  priceAlerts: boolean;
  destinationUpdates: boolean;
}

export interface UserPreferences {
  travelStyles: TravelStyle[];
  budgetLevel: BudgetLevel;
  preferredSeason: Season;
  groupType: GroupType;
  notifications: NotificationSettings;
}

export interface FilterState {
  destination: {
    query: string;
    category: string | null;
    region: string | null;
    budget: BudgetLevel | null;
    sortBy: SortBy;
  };
  itinerary: {
    status: string | null;
    destination: string | null;
  };
}

export interface PreferenceState {
  // User Preferences
  preferences: UserPreferences;
  
  // Filters
  filters: FilterState;
  
  // View Settings
  viewMode: ViewMode;
  
  // Location (client-side only)
  userLocation: { latitude: number; longitude: number } | null;
  
  // Recent Searches (local history)
  recentSearches: string[];
  
  // Actions
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  setDestinationFilter: (filter: Partial<FilterState['destination']>) => void;
  setItineraryFilter: (filter: Partial<FilterState['itinerary']>) => void;
  setViewMode: (mode: ViewMode) => void;
  setUserLocation: (coords: { latitude: number; longitude: number } | null) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  resetFilters: () => void;
}

// ─────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────

const defaultNotificationSettings: NotificationSettings = {
  pushEnabled: true,
  emailEnabled: true,
  tripReminders: true,
  priceAlerts: true,
  destinationUpdates: false,
};

const defaultPreferences: UserPreferences = {
  travelStyles: [],
  budgetLevel: 'mid-range',
  preferredSeason: 'any',
  groupType: 'couple',
  notifications: defaultNotificationSettings,
};

const defaultFilters: FilterState = {
  destination: {
    query: '',
    category: null,
    region: null,
    budget: null,
    sortBy: 'popularity',
  },
  itinerary: {
    status: null,
    destination: null,
  },
};

// ─────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      // Initial State
      preferences: defaultPreferences,
      filters: defaultFilters,
      viewMode: 'list',
      userLocation: null,
      recentSearches: [],

      // Update Preferences
      updatePreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      // Set Destination Filter
      setDestinationFilter: (filter) =>
        set((state) => ({
          filters: {
            ...state.filters,
            destination: { ...state.filters.destination, ...filter },
          },
        })),

      // Set Itinerary Filter
      setItineraryFilter: (filter) =>
        set((state) => ({
          filters: {
            ...state.filters,
            itinerary: { ...state.filters.itinerary, ...filter },
          },
        })),

      // Set View Mode
      setViewMode: (mode) => set({ viewMode: mode }),

      // Set User Location
      setUserLocation: (coords) => set({ userLocation: coords }),

      // Add Recent Search
      addRecentSearch: (query) =>
        set((state) => {
          const trimmed = query.trim();
          if (!trimmed) return state;
          
          const filtered = state.recentSearches.filter(s => s !== trimmed);
          return {
            recentSearches: [trimmed, ...filtered].slice(0, 15),
          };
        }),

      // Clear Recent Searches
      clearRecentSearches: () => set({ recentSearches: [] }),

      // Reset Filters
      resetFilters: () => set({ filters: defaultFilters }),
    }),
    {
      name: 'preference-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        filters: state.filters,
        viewMode: state.viewMode,
        recentSearches: state.recentSearches,
      }),
    }
  )
);

// ─────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────

export const selectPreferences = (state: PreferenceState) => state.preferences;
export const selectDestinationFilters = (state: PreferenceState) => 
  state.filters.destination;
export const selectItineraryFilters = (state: PreferenceState) => 
  state.filters.itinerary;
export const selectViewMode = (state: PreferenceState) => state.viewMode;
export const selectUserLocation = (state: PreferenceState) => state.userLocation;
export const selectRecentSearches = (state: PreferenceState) => 
  state.recentSearches;

export default usePreferenceStore;