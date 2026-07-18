/**
 * Phrasebook Store - Zustand State Management
 * Production-grade state management for the AI Phrasebook system
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Phrase,
  PhraseCategory,
  PhrasebookData,
  UserPhraseInteraction,
  RecentPhrase,
  UserContext,
  VoiceState,
  OfflineStatus,
} from '../types';

// ============================================
// STORE TYPES
// ============================================

interface PhrasebookState {
  // Data
  destinations: string[];
  selectedDestination: string;
  phrasebookData: PhrasebookData | null;
  
  // UI State
  searchQuery: string;
  activeCategory: PhraseCategory | 'all';
  showBookmarksOnly: boolean;
  sortBy: 'relevance' | 'alphabetical' | 'recent' | 'frequency';
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  
  // User Interactions
  interactions: Record<string, UserPhraseInteraction>;
  recentPhrases: RecentPhrase[];
  
  // Voice
  voiceState: VoiceState;
  isVoiceSupported: boolean;
  
  // Offline
  offlineStatus: OfflineStatus;
  
  // Context
  currentContext: UserContext | null;
  
  // Actions - Data
  setDestinations: (destinations: string[]) => void;
  selectDestination: (destination: string) => void;
  setPhrasebookData: (data: PhrasebookData | null) => void;
  
  // Actions - UI
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: PhraseCategory | 'all') => void;
  toggleBookmarksOnly: () => void;
  setSortBy: (sortBy: 'relevance' | 'alphabetical' | 'recent' | 'frequency') => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  
  // Actions - Interactions
  trackPhraseView: (phraseId: string) => void;
  trackPhrasePlay: (phraseId: string) => void;
  toggleBookmark: (phraseId: string) => void;
  addToRecent: (phrase: Phrase, context?: UserContext) => void;
  clearRecent: () => void;
  
  // Actions - Voice
  setVoiceState: (state: VoiceState) => void;
  setVoiceSupported: (supported: boolean) => void;
  
  // Actions - Offline
  setOfflineStatus: (status: Partial<OfflineStatus>) => void;
  
  // Actions - Context
  setCurrentContext: (context: UserContext | null) => void;
  
  // Computed - Getters
  getInteraction: (phraseId: string) => UserPhraseInteraction | undefined;
  isBookmarked: (phraseId: string) => boolean;
  getBookmarkedPhrases: () => string[];
  getRecentPhraseIds: () => string[];
  
  // Reset
  reset: () => void;
}

// ============================================
// INITIAL STATE
// ============================================

const initialState = {
  // Data
  destinations: [],
  selectedDestination: '',
  phrasebookData: null as PhrasebookData | null,
  
  // UI State
  searchQuery: '',
  activeCategory: 'all' as PhraseCategory | 'all',
  showBookmarksOnly: false,
  sortBy: 'relevance' as const,
  isLoading: false,
  isRefreshing: false,
  error: null,
  
  // User Interactions
  interactions: {} as Record<string, UserPhraseInteraction>,
  recentPhrases: [] as RecentPhrase[],
  
  // Voice
  voiceState: 'idle' as VoiceState,
  isVoiceSupported: false,
  
  // Offline
  offlineStatus: {
    isOnline: true,
    lastSyncAt: null,
    pendingChanges: 0,
    cacheSize: 0,
  },
  
  // Context
  currentContext: null as UserContext | null,
};

// ============================================
// STORE CREATION
// ============================================

export const usePhrasebookStore = create<PhrasebookState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Actions - Data
      setDestinations: (destinations) => set({ destinations }),
      
      selectDestination: (destination) => set({ 
        selectedDestination: destination,
        searchQuery: '',
        activeCategory: 'all',
        error: null,
      }),
      
      setPhrasebookData: (data) => set({ phrasebookData: data }),
      
      // Actions - UI
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      setActiveCategory: (category) => set({ activeCategory: category }),
      
      toggleBookmarksOnly: () => set((state) => ({ 
        showBookmarksOnly: !state.showBookmarksOnly 
      })),
      
      setSortBy: (sortBy) => set({ sortBy }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setRefreshing: (isRefreshing) => set({ isRefreshing }),
      
      setError: (error) => set({ error }),
      
      // Actions - Interactions
      trackPhraseView: (phraseId) => set((state) => {
        const existing = state.interactions[phraseId];
        return {
          interactions: {
            ...state.interactions,
            [phraseId]: {
              phraseId,
              viewCount: (existing?.viewCount || 0) + 1,
              lastViewedAt: Date.now(),
              isBookmarked: existing?.isBookmarked ?? false,
              bookmarkedAt: existing?.bookmarkedAt,
              playCount: existing?.playCount || 0,
              lastPlayedAt: existing?.lastPlayedAt,
            },
          },
        };
      }),
      
      trackPhrasePlay: (phraseId) => set((state) => {
        const existing = state.interactions[phraseId];
        return {
          interactions: {
            ...state.interactions,
            [phraseId]: {
              ...existing,
              phraseId,
              playCount: (existing?.playCount || 0) + 1,
              lastPlayedAt: Date.now(),
            } as UserPhraseInteraction,
          },
        };
      }),
      
      toggleBookmark: (phraseId) => set((state) => {
        const existing = state.interactions[phraseId];
        const isCurrentlyBookmarked = existing?.isBookmarked ?? false;
        
        return {
          interactions: {
            ...state.interactions,
            [phraseId]: {
              ...existing,
              phraseId,
              isBookmarked: !isCurrentlyBookmarked,
              bookmarkedAt: !isCurrentlyBookmarked ? Date.now() : undefined,
              viewCount: existing?.viewCount || 0,
              lastViewedAt: existing?.lastViewedAt || Date.now(),
              playCount: existing?.playCount || 0,
            } as UserPhraseInteraction,
          },
        };
      }),
      
      addToRecent: (phrase, context) => set((state) => {
        // Remove if already exists
        const filtered = state.recentPhrases.filter(
          (rp) => rp.phrase.id !== phrase.id
        );
        
        // Add to beginning, limit to 20
        const newRecent = [
          { phrase, accessedAt: Date.now(), context },
          ...filtered,
        ].slice(0, 20);
        
        return { recentPhrases: newRecent };
      }),
      
      clearRecent: () => set({ recentPhrases: [] }),
      
      // Actions - Voice
      setVoiceState: (voiceState) => set({ voiceState }),
      
      setVoiceSupported: (isVoiceSupported) => set({ isVoiceSupported }),
      
      // Actions - Offline
      setOfflineStatus: (status) => set((state) => ({
        offlineStatus: { ...state.offlineStatus, ...status },
      })),
      
      // Actions - Context
      setCurrentContext: (context) => set({ currentContext: context }),
      
      // Computed - Getters
      getInteraction: (phraseId) => get().interactions[phraseId],
      
      isBookmarked: (phraseId) => get().interactions[phraseId]?.isBookmarked ?? false,
      
      getBookmarkedPhrases: () => {
        const { interactions } = get();
        return Object.entries(interactions)
          .filter(([, interaction]) => interaction.isBookmarked)
          .map(([phraseId]) => phraseId);
      },
      
      getRecentPhraseIds: () => get().recentPhrases.map((rp) => rp.phrase.id),
      
      // Reset
      reset: () => set(initialState),
    }),
    {
      name: '@phrasebook_store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist these fields
        selectedDestination: state.selectedDestination,
        interactions: state.interactions,
        recentPhrases: state.recentPhrases.slice(0, 10), // Limit persisted recent
        sortBy: state.sortBy,
      }),
    }
  )
);

// ============================================
// SELECTORS (for performance optimization)
// ============================================

export const selectDestinations = (state: PhrasebookState) => state.destinations;
export const selectSelectedDestination = (state: PhrasebookState) => state.selectedDestination;
export const selectPhrasebookData = (state: PhrasebookState) => state.phrasebookData;
export const selectSearchQuery = (state: PhrasebookState) => state.searchQuery;
export const selectActiveCategory = (state: PhrasebookState) => state.activeCategory;
export const selectShowBookmarksOnly = (state: PhrasebookState) => state.showBookmarksOnly;
export const selectIsLoading = (state: PhrasebookState) => state.isLoading;
export const selectError = (state: PhrasebookState) => state.error;
export const selectInteractions = (state: PhrasebookState) => state.interactions;
export const selectRecentPhrases = (state: PhrasebookState) => state.recentPhrases;
export const selectVoiceState = (state: PhrasebookState) => state.voiceState;
export const selectCurrentContext = (state: PhrasebookState) => state.currentContext;
export const selectOfflineStatus = (state: PhrasebookState) => state.offlineStatus;

// Memoized selector factories
export const createIsBookmarkedSelector = (phraseId: string) => 
  (state: PhrasebookState) => state.interactions[phraseId]?.isBookmarked ?? false;

export const createInteractionSelector = (phraseId: string) =>
  (state: PhrasebookState) => state.interactions[phraseId];