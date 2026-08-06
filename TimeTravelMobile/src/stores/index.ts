/**
 * Store Index
 * ===========
 *
 * Central export point for all stores.
 */

// ─────────────────────────────────────────────────────────────
// CLIENT STATE STORES (Zustand)
// ─────────────────────────────────────────────────────────────

import { offlineQueue } from '@/services/offlineQueue';
import { useAuthStore } from './authStore';

// Auth Store - ONLY tokens and auth status (NOT user profile)
export { useAuthStore };
export type { AuthStore, User } from './authStore';

// Preference Store - Client-side preferences and filters
export {
  usePreferenceStore,
  selectPreferences,
  selectDestinationFilters,
  selectItineraryFilters,
  selectViewMode,
  selectUserLocation,
  selectRecentSearches,
  type UserPreferences,
  type FilterState,
  type TravelStyle,
  type BudgetLevel,
  type Season,
  type GroupType,
  type SortBy,
  type ViewMode,
} from './preferenceStore';

// UI Store - UI state (modals, loading, etc.)
export { useUIStore } from './uiStore';

// Travel Intelligence Store
export { useTravelIntelligence } from './travelIntelligenceStore';

// ─────────────────────────────────────────────────────────────
// STORE INITIALIZATION
// ─────────────────────────────────────────────────────────────

/**
 * Initialize all stores on app startup
 * Call this in App.tsx before rendering
 */
export const initializeStores = async (): Promise<void> => {
  await useAuthStore.getState().loadAuthState();
  await offlineQueue.initialize();
  console.log('[Stores] All stores initialized');
};

export default {
  initializeStores,
};
