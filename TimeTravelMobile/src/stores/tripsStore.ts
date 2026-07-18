/**
 * Trips Store - Production Grade State Management
 * Zustand store with persistence for trips hub
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  FeatureConfig, 
  FeatureCategory, 
  FeatureRecommendation,
  UpcomingTrip,
  TravelProgress,
  QuickAction,
  TripsState 
} from '@/components/Trips/types';
import { 
  FEATURE_CONFIGS, 
  getActiveFeatures, 
  getFeatureById 
} from '@/components/Trips/featureConfig';
import { useUserBehaviorStore } from './userBehaviorStore';

// ─────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────

const initialState: Omit<TripsState, 
  | 'setFeatures' 
  | 'setRecentlyUsed' 
  | 'addToRecent' 
  | 'toggleFavorite'
  | 'setRecommendations'
  | 'setUpcomingTrips'
  | 'setTravelProgress'
  | 'setQuickActions'
  | 'setLoading'
  | 'setRefreshing'
  | 'setError'
  | 'setViewMode'
  | 'setSelectedCategory'
  | 'refresh'
  | 'trackFeatureClick'
  | 'getRecentFeatures'
  | 'getFavoriteFeatures'
  | 'getFilteredFeatures'
> = {
  features: FEATURE_CONFIGS,
  recentlyUsed: [],
  favorites: [],
  recommendations: [],
  upcomingTrips: [],
  travelProgress: null,
  quickActions: [],
  isLoading: true,
  isRefreshing: false,
  error: null,
  lastUpdated: null,
  viewMode: 'grid',
  selectedCategory: 'all',
};

// ─────────────────────────────────────────────────────────────
// STORE INTERFACE
// ─────────────────────────────────────────────────────────────

interface TripsStore extends TripsState {
  // Feature management
  setFeatures: (features: FeatureConfig[]) => void;
  setRecentlyUsed: (ids: string[]) => void;
  addToRecent: (featureId: string) => void;
  toggleFavorite: (featureId: string) => void;
  setRecommendations: (recommendations: FeatureRecommendation[]) => void;
  
  // Travel data
  setUpcomingTrips: (trips: UpcomingTrip[]) => void;
  setTravelProgress: (progress: TravelProgress) => void;
  setQuickActions: (actions: QuickAction[]) => void;
  
  // UI State
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSelectedCategory: (category: FeatureCategory | 'all') => void;
  
  // Actions
  refresh: () => Promise<void>;
  trackFeatureClick: (featureId: string) => void;
  
  // Computed getters
  getRecentFeatures: () => FeatureConfig[];
  getFavoriteFeatures: () => FeatureConfig[];
  getFilteredFeatures: () => FeatureConfig[];
}

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export const useTripsStore = create<TripsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Feature management
      setFeatures: (features) => set({ features, lastUpdated: Date.now() }),
      
      setRecentlyUsed: (ids) => set({ recentlyUsed: ids }),
      
      addToRecent: (featureId) => {
        const recent = get().recentlyUsed.filter(id => id !== featureId);
        const updated = [featureId, ...recent].slice(0, 10);
        set({ recentlyUsed: updated });
      },
      
      toggleFavorite: (featureId) => {
        const favorites = get().favorites;
        const isFavorite = favorites.includes(featureId);
        const updated = isFavorite
          ? favorites.filter(id => id !== featureId)
          : [...favorites, featureId];
        set({ favorites: updated });
      },
      
      setRecommendations: (recommendations) => set({ recommendations }),

      // Travel data
      setUpcomingTrips: (trips) => set({ upcomingTrips: trips }),
      setTravelProgress: (progress) => set({ travelProgress: progress }),
      setQuickActions: (actions) => set({ quickActions: actions }),

      // UI State
      setLoading: (isLoading) => set({ isLoading }),
      setRefreshing: (isRefreshing) => set({ isRefreshing }),
      setError: (error) => set({ error }),
      setViewMode: (viewMode) => set({ viewMode }),
      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

      // Refresh action
      refresh: async () => {
        set({ isRefreshing: true, error: null });
        try {
          // Simulate data refresh - in production this would fetch from API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Generate mock travel progress
          const progress: TravelProgress = {
            totalTrips: 12,
            countriesVisited: 8,
            citiesVisited: 24,
            totalDistance: 25000,
            totalSpent: 185000,
            tripsThisYear: 3,
            upcomingTrips: 2,
          };
          
          set({ 
            travelProgress: progress,
            lastUpdated: Date.now(),
            isRefreshing: false 
          });
        } catch (error) {
          set({ 
            error: 'Failed to refresh. Please try again.',
            isRefreshing: false 
          });
        }
      },

      // Analytics tracking
      trackFeatureClick: (featureId) => {
        const feature = getFeatureById(featureId);
        if (!feature) return;
        
        // Add to recent
        get().addToRecent(featureId);
        
        // Track in behavior store
        useUserBehaviorStore.getState().trackEvent({
          type: 'click',
          category: feature.analyticsCategory,
          metadata: { featureId, featureTitle: feature.title },
        });
      },

      // Computed getters
      getRecentFeatures: () => {
        const recentIds = get().recentlyUsed;
        return recentIds
          .map(id => getFeatureById(id))
          .filter((f): f is FeatureConfig => f !== undefined);
      },

      getFavoriteFeatures: () => {
        const favoriteIds = get().favorites;
        return favoriteIds
          .map(id => getFeatureById(id))
          .filter((f): f is FeatureConfig => f !== undefined);
      },

      getFilteredFeatures: () => {
        const { features, selectedCategory } = get();
        if (selectedCategory === 'all') {
          return getActiveFeatures();
        }
        return features.filter(
          f => f.category === selectedCategory && f.status !== 'disabled'
        );
      },
    }),
    {
      name: 'trips-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recentlyUsed: state.recentlyUsed,
        favorites: state.favorites,
        viewMode: state.viewMode,
        selectedCategory: state.selectedCategory,
      }),
    }
  )
);

// ─────────────────────────────────────────────────────────────
// SELECTOR HOOKS (for optimized re-renders)
// ─────────────────────────────────────────────────────────────

export const useTripsFeatures = () => useTripsStore((state) => state.features);
export const useRecentlyUsed = () => useTripsStore((state) => state.recentlyUsed);
export const useFavorites = () => useTripsStore((state) => state.favorites);
export const useRecommendations = () => useTripsStore((state) => state.recommendations);
export const useUpcomingTrips = () => useTripsStore((state) => state.upcomingTrips);
export const useTravelProgress = () => useTripsStore((state) => state.travelProgress);
export const useTripsLoading = () => useTripsStore((state) => state.isLoading);
export const useTripsError = () => useTripsStore((state) => state.error);
export const useViewMode = () => useTripsStore((state) => state.viewMode);
export const useSelectedCategory = () => useTripsStore((state) => state.selectedCategory);