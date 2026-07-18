/**
 * Itinerary Store
 * Zustand store for itinerary state management
 * 
 * Features:
 * - Current itinerary management
 * - Saved itineraries persistence
 * - Day/place selection
 * - Loading/error states
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Itinerary,
  ItineraryDay,
  Place,
  ItineraryRequest,
  ItineraryResponse,
  Coordinate
} from '@/types/itinerary';
import { apiService } from '@/services/api';

// ─────────────────────────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface ItineraryState {
  // Data
  currentItinerary: Itinerary | null;
  savedItineraries: Itinerary[];

  // UI State
  selectedDay: number | null;
  selectedPlace: Place | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  generateItinerary: (request: ItineraryRequest) => Promise<void>;
  selectDay: (day: number | null) => void;
  selectPlace: (place: Place | null) => void;
  saveItinerary: () => void;
  deleteItinerary: (id: string) => void;
  loadItinerary: (id: string) => void;
  reorderPlaces: (dayNumber: number, fromIndex: number, toIndex: number) => void;
  removePlace: (dayNumber: number, placeId: string) => void;
  addPlace: (dayNumber: number, place: Place) => void;
  clearCurrentItinerary: () => void;
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────

export const useItineraryStore = create<ItineraryState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentItinerary: null,
      savedItineraries: [],
      selectedDay: null,
      selectedPlace: null,
      isLoading: false,
      isGenerating: false,
      error: null,

      // ─────────────────────────────────────────────────────────
      // GENERATE ITINERARY
      // ─────────────────────────────────────────────────────────

      generateItinerary: async (request: ItineraryRequest) => {
        set({ isGenerating: true, error: null });

        try {
          const response = await apiService.post<ItineraryResponse>(
            '/itinerary/generate-optimized',
            request
          );

          const now = new Date().toISOString();

          set({
            currentItinerary: {
              ...response.itinerary,
              createdAt: response.itinerary.createdAt || now,
              updatedAt: now
            },
            selectedDay: response.itinerary.days.length > 0 ? 1 : null,
            isGenerating: false
          });
        } catch (error) {
          set({
            error: error instanceof Error
              ? error.message
              : 'Failed to generate itinerary',
            isGenerating: false
          });
        }
      },

      // ─────────────────────────────────────────────────────────
      // SELECTION ACTIONS
      // ─────────────────────────────────────────────────────────

      selectDay: (day) => set({ selectedDay: day }),

      selectPlace: (place) => set({ selectedPlace: place }),

      // ─────────────────────────────────────────────────────────
      // PERSISTENCE ACTIONS
      // ─────────────────────────────────────────────────────────

      saveItinerary: () => {
        const { currentItinerary, savedItineraries } = get();
        if (!currentItinerary) return;

        const exists = savedItineraries.find(
          (i) => i.id === currentItinerary.id
        );

        if (exists) {
          // Update existing
          set({
            savedItineraries: savedItineraries.map((i) =>
              i.id === currentItinerary.id ? currentItinerary : i
            )
          });
        } else {
          // Add new
          set({
            savedItineraries: [...savedItineraries, currentItinerary]
          });
        }
      },

      deleteItinerary: (id) => {
        set((state) => ({
          savedItineraries: state.savedItineraries.filter((i) => i.id !== id),
          // Clear current if it's the deleted one
          currentItinerary:
            state.currentItinerary?.id === id
              ? null
              : state.currentItinerary
        }));
      },

      loadItinerary: (id) => {
        const { savedItineraries } = get();
        const itinerary = savedItineraries.find((i) => i.id === id);

        if (itinerary) {
          set({
            currentItinerary: itinerary,
            selectedDay: itinerary.days.length > 0 ? 1 : null
          });
        }
      },

      // ─────────────────────────────────────────────────────────
      // MODIFICATION ACTIONS
      // ─────────────────────────────────────────────────────────

      reorderPlaces: (dayNumber, fromIndex, toIndex) => {
        const { currentItinerary } = get();
        if (!currentItinerary) return;

        const dayIndex = currentItinerary.days.findIndex(
          (d) => d.dayNumber === dayNumber
        );
        if (dayIndex === -1) return;

        const day = currentItinerary.days[dayIndex];
        const newPlaces = [...day.places];

        // Remove from old position
        const [removed] = newPlaces.splice(fromIndex, 1);
        // Insert at new position
        newPlaces.splice(toIndex, 0, removed);

        // Update day
        const updatedDays = [...currentItinerary.days];
        updatedDays[dayIndex] = {
          ...day,
          places: newPlaces
        };

        set({
          currentItinerary: {
            ...currentItinerary,
            days: updatedDays,
            updatedAt: new Date().toISOString()
          }
        });
      },

      removePlace: (dayNumber, placeId) => {
        const { currentItinerary } = get();
        if (!currentItinerary) return;

        const dayIndex = currentItinerary.days.findIndex(
          (d) => d.dayNumber === dayNumber
        );
        if (dayIndex === -1) return;

        const day = currentItinerary.days[dayIndex];
        const newPlaces = day.places.filter((p) => p.id !== placeId);

        const updatedDays = [...currentItinerary.days];
        updatedDays[dayIndex] = {
          ...day,
          places: newPlaces,
          totalVisitTime: newPlaces.reduce((sum, p) => sum + p.visitDuration, 0)
        };

        set({
          currentItinerary: {
            ...currentItinerary,
            days: updatedDays,
            totalPlaces: updatedDays.reduce((sum, d) => sum + d.places.length, 0),
            updatedAt: new Date().toISOString()
          }
        });
      },

      addPlace: (dayNumber, place) => {
        const { currentItinerary } = get();
        if (!currentItinerary) return;

        const dayIndex = currentItinerary.days.findIndex(
          (d) => d.dayNumber === dayNumber
        );
        if (dayIndex === -1) return;

        const day = currentItinerary.days[dayIndex];
        const newPlaces = [...day.places, place];

        const updatedDays = [...currentItinerary.days];
        updatedDays[dayIndex] = {
          ...day,
          places: newPlaces,
          totalVisitTime: newPlaces.reduce((sum, p) => sum + p.visitDuration, 0)
        };

        set({
          currentItinerary: {
            ...currentItinerary,
            days: updatedDays,
            totalPlaces: updatedDays.reduce((sum, d) => sum + d.places.length, 0),
            updatedAt: new Date().toISOString()
          }
        });
      },

      clearCurrentItinerary: () => {
        set({
          currentItinerary: null,
          selectedDay: null,
          selectedPlace: null
        });
      },

      clearError: () => set({ error: null })
    }),

    // ─────────────────────────────────────────────────────────────
    // PERSIST CONFIG
    // ─────────────────────────────────────────────────────────────

    {
      name: 'itinerary-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist saved itineraries
        savedItineraries: state.savedItineraries
      })
    }
  )
);

// ─────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────

export const selectCurrentDay = (state: ItineraryState): ItineraryDay | null => {
  if (!state.currentItinerary || state.selectedDay === null) return null;
  return (
    state.currentItinerary.days.find((d) => d.dayNumber === state.selectedDay) ||
    null
  );
};

export const selectAllPlaces = (state: ItineraryState): Place[] => {
  if (!state.currentItinerary) return [];
  return state.currentItinerary.days.flatMap((d) => d.places);
};

export const selectItineraryStats = (
  state: ItineraryState
): {
  totalDays: number;
  totalPlaces: number;
  totalVisitTime: number;
  totalTravelTime: number;
} | null => {
  if (!state.currentItinerary) return null;

  return {
    totalDays: state.currentItinerary.totalDays,
    totalPlaces: state.currentItinerary.totalPlaces,
    totalVisitTime: state.currentItinerary.totalVisitTime,
    totalTravelTime: state.currentItinerary.totalTravelTime
  };
};

export default useItineraryStore;