/**
 * Journal Store - Zustand State Management
 * AI Travel Memory Engine State
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  TravelNote,
  JournalDraft,
  JournalPlace,
  MoodType,
  FeedFilter,
  FeedSort,
  JournalStats,
  TravelInsight,
  Comment,
  PaginatedResponse,
} from '@/types/journal';
import journalService from '@/services/journalService';

// ─────────────────────────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface JournalState {
  // Feed State
  myNotes: TravelNote[];
  communityFeed: TravelNote[];
  trendingNotes: TravelNote[];
  savedNotes: TravelNote[];
  onThisDay: TravelNote[];
  
  // Current Note
  currentNote: TravelNote | null;
  comments: Comment[];
  
  // Drafts
  drafts: JournalDraft[];
  
  // Stats & Insights
  stats: JournalStats | null;
  insights: TravelInsight[];
  
  // Filters
  activeFilter: FeedFilter;
  activeSort: FeedSort;
  searchQuery: string;
  
  // Pagination
  myNotesCursor: string | null;
  communityCursor: string | null;
  hasMoreMyNotes: boolean;
  hasMoreCommunity: boolean;
  
  // Loading States
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  
  // Error State
  error: string | null;
  
  // View Mode
  viewMode: 'my' | 'community' | 'saved' | 'trending';
  
  // Compose Modal
  isComposeOpen: boolean;
  editingNote: TravelNote | null;
}

interface JournalActions {
  // Feed Actions
  fetchMyNotes: (refresh?: boolean) => Promise<void>;
  fetchCommunityFeed: (refresh?: boolean) => Promise<void>;
  fetchTrending: () => Promise<void>;
  fetchSavedNotes: () => Promise<void>;
  fetchOnThisDay: () => Promise<void>;
  loadMore: () => Promise<void>;
  
  // Note Actions
  fetchNote: (id: string) => Promise<void>;
  createNote: (data: {
    title: string;
    content: string;
    destination: JournalPlace;
    mood: MoodType;
    rating: number;
    isPublic: boolean;
    mediaUris?: string[];
  }) => Promise<TravelNote | null>;
  updateNote: (id: string, data: Partial<TravelNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  
  // Social Actions
  likeNote: (noteId: string) => Promise<void>;
  unlikeNote: (noteId: string) => Promise<void>;
  saveNote: (noteId: string) => Promise<void>;
  unsaveNote: (noteId: string) => Promise<void>;
  fetchComments: (noteId: string) => Promise<void>;
  addComment: (noteId: string, content: string) => Promise<void>;
  
  // Draft Actions
  fetchDrafts: () => Promise<void>;
  saveDraft: (draft: JournalDraft) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
  syncDrafts: () => Promise<void>;
  
  // Stats Actions
  fetchStats: () => Promise<void>;
  fetchInsights: () => Promise<void>;
  
  // Search & Filter
  setSearchQuery: (query: string) => void;
  setFilter: (filter: FeedFilter) => void;
  setSort: (sort: FeedSort) => void;
  setViewMode: (mode: 'my' | 'community' | 'saved' | 'trending') => void;
  
  // Modal Actions
  openCompose: (note?: TravelNote) => void;
  closeCompose: () => void;
  
  // UI Actions
  setCurrentNote: (note: TravelNote | null) => void;
  clearError: () => void;
  reset: () => void;
}

type JournalStore = JournalState & JournalActions;

// ─────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────

const initialState: JournalState = {
  myNotes: [],
  communityFeed: [],
  trendingNotes: [],
  savedNotes: [],
  onThisDay: [],
  currentNote: null,
  comments: [],
  drafts: [],
  stats: null,
  insights: [],
  activeFilter: {},
  activeSort: { field: 'created_at', order: 'desc' },
  searchQuery: '',
  myNotesCursor: null,
  communityCursor: null,
  hasMoreMyNotes: true,
  hasMoreCommunity: true,
  isLoading: false,
  isLoadingMore: false,
  isRefreshing: false,
  isSaving: false,
  isSyncing: false,
  error: null,
  viewMode: 'my',
  isComposeOpen: false,
  editingNote: null,
};

// ─────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────

export const useJournalStore = create<JournalStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ───────────────────────────────────────────────────────────
    // FEED ACTIONS
    // ───────────────────────────────────────────────────────────

    fetchMyNotes: async (refresh = false) => {
      const state = get();
      
      if (refresh) {
        set({ isRefreshing: true, myNotesCursor: null, error: null });
      } else {
        set({ isLoading: true, error: null });
      }

      try {
        const response: PaginatedResponse<TravelNote> = await journalService.getMyNotes({
          cursor: refresh ? undefined : state.myNotesCursor || undefined,
          filters: state.activeFilter,
          sort: state.activeSort,
          limit: 20,
        });

        set({
          myNotes: refresh ? response.items : [...state.myNotes, ...response.items],
          myNotesCursor: response.nextCursor || null,
          hasMoreMyNotes: response.hasMore,
          isLoading: false,
          isRefreshing: false,
        });
      } catch (error: any) {
        set({
          error: error.message || 'Failed to load notes',
          isLoading: false,
          isRefreshing: false,
        });
      }
    },

    fetchCommunityFeed: async (refresh = false) => {
      const state = get();
      
      if (refresh) {
        set({ isRefreshing: true, communityCursor: null, error: null });
      } else {
        set({ isLoading: true, error: null });
      }

      try {
        const response: PaginatedResponse<TravelNote> = await journalService.getCommunityFeed({
          cursor: refresh ? undefined : state.communityCursor || undefined,
          sort: state.activeSort,
          limit: 20,
        });

        set({
          communityFeed: refresh ? response.items : [...state.communityFeed, ...response.items],
          communityCursor: response.nextCursor || null,
          hasMoreCommunity: response.hasMore,
          isLoading: false,
          isRefreshing: false,
        });
      } catch (error: any) {
        set({
          error: error.message || 'Failed to load community feed',
          isLoading: false,
          isRefreshing: false,
        });
      }
    },

    fetchTrending: async () => {
      set({ isLoading: true, error: null });

      try {
        const notes = await journalService.getTrendingFeed(20);
        set({ trendingNotes: notes, isLoading: false });
      } catch (error: any) {
        set({
          error: error.message || 'Failed to load trending notes',
          isLoading: false,
        });
      }
    },

    fetchSavedNotes: async () => {
      set({ isLoading: true, error: null });

      try {
        const response = await journalService.getSavedNotes();
        set({ savedNotes: response.items, isLoading: false });
      } catch (error: any) {
        set({
          error: error.message || 'Failed to load saved notes',
          isLoading: false,
        });
      }
    },

    fetchOnThisDay: async () => {
      try {
        const notes = await journalService.getOnThisDay();
        set({ onThisDay: notes });
      } catch (error) {
        // Silent fail for "on this day" feature
        console.log('On this day not available');
      }
    },

    loadMore: async () => {
      const state = get();
      
      if (state.isLoadingMore) return;
      
      set({ isLoadingMore: true });

      try {
        if (state.viewMode === 'my') {
          if (!state.hasMoreMyNotes) {
            set({ isLoadingMore: false });
            return;
          }
          const response = await journalService.getMyNotes({
            cursor: state.myNotesCursor || undefined,
            filters: state.activeFilter,
            sort: state.activeSort,
            limit: 20,
          });
          set({
            myNotes: [...state.myNotes, ...response.items],
            myNotesCursor: response.nextCursor || null,
            hasMoreMyNotes: response.hasMore,
            isLoadingMore: false,
          });
        } else if (state.viewMode === 'community') {
          if (!state.hasMoreCommunity) {
            set({ isLoadingMore: false });
            return;
          }
          const response = await journalService.getCommunityFeed({
            cursor: state.communityCursor || undefined,
            sort: state.activeSort,
            limit: 20,
          });
          set({
            communityFeed: [...state.communityFeed, ...response.items],
            communityCursor: response.nextCursor || null,
            hasMoreCommunity: response.hasMore,
            isLoadingMore: false,
          });
        }
      } catch (error: any) {
        set({
          error: error.message || 'Failed to load more',
          isLoadingMore: false,
        });
      }
    },

    // ───────────────────────────────────────────────────────────
    // NOTE ACTIONS
    // ───────────────────────────────────────────────────────────

    fetchNote: async (id: string) => {
      set({ isLoading: true, error: null });

      try {
        const note = await journalService.getNote(id);
        set({ currentNote: note, isLoading: false });
      } catch (error: any) {
        set({
          error: error.message || 'Failed to load note',
          isLoading: false,
        });
      }
    },

    createNote: async (data) => {
      set({ isSaving: true, error: null });

      try {
        const note = await journalService.createNote({
          ...data,
          tripType: undefined,
          travelDate: undefined,
          tripDuration: undefined,
          linkedTripId: undefined,
        });

        set(state => ({
          myNotes: [note, ...state.myNotes],
          isSaving: false,
          isComposeOpen: false,
        }));

        // Update stats
        get().fetchStats();

        return note;
      } catch (error: any) {
        set({
          error: error.message || 'Failed to create note',
          isSaving: false,
        });
        return null;
      }
    },

    updateNote: async (id: string, data: Partial<TravelNote>) => {
      set({ isSaving: true, error: null });

      try {
        const updatedNote = await journalService.updateNote(id, data as any);

        set(state => ({
          myNotes: state.myNotes.map(n => n.id === id ? updatedNote : n),
          currentNote: state.currentNote?.id === id ? updatedNote : state.currentNote,
          isSaving: false,
          isComposeOpen: false,
          editingNote: null,
        }));

        return;
      } catch (error: any) {
        set({
          error: error.message || 'Failed to update note',
          isSaving: false,
        });
      }
    },

    deleteNote: async (id: string) => {
      set({ isLoading: true, error: null });

      try {
        await journalService.deleteNote(id);

        set(state => ({
          myNotes: state.myNotes.filter(n => n.id !== id),
          currentNote: null,
          isLoading: false,
        }));

        get().fetchStats();
      } catch (error: any) {
        set({
          error: error.message || 'Failed to delete note',
          isLoading: false,
        });
      }
    },

    // ───────────────────────────────────────────────────────────
    // SOCIAL ACTIONS
    // ───────────────────────────────────────────────────────────

    likeNote: async (noteId: string) => {
      const state = get();
      
      // Optimistic update
      const updateNote = (note: TravelNote) => ({
        ...note,
        isLiked: true,
        social: {
          ...note.social,
          likesCount: note.social.likesCount + 1,
        },
      });

      set(state => ({
        myNotes: state.myNotes.map(n => n.id === noteId ? updateNote(n) : n),
        communityFeed: state.communityFeed.map(n => n.id === noteId ? updateNote(n) : n),
        trendingNotes: state.trendingNotes.map(n => n.id === noteId ? updateNote(n) : n),
        savedNotes: state.savedNotes.map(n => n.id === noteId ? updateNote(n) : n),
        currentNote: state.currentNote?.id === noteId ? updateNote(state.currentNote) : state.currentNote,
      }));

      try {
        await journalService.likeNote(noteId);
      } catch (error) {
        // Revert on error
        const revertNote = (note: TravelNote) => ({
          ...note,
          isLiked: false,
          social: {
            ...note.social,
            likesCount: note.social.likesCount - 1,
          },
        });

        set(state => ({
          myNotes: state.myNotes.map(n => n.id === noteId ? revertNote(n) : n),
          communityFeed: state.communityFeed.map(n => n.id === noteId ? revertNote(n) : n),
          trendingNotes: state.trendingNotes.map(n => n.id === noteId ? revertNote(n) : n),
          savedNotes: state.savedNotes.map(n => n.id === noteId ? revertNote(n) : n),
          currentNote: state.currentNote?.id === noteId ? revertNote(state.currentNote) : state.currentNote,
        }));
      }
    },

    unlikeNote: async (noteId: string) => {
      // Optimistic update
      const updateNote = (note: TravelNote) => ({
        ...note,
        isLiked: false,
        social: {
          ...note.social,
          likesCount: Math.max(0, note.social.likesCount - 1),
        },
      });

      set(state => ({
        myNotes: state.myNotes.map(n => n.id === noteId ? updateNote(n) : n),
        communityFeed: state.communityFeed.map(n => n.id === noteId ? updateNote(n) : n),
        trendingNotes: state.trendingNotes.map(n => n.id === noteId ? updateNote(n) : n),
        savedNotes: state.savedNotes.map(n => n.id === noteId ? updateNote(n) : n),
        currentNote: state.currentNote?.id === noteId ? updateNote(state.currentNote) : state.currentNote,
      }));

      try {
        await journalService.unlikeNote(noteId);
      } catch (error) {
        // Revert on error
        const revertNote = (note: TravelNote) => ({
          ...note,
          isLiked: true,
          social: {
            ...note.social,
            likesCount: note.social.likesCount + 1,
          },
        });

        set(state => ({
          myNotes: state.myNotes.map(n => n.id === noteId ? revertNote(n) : n),
          communityFeed: state.communityFeed.map(n => n.id === noteId ? revertNote(n) : n),
          trendingNotes: state.trendingNotes.map(n => n.id === noteId ? revertNote(n) : n),
          savedNotes: state.savedNotes.map(n => n.id === noteId ? revertNote(n) : n),
          currentNote: state.currentNote?.id === noteId ? revertNote(state.currentNote) : state.currentNote,
        }));
      }
    },

    saveNote: async (noteId: string) => {
      // Optimistic update
      set(state => ({
        savedNotes: [...state.savedNotes, state.myNotes.find(n => n.id === noteId) || 
          state.communityFeed.find(n => n.id === noteId) || 
          state.trendingNotes.find(n => n.id === noteId)] as TravelNote[],
      }));

      try {
        await journalService.saveNote(noteId);
      } catch (error) {
        set(state => ({
          savedNotes: state.savedNotes.filter(n => n.id !== noteId),
        }));
      }
    },

    unsaveNote: async (noteId: string) => {
      set(state => ({
        savedNotes: state.savedNotes.filter(n => n.id !== noteId),
      }));

      try {
        await journalService.unsaveNote(noteId);
      } catch (error) {
        // Silent fail - user can retry
      }
    },

    fetchComments: async (noteId: string) => {
      try {
        const response = await journalService.getComments(noteId);
        set({ comments: response.items });
      } catch (error) {
        set({ comments: [] });
      }
    },

    addComment: async (noteId: string, content: string) => {
      try {
        const comment = await journalService.addComment(noteId, content);
        set(state => ({
          comments: [...state.comments, comment],
        }));
        
        // Update comment count
        const updateNote = (note: TravelNote) => ({
          ...note,
          social: {
            ...note.social,
            commentsCount: note.social.commentsCount + 1,
          },
        });

        set(state => ({
          myNotes: state.myNotes.map(n => n.id === noteId ? updateNote(n) : n),
          communityFeed: state.communityFeed.map(n => n.id === noteId ? updateNote(n) : n),
          currentNote: state.currentNote?.id === noteId ? updateNote(state.currentNote) : state.currentNote,
        }));
      } catch (error) {
        // Silent fail - user can retry
      }
    },

    // ───────────────────────────────────────────────────────────
    // DRAFT ACTIONS
    // ───────────────────────────────────────────────────────────

    fetchDrafts: async () => {
      try {
        const drafts = await journalService.getDrafts();
        set({ drafts });
      } catch (error) {
        set({ drafts: [] });
      }
    },

    saveDraft: async (draft: JournalDraft) => {
      try {
        await journalService.saveDraft(draft);
        set(state => ({
          drafts: state.drafts.some(d => d.id === draft.id)
            ? state.drafts.map(d => d.id === draft.id ? draft : d)
            : [...state.drafts, draft],
        }));
      } catch (error) {
        // Local storage failed
      }
    },

    deleteDraft: async (id: string) => {
      try {
        await journalService.deleteDraft(id);
        set(state => ({
          drafts: state.drafts.filter(d => d.id !== id),
        }));
      } catch (error) {
        // Silent fail
      }
    },

    syncDrafts: async () => {
      set({ isSyncing: true });

      try {
        const result = await journalService.syncDrafts();
        
        // Refresh drafts after sync
        const drafts = await journalService.getDrafts();
        set({ drafts, isSyncing: false });
        
        // Refresh notes if any synced
        if (result.synced > 0) {
          get().fetchMyNotes(true);
        }
      } catch (error) {
        set({ isSyncing: false });
      }
    },

    // ───────────────────────────────────────────────────────────
    // STATS ACTIONS
    // ───────────────────────────────────────────────────────────

    fetchStats: async () => {
      try {
        const stats = await journalService.getStats();
        set({ stats });
      } catch (error) {
        // Silent fail
      }
    },

    fetchInsights: async () => {
      try {
        const insights = await journalService.getInsights();
        set({ insights });
      } catch (error) {
        // Silent fail
      }
    },

    // ───────────────────────────────────────────────────────────
    // SEARCH & FILTER
    // ───────────────────────────────────────────────────────────

    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    setFilter: (filter: FeedFilter) => {
      set({ activeFilter: filter });
      // Trigger refresh
      const state = get();
      if (state.viewMode === 'my') {
        get().fetchMyNotes(true);
      }
    },

    setSort: (sort: FeedSort) => {
      set({ activeSort: sort });
      // Trigger refresh
      const state = get();
      if (state.viewMode === 'my') {
        get().fetchMyNotes(true);
      } else if (state.viewMode === 'community') {
        get().fetchCommunityFeed(true);
      }
    },

    setViewMode: (mode) => {
      set({ viewMode: mode, error: null });
      
      // Load data for new view mode
      switch (mode) {
        case 'my':
          if (get().myNotes.length === 0) get().fetchMyNotes();
          break;
        case 'community':
          if (get().communityFeed.length === 0) get().fetchCommunityFeed();
          break;
        case 'saved':
          if (get().savedNotes.length === 0) get().fetchSavedNotes();
          break;
        case 'trending':
          if (get().trendingNotes.length === 0) get().fetchTrending();
          break;
      }
    },

    // ───────────────────────────────────────────────────────────
    // MODAL ACTIONS
    // ───────────────────────────────────────────────────────────

    openCompose: (note?: TravelNote) => {
      set({ isComposeOpen: true, editingNote: note || null });
    },

    closeCompose: () => {
      set({ isComposeOpen: false, editingNote: null });
    },

    // ───────────────────────────────────────────────────────────
    // UI ACTIONS
    // ───────────────────────────────────────────────────────────

    setCurrentNote: (note) => {
      set({ currentNote: note });
    },

    clearError: () => {
      set({ error: null });
    },

    reset: () => {
      set(initialState);
    },
  }))
);

// ─────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────

export const journalSelectors = {
  // Get current feed based on view mode
  currentFeed: (state: JournalStore) => {
    switch (state.viewMode) {
      case 'my': return state.myNotes;
      case 'community': return state.communityFeed;
      case 'saved': return state.savedNotes;
      case 'trending': return state.trendingNotes;
      default: return state.myNotes;
    }
  },
  
  // Check if has more for current view
  hasMore: (state: JournalStore) => {
    switch (state.viewMode) {
      case 'my': return state.hasMoreMyNotes;
      case 'community': return state.hasMoreCommunity;
      default: return false;
    }
  },
  
  // Get notes by destination
  notesByDestination: (destination: string) => (state: JournalStore) => {
    return state.myNotes.filter(
      n => n.destination.name.toLowerCase().includes(destination.toLowerCase()) ||
           n.destination.country.toLowerCase().includes(destination.toLowerCase())
    );
  },
  
  // Get notes by mood
  notesByMood: (mood: MoodType) => (state: JournalStore) => {
    return state.myNotes.filter(n => n.mood === mood);
  },
  
  // Get featured notes
  featuredNotes: (state: JournalStore) => {
    return state.myNotes.filter(n => n.isFeatured);
  },
  
  // Stats summary
  statsSummary: (state: JournalStore) => {
    if (!state.stats) return null;
    return {
      totalTrips: state.stats.totalNotes,
      countries: state.stats.totalCountries,
      avgRating: state.stats.averageRating.toFixed(1),
      streak: state.stats.currentStreak,
    };
  },
};

export default useJournalStore;