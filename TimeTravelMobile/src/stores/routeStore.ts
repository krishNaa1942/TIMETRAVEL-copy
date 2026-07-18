/**
 * Route Intelligence Store
 * Centralized state management for routing with AI personalization
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PlaceResult,
  Route,
  RoutePreferences,
  TravelMode,
  TrafficInfo,
  SmartStop,
  PredictiveResult,
  NavigationState,
  NavigationStatus,
  RouteBehavior,
  RecentPlace,
  DEFAULT_PREFERENCES,
} from '@/types/route';
import { routeService } from '@/services/routeService';

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface RouteState {
  // Places
  origin: PlaceResult | null;
  destination: PlaceResult | null;
  waypoints: PlaceResult[];
  recentPlaces: RecentPlace[];

  // Routes
  routes: Route[];
  selectedRouteId: string | null;
  recommendedRouteId: string | null;

  // Preferences
  preferences: RoutePreferences;
  travelMode: TravelMode;

  // Traffic & Stops
  traffic: TrafficInfo | null;
  smartStops: SmartStop[];
  predictions: PredictiveResult | null;

  // Navigation
  navigation: NavigationState;

  // UI State
  isLoading: boolean;
  isSearching: boolean;
  searchQuery: string;
  searchResults: PlaceResult[];
  activeInputField: 'origin' | 'destination' | null;
  error: string | null;

  // User Behavior (for personalization)
  behavior: RouteBehavior;

  // ───────────────────────────────────────────────────────────
  // ACTIONS
  // ───────────────────────────────────────────────────────────

  // Place Selection
  setOrigin: (place: PlaceResult | null) => void;
  setDestination: (place: PlaceResult | null) => void;
  addWaypoint: (place: PlaceResult) => void;
  removeWaypoint: (index: number) => void;
  reorderWaypoints: (fromIndex: number, toIndex: number) => void;
  swapOriginDestination: () => void;
  clearPlaces: () => void;

  // Search
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: PlaceResult[]) => void;
  setActiveInputField: (field: 'origin' | 'destination' | null) => void;
  searchPlaces: (query: string, near?: { lat: number; lng: number }) => Promise<void>;
  selectSearchResult: (place: PlaceResult) => void;

  // Routes
  computeRoutes: () => Promise<void>;
  selectRoute: (routeId: string) => void;
  clearRoutes: () => void;

  // Preferences
  setPreferences: (prefs: Partial<RoutePreferences>) => void;
  setTravelMode: (mode: TravelMode) => void;

  // Smart Stops
  loadSmartStops: () => Promise<void>;

  // Predictions
  loadPredictions: () => Promise<void>;

  // Navigation
  startNavigation: () => void;
  stopNavigation: () => void;
  updateNavigationProgress: (stepIndex: number, distanceRemaining: number, timeRemaining: number) => void;
  handleOffRoute: () => void;

  // Behavior Tracking
  trackRouteSelection: (route: Route) => void;
  trackModeChange: (mode: TravelMode) => void;
  trackRouteSwitch: (fromRouteId: string, toRouteId: string) => void;
  trackCancellation: () => void;

  // Recent Places
  loadRecentPlaces: () => Promise<void>;

  // Error Handling
  setError: (error: string | null) => void;
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────
// INITIAL BEHAVIOR STATE
// ─────────────────────────────────────────────────────────────

const initialBehavior: RouteBehavior = {
  user_id: '',
  preferred_modes: { car: 0, bike: 0, walk: 0, transit: 0 },
  toll_avoidance_rate: 0,
  highway_avoidance_rate: 0,
  scenic_preference_rate: 0,
  eco_preference_rate: 0,
  avg_departure_hour: 9,
  route_switch_count: 0,
  cancellation_count: 0,
  frequent_routes: [],
};

// ─────────────────────────────────────────────────────────────
// CREATE STORE
// ─────────────────────────────────────────────────────────────

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      // Initial State
      origin: null,
      destination: null,
      waypoints: [],
      recentPlaces: [],
      routes: [],
      selectedRouteId: null,
      recommendedRouteId: null,
      preferences: DEFAULT_PREFERENCES,
      travelMode: 'car',
      traffic: null,
      smartStops: [],
      predictions: null,
      navigation: {
        status: 'idle',
        active_route: null,
        current_step_index: 0,
        distance_remaining_meters: 0,
        time_remaining_seconds: 0,
        next_step: null,
        is_off_route: false,
      },
      isLoading: false,
      isSearching: false,
      searchQuery: '',
      searchResults: [],
      activeInputField: null,
      error: null,
      behavior: initialBehavior,

      // ─────────────────────────────────────────────────────────
      // PLACE SELECTION
      // ─────────────────────────────────────────────────────────

      setOrigin: (place) => {
        set({ origin: place });
        if (place) {
          routeService.addRecentPlace(place);
          get().loadRecentPlaces();
        }
      },

      setDestination: (place) => {
        set({ destination: place });
        if (place) {
          routeService.addRecentPlace(place);
          get().loadRecentPlaces();
        }
      },

      addWaypoint: (place) => {
        set((state) => ({
          waypoints: [...state.waypoints, place],
        }));
      },

      removeWaypoint: (index) => {
        set((state) => ({
          waypoints: state.waypoints.filter((_, i) => i !== index),
        }));
      },

      reorderWaypoints: (fromIndex, toIndex) => {
        set((state) => {
          const newWaypoints = [...state.waypoints];
          const [removed] = newWaypoints.splice(fromIndex, 1);
          newWaypoints.splice(toIndex, 0, removed);
          return { waypoints: newWaypoints };
        });
      },

      swapOriginDestination: () => {
        set((state) => ({
          origin: state.destination,
          destination: state.origin,
          routes: [],
          selectedRouteId: null,
        }));
      },

      clearPlaces: () => {
        set({
          origin: null,
          destination: null,
          waypoints: [],
          routes: [],
          selectedRouteId: null,
          recommendedRouteId: null,
          traffic: null,
          smartStops: [],
          predictions: null,
        });
      },

      // ─────────────────────────────────────────────────────────
      // SEARCH
      // ─────────────────────────────────────────────────────────

      setSearchQuery: (query) => set({ searchQuery: query }),

      setSearchResults: (results) => set({ searchResults: results }),

      setActiveInputField: (field) => set({ activeInputField: field }),

      searchPlaces: async (query, near) => {
        // Safe null/undefined handling
        const safeQuery = typeof query === 'string' ? query.trim() : '';
        if (!safeQuery) {
          set({ searchResults: [], isSearching: false });
          return;
        }

        set({ isSearching: true, searchQuery: query });

        try {
          const results = await routeService.searchPlaces(query, near);
          set({ searchResults: results, isSearching: false });
        } catch (error) {
          set({ searchResults: [], isSearching: false });
        }
      },

      selectSearchResult: (place) => {
        const { activeInputField } = get();

        if (activeInputField === 'origin') {
          set({ origin: place, activeInputField: null, searchQuery: '', searchResults: [] });
          routeService.addRecentPlace(place);
        } else if (activeInputField === 'destination') {
          set({ destination: place, activeInputField: null, searchQuery: '', searchResults: [] });
          routeService.addRecentPlace(place);
        }

        get().loadRecentPlaces();
      },

      // ─────────────────────────────────────────────────────────
      // ROUTES
      // ─────────────────────────────────────────────────────────

      computeRoutes: async () => {
        const { origin, destination, travelMode, preferences, waypoints } = get();

        if (!origin || !destination) {
          set({ error: 'Please select both origin and destination' });
          return;
        }

        set({ isLoading: true, error: null, routes: [] });

        try {
          const response = await routeService.computeRoutes({
            origin: origin.location,
            destination: destination.location,
            waypoints: waypoints.map(w => w.location),
            mode: travelMode,
            preferences,
          });

          set({
            routes: response.routes,
            recommendedRouteId: response.recommended_route_id,
            selectedRouteId: response.recommended_route_id,
            isLoading: false,
          });

          // Load traffic and predictions
          const selectedRoute = response.routes.find(r => r.id === response.recommended_route_id);
          if (selectedRoute) {
            set({ traffic: selectedRoute.traffic });
            get().loadPredictions();
            get().loadSmartStops();
          }
        } catch (error: any) {
          set({
            error: error.message || 'Failed to compute routes',
            isLoading: false,
          });
        }
      },

      selectRoute: (routeId) => {
        const { routes } = get();
        const route = routes.find(r => r.id === routeId);

        if (route) {
          set({ selectedRouteId: routeId, traffic: route.traffic });
          get().loadPredictions();
          get().loadSmartStops();

          // Track selection for personalization
          get().trackRouteSelection(route);
        }
      },

      clearRoutes: () => {
        set({
          routes: [],
          selectedRouteId: null,
          recommendedRouteId: null,
          traffic: null,
          smartStops: [],
          predictions: null,
        });
      },

      // ─────────────────────────────────────────────────────────
      // PREFERENCES
      // ─────────────────────────────────────────────────────────

      setPreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        }));
      },

      setTravelMode: (mode) => {
        set({ travelMode: mode });
        get().trackModeChange(mode);
      },

      // ─────────────────────────────────────────────────────────
      // SMART STOPS
      // ─────────────────────────────────────────────────────────

      loadSmartStops: async () => {
        const { routes, selectedRouteId } = get();
        const selectedRoute = routes.find(r => r.id === selectedRouteId);

        if (!selectedRoute) return;

        try {
          const stops = await routeService.findSmartStops(selectedRoute);
          set({ smartStops: stops });
        } catch (error) {
          console.error('Failed to load smart stops:', error);
        }
      },

      // ─────────────────────────────────────────────────────────
      // PREDICTIONS
      // ─────────────────────────────────────────────────────────

      loadPredictions: async () => {
        const { routes, selectedRouteId } = get();
        const selectedRoute = routes.find(r => r.id === selectedRouteId);

        if (!selectedRoute) return;

        try {
          const predictions = await routeService.predictDepartureImpact(selectedRoute);
          set({ predictions });
        } catch (error) {
          console.error('Failed to load predictions:', error);
        }
      },

      // ─────────────────────────────────────────────────────────
      // NAVIGATION
      // ─────────────────────────────────────────────────────────

      startNavigation: () => {
        const { routes, selectedRouteId } = get();
        const activeRoute = routes.find(r => r.id === selectedRouteId);

        if (!activeRoute) return;

        set({
          navigation: {
            status: 'navigating',
            active_route: activeRoute,
            current_step_index: 0,
            distance_remaining_meters: activeRoute.metrics.distance_meters,
            time_remaining_seconds: activeRoute.metrics.duration_with_traffic_seconds,
            next_step: activeRoute.legs[0]?.steps[0] || null,
            is_off_route: false,
          },
        });
      },

      stopNavigation: () => {
        set({
          navigation: {
            status: 'idle',
            active_route: null,
            current_step_index: 0,
            distance_remaining_meters: 0,
            time_remaining_seconds: 0,
            next_step: null,
            is_off_route: false,
          },
        });
      },

      updateNavigationProgress: (stepIndex, distanceRemaining, timeRemaining) => {
        const { navigation, routes, selectedRouteId } = get();
        const activeRoute = routes.find(r => r.id === selectedRouteId);

        if (!activeRoute) return;

        // Get current step
        let currentStep = null;
        for (const leg of activeRoute.legs) {
          if (stepIndex < leg.steps.length) {
            currentStep = leg.steps[stepIndex];
            break;
          }
        }

        set({
          navigation: {
            ...navigation,
            current_step_index: stepIndex,
            distance_remaining_meters: distanceRemaining,
            time_remaining_seconds: timeRemaining,
            next_step: currentStep,
            status: distanceRemaining < 50 ? 'arrived' : 'navigating',
          },
        });
      },

      handleOffRoute: () => {
        const { navigation } = get();

        set({
          navigation: {
            ...navigation,
            status: 'rerouting',
            is_off_route: true,
            last_reroute_at: new Date().toISOString(),
          },
        });

        // Recompute routes after a delay
        setTimeout(() => {
          get().computeRoutes();
        }, 1000);
      },

      // ─────────────────────────────────────────────────────────
      // BEHAVIOR TRACKING
      // ─────────────────────────────────────────────────────────

      trackRouteSelection: (route) => {
        set((state) => {
          const behavior = { ...state.behavior };
          behavior.preferred_modes[state.travelMode] = (behavior.preferred_modes[state.travelMode] || 0) + 1;

          if (route.metrics.toll_cost_inr === 0) behavior.toll_avoidance_rate += 0.1;
          if (state.preferences.ecoFriendly) behavior.eco_preference_rate += 0.1;
          if (state.preferences.scenic) behavior.scenic_preference_rate += 0.1;

          // Track frequent routes
          const existingRoute = behavior.frequent_routes.find(
            r => r.origin_name === route.origin.name && r.destination_name === route.destination.name
          );
          if (existingRoute) {
            existingRoute.count += 1;
          } else {
            behavior.frequent_routes.push({
              origin_name: route.origin.name,
              destination_name: route.destination.name,
              count: 1,
            });
          }

          // Keep only top 10
          behavior.frequent_routes = behavior.frequent_routes
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          return { behavior };
        });
      },

      trackModeChange: (mode) => {
        set((state) => ({
          behavior: {
            ...state.behavior,
            preferred_modes: {
              ...state.behavior.preferred_modes,
              [mode]: (state.behavior.preferred_modes[mode] || 0) + 1,
            },
          },
        }));
      },

      trackRouteSwitch: (fromRouteId, toRouteId) => {
        set((state) => ({
          behavior: {
            ...state.behavior,
            route_switch_count: state.behavior.route_switch_count + 1,
          },
        }));
      },

      trackCancellation: () => {
        set((state) => ({
          behavior: {
            ...state.behavior,
            cancellation_count: state.behavior.cancellation_count + 1,
          },
        }));
      },

      // ─────────────────────────────────────────────────────────
      // RECENT PLACES
      // ─────────────────────────────────────────────────────────

      loadRecentPlaces: async () => {
        try {
          const places = await routeService.getRecentPlaces();
          set({ recentPlaces: places });
        } catch (error) {
          console.error('Failed to load recent places:', error);
        }
      },

      // ─────────────────────────────────────────────────────────
      // ERROR HANDLING
      // ─────────────────────────────────────────────────────────

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'route-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        behavior: state.behavior,
        recentPlaces: state.recentPlaces,
      }),
    }
  )
);

// ─────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────

export const selectSelectedRoute = (state: RouteState) =>
  state.routes.find(r => r.id === state.selectedRouteId);

export const selectRecommendedRoute = (state: RouteState) =>
  state.routes.find(r => r.id === state.recommendedRouteId);

export const selectCanCompute = (state: RouteState) =>
  state.origin !== null && state.destination !== null;

export const selectIsNavigating = (state: RouteState) =>
  state.navigation.status === 'navigating';

export const selectRouteAlternatives = (state: RouteState) => {
  const selected = state.selectedRouteId;
  return state.routes
    .filter(r => r.id !== selected)
    .map(route => ({
      route,
      difference: {
        time_minutes: route.metrics.duration_minutes - (state.routes.find(r => r.id === selected)?.metrics.duration_minutes || 0),
        distance_km: route.metrics.distance_km - (state.routes.find(r => r.id === selected)?.metrics.distance_km || 0),
        cost_inr: route.metrics.total_cost_inr - (state.routes.find(r => r.id === selected)?.metrics.total_cost_inr || 0),
      },
      is_recommended: route.id === state.recommendedRouteId,
    }));
};