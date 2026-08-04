/**
 * Enhanced Journal Service - AI Travel Memory Engine
 * Full CRUD + Social + Media + Offline + AI Integration
 *
 * Backend contract: /api/notes (notes blueprint).
 * Social / community / gamification endpoints are not implemented
 * server-side yet — those calls degrade gracefully instead of erroring.
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
// NORMALIZATION (backend note → rich TravelNote shape)
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _normalizeNote = (note: any): TravelNote => ({
  id: String(note.id),
  userId: String(note.user_id ?? ''),
  title: note.title ?? '',
  content: note.content ?? '',
  destination:
    typeof note.destination === 'string'
      ? {
          id: note.destination,
          name: note.destination,
          country: 'India',
          lat: 0,
          lng: 0,
        }
      : note.destination,
  mood: (note.mood as MoodType) || 'neutral',
  rating: Number(note.rating ?? 0),
  isPublic: Boolean(note.is_public),
  media: [],
  autoTags: [],
  social: {
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 0,
    viewsCount: 0,
  },
  createdAt: note.created_at ?? new Date().toISOString(),
  updatedAt: note.created_at ?? new Date().toISOString(),
});

const _toPaginated = <T,>(items: T[]): PaginatedResponse<T> => ({
  items,
  nextCursor: undefined,
  hasMore: false,
  total: items.length,
});

// ─────────────────────────────────────────────────────────────
// MEDIA HANDLING
// ─────────────────────────────────────────────────────────────

// Image compression - simplified for web compatibility
async function compressImage(uri: string): Promise<string> {
  // Return as-is for now - can be enhanced with expo-image-manipulator on native
  return uri;
}

async function uploadMedia(_uri: string, _type: 'image' | 'video'): Promise<MediaItem | null> {
  // No journal media endpoint on the backend yet; degrade gracefully.
  return null;
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
  // CRUD OPERATIONS (backend: /api/notes)
  // ───────────────────────────────────────────────────────────

  async createNote(input: CreateNoteInput): Promise<TravelNote> {
    // Get AI analysis
    const aiAnalysis = journalAIService.analyzeLocal(
      input.content,
      input.destination,
      input.mood
    );

    const response = await apiService.post<{ note: any }>('/notes', {
      title: input.title,
      content: input.content,
      destination: input.destination.name ?? input.destination,
      mood: input.mood,
      rating: input.rating,
      is_public: input.isPublic,
      trip_type: input.tripType,
      travel_date: input.travelDate,
      trip_duration: input.tripDuration,
      ai_analysis: aiAnalysis,
      linked_trip_id: input.linkedTripId,
    });

    return _normalizeNote(response.note);
  },

  async getNote(id: string): Promise<TravelNote> {
    const response = await apiService.get<{ note: any }>(`/notes/${id}`);
    return _normalizeNote(response.note);
  },

  async updateNote(id: string, data: Partial<CreateNoteInput>): Promise<TravelNote> {
    // Re-run AI analysis if content changed
    let aiAnalysis: AIAnalysis | undefined;
    if (data.content) {
      aiAnalysis = journalAIService.analyzeLocal(
        data.content,
        data.destination,
        data.mood
      );
    }

    const response = await apiService.put<{ note: any }>(`/notes/${id}`, {
      title: data.title,
      content: data.content,
      destination:
        typeof data.destination === 'string'
          ? data.destination
          : data.destination?.name,
      mood: data.mood,
      rating: data.rating,
      is_public: data.isPublic,
      ai_analysis: aiAnalysis,
    });

    return _normalizeNote(response.note);
  },

  async deleteNote(id: string): Promise<void> {
    await apiService.delete(`/notes/${id}`);
  },

  // ───────────────────────────────────────────────────────────
  // FEED & DISCOVERY
  // ───────────────────────────────────────────────────────────

  async getMyNotes(params?: SearchParams): Promise<PaginatedResponse<TravelNote>> {
    const queryParams = new URLSearchParams();
    if (params?.filters?.destination) {
      queryParams.set('destination', params.filters.destination);
    }

    const response = await apiService.get<{ notes: any[] }>(
      `/notes?${queryParams.toString()}`
    );
    const notes = (response.notes || []).map(_normalizeNote);

    if (params?.filters?.mood) {
      return _toPaginated(notes.filter(n => n.mood === params.filters?.mood));
    }
    if (params?.query) {
      const q = params.query.toLowerCase();
      return _toPaginated(
        notes.filter(
          n =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.destination.name.toLowerCase().includes(q)
        )
      );
    }
    return _toPaginated(notes);
  },

  async getCommunityFeed(_params?: SearchParams): Promise<PaginatedResponse<TravelNote>> {
    const response = await apiService.get<{ notes: any[] }>('/notes/community');
    return _toPaginated((response.notes || []).map(_normalizeNote));
  },

  async getTrendingFeed(_limit: number = 20): Promise<TravelNote[]> {
    // No server-side trending; fall back to community feed.
    const response = await apiService.get<{ notes: any[] }>('/notes/community');
    return (response.notes || []).slice(0, _limit).map(_normalizeNote);
  },

  async searchNotes(query: string, filters?: FeedFilter): Promise<TravelNote[]> {
    const response = await apiService.get<{ notes: any[] }>(
      filters?.destination
        ? `/notes?destination=${encodeURIComponent(filters.destination)}`
        : '/notes'
    );
    const q = query.toLowerCase();
    return (response.notes || [])
      .map(_normalizeNote)
      .filter(
        n =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.destination.name.toLowerCase().includes(q)
      );
  },

  // ───────────────────────────────────────────────────────────
  // SOCIAL INTERACTIONS (unsupported server-side; degrade)
  // ───────────────────────────────────────────────────────────

  async likeNote(_noteId: string): Promise<void> {
    // Social endpoints not implemented on the backend yet.
  },

  async unlikeNote(_noteId: string): Promise<void> {},

  async getComments(_noteId: string, _cursor?: string): Promise<PaginatedResponse<Comment>> {
    return _toPaginated<Comment>([]);
  },

  async addComment(_noteId: string, _content: string): Promise<Comment> {
    throw new Error('Comments are not available yet');
  },

  async deleteComment(_noteId: string, _commentId: string): Promise<void> {},

  async likeComment(_noteId: string, _commentId: string): Promise<void> {},

  async shareNote(_noteId: string): Promise<string> {
    return `timetravel://journal/${_noteId}`;
  },

  async saveNote(_noteId: string): Promise<void> {},

  async unsaveNote(_noteId: string): Promise<void> {},

  async getSavedNotes(_cursor?: string): Promise<PaginatedResponse<TravelNote>> {
    return _toPaginated<TravelNote>([]);
  },

  // ───────────────────────────────────────────────────────────
  // USER & FOLLOWING (unsupported server-side; degrade)
  // ───────────────────────────────────────────────────────────

  async followUser(_userId: string): Promise<void> {},

  async unfollowUser(_userId: string): Promise<void> {},

  async getUserNotes(_userId: string, _cursor?: string): Promise<PaginatedResponse<TravelNote>> {
    return _toPaginated<TravelNote>([]);
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
    const note = await this.getNote(noteId);
    return note.content.length > 0 ? note.content.slice(0, 160) : '';
  },

  async getRecommendations(_noteId: string): Promise<{ places: JournalPlace[]; tips: string[] }> {
    return { places: [], tips: [] };
  },

  // ───────────────────────────────────────────────────────────
  // INSIGHTS & ANALYTICS
  // ───────────────────────────────────────────────────────────

  async getStats(): Promise<JournalStats> {
    try {
      const response = await apiService.get<{ notes: any[] }>('/notes');
      const notes = (response.notes || []).map(_normalizeNote);

      const totalNotes = notes.length;
      const totalWords = notes.reduce((sum, n) => sum + n.content.split(/\s+/).filter(Boolean).length, 0);
      const countries = new Set(notes.map(n => n.destination.country || n.destination.name));
      const ratings = notes.filter(n => n.rating > 0).map(n => n.rating);
      const moods = notes.filter(n => n.mood).map(n => n.mood);
      const mostFrequentMood =
        moods.length === 0
          ? 'neutral'
          : moods.sort(
              (a, b) =>
                moods.filter(m => m === b).length - moods.filter(m => m === a).length
            )[0];

      const byCountry = new Map<string, number>();
      notes.forEach(n => {
        const c = n.destination.country || n.destination.name;
        byCountry.set(c, (byCountry.get(c) || 0) + 1);
      });
      const mostVisitedCountry =
        byCountry.size === 0
          ? ''
          : [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0][0];

      return {
        totalNotes,
        totalWords,
        totalCountries: countries.size,
        totalCities: notes.length,
        averageRating:
          ratings.length === 0
            ? 0
            : Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10,
        mostVisitedCountry,
        mostFrequentMood: mostFrequentMood as MoodType,
        currentStreak: 0,
        longestStreak: 0,
        totalLikes: 0,
        totalComments: 0,
      };
    } catch {
      // Return cached stats if available
      const cached = await AsyncStorage.getItem(STATS_KEY);
      if (cached) return JSON.parse(cached);

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
    return [];
  },

  async getOnThisDay(): Promise<TravelNote[]> {
    try {
      const response = await apiService.get<{ notes: any[] }>('/notes');
      const today = new Date();
      return (response.notes || [])
        .filter(n => {
          if (!n.created_at) return false;
          const d = new Date(n.created_at);
          return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
        })
        .map(_normalizeNote);
    } catch {
      return [];
    }
  },

  // ───────────────────────────────────────────────────────────
  // GAMIFICATION (unsupported server-side; degrade)
  // ───────────────────────────────────────────────────────────

  async getAchievements(): Promise<{ achievements: any[]; level: any }> {
    return {
      achievements: [],
      level: { level: 1, xp: 0, xpToNext: 100, title: 'Explorer' },
    };
  },

  // ───────────────────────────────────────────────────────────
  // PLACES AUTOCOMPLETE (via destinations search)
  // ───────────────────────────────────────────────────────────

  async searchPlaces(query: string): Promise<JournalPlace[]> {
    if (!query.trim()) return [];

    try {
      const response = await apiService.get<{ destinations: any[] }>(
        `/destinations?query=${encodeURIComponent(query)}&limit=8`
      );
      return (response.destinations || []).map(d => ({
        id: String(d.id),
        name: d.label ?? d.name ?? '',
        city: d.region ?? undefined,
        country: d.country ?? 'India',
        lat: Number(d.lat ?? 0),
        lng: Number(d.lon ?? 0),
        placeId: String(d.id),
      }));
    } catch {
      return [];
    }
  },
};

export default journalService;
