/**
 * Enhanced Journal Service - AI Travel Memory Engine
 * Full CRUD + Social + Media + Offline + AI Integration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './api';
import journalAIService from './journalAI';
import {
  TravelNote,
  JournalDraft,
  JournalPlace,
  MoodType,
  AIAnalysis,
  Comment,
  PaginatedResponse,
  FeedFilter,
  FeedSort,
  JournalStats,
  TravelInsight,
  MediaItem,
} from '@/types/journal';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const DRAFTS_KEY = '@journal_drafts';
const CACHE_KEY = '@journal_cache';
const STATS_KEY = '@journal_stats';
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface CreateNoteInput {
  title: string;
  content: string;
  destination: JournalPlace;
  mood: MoodType;
  rating: number;
  isPublic: boolean;
  tripType?: string;
  travelDate?: string;
  tripDuration?: number;
  mediaUris?: string[];
  linkedTripId?: string;
}

interface SearchParams {
  query?: string;
  filters?: FeedFilter;
  sort?: FeedSort;
  cursor?: string;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// MEDIA HANDLING
// ─────────────────────────────────────────────────────────────

// Image compression - simplified for web compatibility
async function compressImage(uri: string): Promise<string> {
  // Return as-is for now - can be enhanced with expo-image-manipulator on native
  return uri;
}

async function uploadMedia(uri: string, type: 'image' | 'video'): Promise<MediaItem | null> {
  try {
    const compressedUri = type === 'image' ? await compressImage(uri) : uri;
    
    const formData = new FormData();
    formData.append('file', {
      uri: compressedUri,
      type: type === 'image' ? 'image/jpeg' : 'video/mp4',
      name: `journal_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`,
    } as any);
    
    const response = await apiService.post<MediaItem>('/journal/media', formData);
    return response;
  } catch (error) {
    console.error('Media upload failed:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// DRAFT MANAGEMENT (Offline-First)
// ─────────────────────────────────────────────────────────────

async function getDrafts(): Promise<JournalDraft[]> {
  try {
    const data = await AsyncStorage.getItem(DRAFTS_KEY);
    if (!data) return [];
    
    const drafts: JournalDraft[] = JSON.parse(data);
    // Filter out expired drafts
    const now = Date.now();
    return drafts.filter(d => now - new Date(d.lastSaved).getTime() < DRAFT_TTL);
  } catch {
    return [];
  }
}

async function saveDraft(draft: JournalDraft): Promise<void> {
  const drafts = await getDrafts();
  const index = drafts.findIndex(d => d.id === draft.id);
  
  if (index >= 0) {
    drafts[index] = { ...draft, lastSaved: new Date().toISOString() };
  } else {
    drafts.push({ ...draft, lastSaved: new Date().toISOString() });
  }
  
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

async function deleteDraft(draftId: string): Promise<void> {
  const drafts = await getDrafts();
  const filtered = drafts.filter(d => d.id !== draftId);
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered));
}

// ─────────────────────────────────────────────────────────────
// MAIN SERVICE
// ─────────────────────────────────────────────────────────────

export const journalService = {
  // ───────────────────────────────────────────────────────────
  // CRUD OPERATIONS
  // ───────────────────────────────────────────────────────────

  async createNote(input: CreateNoteInput): Promise<TravelNote> {
    // Upload media first
    const mediaItems: MediaItem[] = [];
    if (input.mediaUris && input.mediaUris.length > 0) {
      for (const uri of input.mediaUris) {
        const media = await uploadMedia(uri, 'image');
        if (media) mediaItems.push(media);
      }
    }

    // Get AI analysis
    const aiAnalysis = journalAIService.analyzeLocal(
      input.content,
      input.destination,
      input.mood
    );

    const response = await apiService.post<{ note: TravelNote }>('/journal/notes', {
      title: input.title,
      content: input.content,
      destination: input.destination,
      mood: input.mood,
      rating: input.rating,
      is_public: input.isPublic,
      trip_type: input.tripType,
      travel_date: input.travelDate,
      trip_duration: input.tripDuration,
      media: mediaItems,
      ai_analysis: aiAnalysis,
      linked_trip_id: input.linkedTripId,
    });

    return response.note;
  },

  async getNote(id: string): Promise<TravelNote> {
    const response = await apiService.get<{ note: TravelNote }>(`/journal/notes/${id}`);
    return response.note;
  },

  async updateNote(id: string, data: Partial<CreateNoteInput>): Promise<TravelNote> {
    // Handle media uploads if provided
    let mediaItems: MediaItem[] | undefined;
    if (data.mediaUris && data.mediaUris.length > 0) {
      mediaItems = [];
      for (const uri of data.mediaUris) {
        const media = await uploadMedia(uri, 'image');
        if (media) mediaItems.push(media);
      }
    }

    // Re-run AI analysis if content changed
    let aiAnalysis: AIAnalysis | undefined;
    if (data.content) {
      aiAnalysis = journalAIService.analyzeLocal(
        data.content,
        data.destination,
        data.mood
      );
    }

    const response = await apiService.put<{ note: TravelNote }>(`/journal/notes/${id}`, {
      ...data,
      media: mediaItems,
      ai_analysis: aiAnalysis,
    });

    return response.note;
  },

  async deleteNote(id: string): Promise<void> {
    await apiService.delete(`/journal/notes/${id}`);
  },

  // ───────────────────────────────────────────────────────────
  // FEED & DISCOVERY
  // ───────────────────────────────────────────────────────────

  async getMyNotes(params?: SearchParams): Promise<PaginatedResponse<TravelNote>> {
    const queryParams = new URLSearchParams();
    if (params?.cursor) queryParams.set('cursor', params.cursor);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.query) queryParams.set('q', params.query);
    if (params?.filters?.mood) queryParams.set('mood', params.filters.mood);
    if (params?.filters?.rating) queryParams.set('rating', params.filters.rating.toString());

    const response = await apiService.get<PaginatedResponse<TravelNote>>(
      `/journal/notes?${queryParams.toString()}`
    );
    return response;
  },

  async getCommunityFeed(params?: SearchParams): Promise<PaginatedResponse<TravelNote>> {
    const queryParams = new URLSearchParams();
    if (params?.cursor) queryParams.set('cursor', params.cursor);
    if (params?.limit) queryParams.set('limit', (params.limit || 20).toString());
    if (params?.sort?.field) queryParams.set('sort', params.sort.field);
    if (params?.sort?.order) queryParams.set('order', params.sort.order);

    const response = await apiService.get<PaginatedResponse<TravelNote>>(
      `/journal/community?${queryParams.toString()}`
    );
    return response;
  },

  async getTrendingFeed(limit: number = 20): Promise<TravelNote[]> {
    const response = await apiService.get<{ notes: TravelNote[] }>(
      `/journal/trending?limit=${limit}`
    );
    return response.notes || [];
  },

  async searchNotes(query: string, filters?: FeedFilter): Promise<TravelNote[]> {
    const queryParams = new URLSearchParams({ q: query });
    if (filters?.destination) queryParams.set('destination', filters.destination);
    if (filters?.mood) queryParams.set('mood', filters.mood);
    if (filters?.tripType) queryParams.set('trip_type', filters.tripType);

    const response = await apiService.get<{ notes: TravelNote[] }>(
      `/journal/search?${queryParams.toString()}`
    );
    return response.notes || [];
  },

  // ───────────────────────────────────────────────────────────
  // SOCIAL INTERACTIONS
  // ───────────────────────────────────────────────────────────

  async likeNote(noteId: string): Promise<void> {
    await apiService.post(`/journal/notes/${noteId}/like`, {});
  },

  async unlikeNote(noteId: string): Promise<void> {
    await apiService.delete(`/journal/notes/${noteId}/like`);
  },

  async getComments(noteId: string, cursor?: string): Promise<PaginatedResponse<Comment>> {
    const query = cursor ? `?cursor=${cursor}` : '';
    const response = await apiService.get<PaginatedResponse<Comment>>(
      `/journal/notes/${noteId}/comments${query}`
    );
    return response;
  },

  async addComment(noteId: string, content: string): Promise<Comment> {
    const response = await apiService.post<{ comment: Comment }>(
      `/journal/notes/${noteId}/comments`,
      { content }
    );
    return response.comment;
  },

  async deleteComment(noteId: string, commentId: string): Promise<void> {
    await apiService.delete(`/journal/notes/${noteId}/comments/${commentId}`);
  },

  async likeComment(noteId: string, commentId: string): Promise<void> {
    await apiService.post(`/journal/notes/${noteId}/comments/${commentId}/like`, {});
  },

  async shareNote(noteId: string): Promise<string> {
    const response = await apiService.post<{ shareUrl: string }>(
      `/journal/notes/${noteId}/share`,
      {}
    );
    return response.shareUrl;
  },

  async saveNote(noteId: string): Promise<void> {
    await apiService.post(`/journal/notes/${noteId}/save`, {});
  },

  async unsaveNote(noteId: string): Promise<void> {
    await apiService.delete(`/journal/notes/${noteId}/save`);
  },

  async getSavedNotes(cursor?: string): Promise<PaginatedResponse<TravelNote>> {
    const query = cursor ? `?cursor=${cursor}` : '';
    const response = await apiService.get<PaginatedResponse<TravelNote>>(
      `/journal/saved${query}`
    );
    return response;
  },

  // ───────────────────────────────────────────────────────────
  // USER & FOLLOWING
  // ───────────────────────────────────────────────────────────

  async followUser(userId: string): Promise<void> {
    await apiService.post(`/users/${userId}/follow`, {});
  },

  async unfollowUser(userId: string): Promise<void> {
    await apiService.delete(`/users/${userId}/follow`);
  },

  async getUserNotes(userId: string, cursor?: string): Promise<PaginatedResponse<TravelNote>> {
    const query = cursor ? `?cursor=${cursor}` : '';
    const response = await apiService.get<PaginatedResponse<TravelNote>>(
      `/users/${userId}/notes${query}`
    );
    return response;
  },

  // ───────────────────────────────────────────────────────────
  // DRAFTS (Offline-First)
  // ───────────────────────────────────────────────────────────

  getDrafts,
  saveDraft,
  deleteDraft,

  async syncDrafts(): Promise<{ synced: number; failed: number }> {
    const drafts = await getDrafts();
    let synced = 0;
    let failed = 0;

    for (const draft of drafts) {
      if (draft.syncStatus === 'pending') {
        try {
          await this.createNote({
            title: draft.title,
            content: draft.content,
            destination: draft.destination!,
            mood: draft.mood,
            rating: draft.rating,
            isPublic: draft.isPublic,
            mediaUris: draft.mediaUris,
          });
          await deleteDraft(draft.id);
          synced++;
        } catch {
          failed++;
        }
      }
    }

    return { synced, failed };
  },

  // ───────────────────────────────────────────────────────────
  // AI FEATURES
  // ───────────────────────────────────────────────────────────

  async analyzeContent(
    content: string,
    destination?: JournalPlace,
    mood?: MoodType
  ): Promise<AIAnalysis> {
    // Try backend first, fallback to local
    try {
      return await journalAIService.analyzeWithBackend(content, destination, mood);
    } catch {
      return journalAIService.analyzeLocal(content, destination, mood);
    }
  },

  async getSmartSummary(noteId: string): Promise<string> {
    const response = await apiService.get<{ summary: string }>(
      `/journal/notes/${noteId}/summary`
    );
    return response.summary;
  },

  async getRecommendations(noteId: string): Promise<{ places: JournalPlace[]; tips: string[] }> {
    const response = await apiService.get<{ places: JournalPlace[]; tips: string[] }>(
      `/journal/notes/${noteId}/recommendations`
    );
    return response;
  },

  // ───────────────────────────────────────────────────────────
  // INSIGHTS & ANALYTICS
  // ───────────────────────────────────────────────────────────

  async getStats(): Promise<JournalStats> {
    try {
      const response = await apiService.get<JournalStats>('/journal/stats');
      return response;
    } catch {
      // Return cached stats if available
      const cached = await AsyncStorage.getItem(STATS_KEY);
      if (cached) return JSON.parse(cached);
      
      // Return default stats
      return {
        totalNotes: 0,
        totalWords: 0,
        totalCountries: 0,
        totalCities: 0,
        averageRating: 0,
        mostVisitedCountry: '',
        mostFrequentMood: 'neutral',
        currentStreak: 0,
        longestStreak: 0,
        totalLikes: 0,
        totalComments: 0,
      };
    }
  },

  async getInsights(): Promise<TravelInsight[]> {
    const response = await apiService.get<{ insights: TravelInsight[] }>('/journal/insights');
    return response.insights || [];
  },

  async getOnThisDay(): Promise<TravelNote[]> {
    const response = await apiService.get<{ notes: TravelNote[] }>('/journal/on-this-day');
    return response.notes || [];
  },

  // ───────────────────────────────────────────────────────────
  // GAMIFICATION
  // ───────────────────────────────────────────────────────────

  async getAchievements(): Promise<{ achievements: any[]; level: any }> {
    const response = await apiService.get<{ achievements: any[]; level: any }>(
      '/journal/achievements'
    );
    return response;
  },

  // ───────────────────────────────────────────────────────────
  // PLACES AUTOCOMPLETE
  // ───────────────────────────────────────────────────────────

  async searchPlaces(query: string): Promise<JournalPlace[]> {
    if (!query.trim()) return [];
    
    try {
      const response = await apiService.get<{ places: JournalPlace[] }>(
        `/places/autocomplete?q=${encodeURIComponent(query)}`
      );
      return response.places || [];
    } catch {
      return [];
    }
  },
};

export default journalService;