/**
 * Store Index
 * ===========
 * 
 * Central export point for all stores.
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    STATE ARCHITECTURE                       │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  CLIENT STATE (Zustand)        │  SERVER STATE (React Query)│
 * │  ─────────────────────         │  ───────────────────────── │
 * │  • authStore (tokens only)     │  • useDestinations()       │
 * │  • preferenceStore (filters)   │  • useItineraries()        │
 * │  • mapStore (map state)        │  • useTrips()              │
 * │  • uiStore (UI state)          │  • useFavorites()          │
 * │                                │  • useAuth() (mutations)   │
 * │  Persisted locally             │  Cached with invalidation  │
 * │                                │                            │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * WHEN TO USE WHAT:
 * 
 * CLIENT STATE (Zustand):
 * - UI state (modals, forms, selections)
 * - Auth tokens (stored securely)
 * - User preferences (local filters)
 * - Map state (region, markers)
 * 
 * SERVER STATE (React Query):
 * - Data from API endpoints
 * - Lists, details, search results
 * - User profile from server
 * - Favorites, trips, itineraries
 */

// ─────────────────────────────────────────────────────────────
// CLIENT STATE STORES (Zustand)
// ─────────────────────────────────────────────────────────────

// Auth Store - ONLY tokens and auth status (NOT user profile)
export {
  useAuthStore,
  selectAuthStatus,
  selectIsAuthenticated,
  selectIsInitializing,
  selectAuthError,
  type AuthStatus,
  type AuthState,
} from './authStore.refactored';

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

// Map Store - Map state and interactions
export {
  useMapStore,
  selectRegion,
  selectMarkers,
  selectSelectedMarker,
  selectIsMapReady,
  selectZoom,
  type MapRegion,
  type MapMarker,
  type MapState,
} from './mapStore';

// UI Store - UI state (modals, loading, etc.)
export { useUIStore } from './uiStore';

// Itinerary Store - Itinerary client state (NOT server data)
export { useItineraryStore } from './itineraryStore';

// ─────────────────────────────────────────────────────────────
// LEGACY STORES (To be migrated)
// ─────────────────────────────────────────────────────────────

// Old auth store - DEPRECATED, use authStore.refactored instead
// export { useAuthStore as useAuthStoreLegacy } from './authStore';

// Travel Intelligence Store - Needs migration to React Query
export { useTravelIntelligence } from './travelIntelligenceStore';

// ─────────────────────────────────────────────────────────────
// STORE INITIALIZATION
// ─────────────────────────────────────────────────────────────

/**
 * Initialize all stores on app startup
 * Call this in App.tsx before rendering
 */
export const initializeStores = async (): Promise<void> => {
  // Initialize auth store (load tokens from secure storage)
  const { useAuthStore } = await import('./authStore.refactored');
  await useAuthStore.getState().initialize();
  
  console.log('[Stores] All stores initialized');
};

export default {
  initializeStores,
};