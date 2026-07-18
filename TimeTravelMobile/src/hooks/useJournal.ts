/**
 * useJournal - Custom Hook for Journal Operations
 * High-level hook combining store actions with AI features
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useJournalStore, journalSelectors } from '@/stores/journalStore';
import { TravelNote, JournalDraft, JournalPlace, MoodType, FeedFilter } from '@/types/journal';
import journalAIService from '@/services/journalAI';

// ─────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────

export function useJournal() {
  const store = useJournalStore();

  // Load initial data
  useEffect(() => {
    if (store.myNotes.length === 0 && !store.isLoading) {
      store.fetchMyNotes();
      store.fetchStats();
      store.fetchDrafts();
      store.fetchOnThisDay();
    }
  }, []);

  // Current feed based on view mode
  const currentFeed = useMemo(() => {
    return journalSelectors.currentFeed(store);
  }, [store.myNotes, store.communityFeed, store.savedNotes, store.trendingNotes, store.viewMode]);

  // Stats summary
  const statsSummary = useMemo(() => {
    return journalSelectors.statsSummary(store);
  }, [store.stats]);

  // Refresh current feed
  const refresh = useCallback(async () => {
    switch (store.viewMode) {
      case 'my':
        await store.fetchMyNotes(true);
        break;
      case 'community':
        await store.fetchCommunityFeed(true);
        break;
      case 'saved':
        await store.fetchSavedNotes();
        break;
      case 'trending':
        await store.fetchTrending();
        break;
    }
  }, [store.viewMode]);

  return {
    // State
    notes: currentFeed,
    currentNote: store.currentNote,
    comments: store.comments,
    drafts: store.drafts,
    stats: store.stats,
    statsSummary,
    insights: store.insights,
    onThisDay: store.onThisDay,
    
    // View state
    viewMode: store.viewMode,
    searchQuery: store.searchQuery,
    activeFilter: store.activeFilter,
    
    // Loading states
    isLoading: store.isLoading,
    isLoadingMore: store.isLoadingMore,
    isRefreshing: store.isRefreshing,
    isSaving: store.isSaving,
    isSyncing: store.isSyncing,
    
    // Error
    error: store.error,
    
    // Pagination
    hasMore: journalSelectors.hasMore(store),
    
    // Compose modal
    isComposeOpen: store.isComposeOpen,
    editingNote: store.editingNote,
    
    // Actions
    refresh,
    loadMore: store.loadMore,
    setViewMode: store.setViewMode,
    setSearchQuery: store.setSearchQuery,
    setFilter: store.setFilter,
    
    // Note actions
    fetchNote: store.fetchNote,
    createNote: store.createNote,
    updateNote: store.updateNote,
    deleteNote: store.deleteNote,
    
    // Social actions
    likeNote: store.likeNote,
    unlikeNote: store.unlikeNote,
    saveNote: store.saveNote,
    unsaveNote: store.unsaveNote,
    fetchComments: store.fetchComments,
    addComment: store.addComment,
    
    // Draft actions
    saveDraft: store.saveDraft,
    deleteDraft: store.deleteDraft,
    syncDrafts: store.syncDrafts,
    
    // Modal
    openCompose: store.openCompose,
    closeCompose: store.closeCompose,
    
    // Utils
    clearError: store.clearError,
  };
}

// ─────────────────────────────────────────────────────────────
// USE JOURNAL NOTE
// ─────────────────────────────────────────────────────────────

export function useJournalNote(noteId: string | null) {
  const store = useJournalStore();

  // Load note if not already loaded
  useEffect(() => {
    if (noteId && (!store.currentNote || store.currentNote.id !== noteId)) {
      store.fetchNote(noteId);
      store.fetchComments(noteId);
    }
  }, [noteId]);

  // Like toggle
  const toggleLike = useCallback(async () => {
    if (!store.currentNote) return;
    
    if (store.currentNote.isLiked) {
      await store.unlikeNote(store.currentNote.id);
    } else {
      await store.likeNote(store.currentNote.id);
    }
  }, [store.currentNote]);

  // Save toggle
  const toggleSave = useCallback(async () => {
    if (!store.currentNote) return;
    
    const isSaved = store.savedNotes.some(n => n.id === store.currentNote?.id);
    if (isSaved) {
      await store.unsaveNote(store.currentNote.id);
    } else {
      await store.saveNote(store.currentNote.id);
    }
  }, [store.currentNote, store.savedNotes]);

  return {
    note: store.currentNote,
    comments: store.comments,
    isLoading: store.isLoading,
    isLiked: store.currentNote?.isLiked || false,
    isSaved: store.savedNotes.some(n => n.id === noteId),
    
    toggleLike,
    toggleSave,
    fetchComments: store.fetchComments,
    addComment: store.addComment,
    
    // Edit
    openEdit: () => store.openCompose(store.currentNote || undefined),
    deleteNote: store.deleteNote,
  };
}

// ─────────────────────────────────────────────────────────────
// USE JOURNAL COMPOSER
// ─────────────────────────────────────────────────────────────

export function useJournalComposer() {
  const store = useJournalStore();
  
  // Local composer state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [destination, setDestination] = useState<JournalPlace | null>(null);
  const [mood, setMood] = useState<MoodType>('happy');
  const [rating, setRating] = useState(5);
  const [isPublic, setIsPublic] = useState(true);
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  
  // AI analysis (real-time)
  const aiAnalysis = useMemo(() => {
    if (content.length < 10) return null;
    return journalAIService.analyzeLocal(content, destination || undefined, mood);
  }, [content, destination, mood]);
  
  // Quality score
  const qualityScore = useMemo(() => {
    return journalAIService.calculateQualityScore(
      content,
      mediaUris.length > 0,
      destination !== null,
      rating
    );
  }, [content, mediaUris, destination, rating]);
  
  // Suggested mood from content
  const suggestedMood = useMemo(() => {
    if (content.length < 20) return null;
    return journalAIService.detectMood(content);
  }, [content]);
  
  // Can submit
  const canSubmit = useMemo(() => {
    return title.trim().length >= 3 && 
           content.trim().length >= 10 && 
           destination !== null &&
           !store.isSaving;
  }, [title, content, destination, store.isSaving]);
  
  // Submit
  const submit = useCallback(async () => {
    if (!canSubmit || !destination) return null;
    
    const note = await store.createNote({
      title: title.trim(),
      content: content.trim(),
      destination,
      mood,
      rating,
      isPublic,
      mediaUris,
    });
    
    if (note) {
      // Reset form
      setTitle('');
      setContent('');
      setDestination(null);
      setMood('happy');
      setRating(5);
      setIsPublic(true);
      setMediaUris([]);
    }
    
    return note;
  }, [title, content, destination, mood, rating, isPublic, mediaUris, canSubmit]);
  
  // Save as draft
  const saveAsDraft = useCallback(async () => {
    if (!destination) return;
    
    const draft: JournalDraft = {
      id: Date.now().toString(),
      title: title.trim() || 'Untitled',
      content: content.trim(),
      destination,
      mood,
      rating,
      mediaUris,
      isPublic,
      lastSaved: new Date().toISOString(),
      syncStatus: 'pending',
    };
    
    await store.saveDraft(draft);
  }, [title, content, destination, mood, rating, mediaUris, isPublic]);

  return {
    // Form state
    title, setTitle,
    content, setContent,
    destination, setDestination,
    mood, setMood,
    rating, setRating,
    isPublic, setIsPublic,
    mediaUris, setMediaUris,
    
    // AI features
    aiAnalysis,
    qualityScore,
    suggestedMood,
    
    // Validation
    canSubmit,
    
    // Status
    isSaving: store.isSaving,
    isOpen: store.isComposeOpen,
    editingNote: store.editingNote,
    
    // Actions
    submit,
    saveAsDraft,
    close: store.closeCompose,
    
    // Helpers
    addMedia: (uri: string) => setMediaUris((prev: string[]) => [...prev, uri]),
    removeMedia: (index: number) => setMediaUris((prev: string[]) => prev.filter((_, i) => i !== index)),
  };
}

// ─────────────────────────────────────────────────────────────
// USE JOURNAL STATS
// ─────────────────────────────────────────────────────────────

export function useJournalStats() {
  const store = useJournalStore();

  useEffect(() => {
    if (!store.stats) {
      store.fetchStats();
      store.fetchInsights();
    }
  }, []);

  // Milestones
  const milestones = useMemo(() => {
    if (!store.stats) return [];
    
    const results = [];
    
    if (store.stats.totalNotes >= 1) {
      results.push({ icon: '✈️', label: 'First Journey', unlocked: true });
    }
    if (store.stats.totalCountries >= 5) {
      results.push({ icon: '🌍', label: 'Globe Trotter', unlocked: true });
    }
    if (store.stats.totalNotes >= 10) {
      results.push({ icon: '📚', label: 'Storyteller', unlocked: true });
    }
    if (store.stats.longestStreak >= 7) {
      results.push({ icon: '🔥', label: 'Week Streak', unlocked: true });
    }
    
    return results;
  }, [store.stats]);

  // Next milestone
  const nextMilestone = useMemo(() => {
    if (!store.stats) return null;
    
    if (store.stats.totalNotes < 1) {
      return { label: 'First Journey', progress: 0, target: 1 };
    }
    if (store.stats.totalCountries < 5) {
      return { label: 'Globe Trotter', progress: store.stats.totalCountries, target: 5 };
    }
    if (store.stats.totalNotes < 10) {
      return { label: 'Storyteller', progress: store.stats.totalNotes, target: 10 };
    }
    
    return null;
  }, [store.stats]);

  return {
    stats: store.stats,
    insights: store.insights,
    milestones,
    nextMilestone,
    isLoading: store.isLoading,
    refresh: () => {
      store.fetchStats();
      store.fetchInsights();
    },
  };
}

// ─────────────────────────────────────────────────────────────
// USE JOURNAL SEARCH
// ─────────────────────────────────────────────────────────────

export function useJournalSearch() {
  const store = useJournalStore();
  const [results, setResults] = useState<TravelNote[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!store.searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    const timer = setTimeout(async () => {
      // First search in local notes
      const localResults = store.myNotes.filter(n =>
        n.title.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
        n.destination.name.toLowerCase().includes(store.searchQuery.toLowerCase())
      );
      
      setResults(localResults);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [store.searchQuery, store.myNotes]);

  return {
    query: store.searchQuery,
    setQuery: store.setSearchQuery,
    results,
    isSearching,
    clearSearch: () => store.setSearchQuery(''),
  };
}

export default useJournal;