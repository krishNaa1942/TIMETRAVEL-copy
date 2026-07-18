/**
 * Map Store (NEW)
 * ===============
 * 
 * SINGLE RESPONSIBILITY: Map state and interactions
 * 
 * This is CLIENT STATE - map region, markers, zoom, etc.
 */

import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapMarker {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title: string;
  description?: string;
  type: 'destination' | 'hotel' | 'restaurant' | 'attraction' | 'custom';
  data?: Record<string, unknown>;
}

export interface MapState {
  // Map Region
  region: MapRegion | null;
  
  // Markers
  markers: MapMarker[];
  selectedMarkerId: string | null;
  
  // Zoom Level
  zoom: number;
  
  // Map Ready State
  isMapReady: boolean;
  
  // User Tracking
  isFollowingUser: boolean;
  
  // Actions
  setRegion: (region: MapRegion) => void;
  setMarkers: (markers: MapMarker[]) => void;
  addMarker: (marker: MapMarker) => void;
  removeMarker: (id: string) => void;
  selectMarker: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setMapReady: (ready: boolean) => void;
  setFollowingUser: (following: boolean) => void;
  clearMarkers: () => void;
  animateToRegion: (region: MapRegion) => void;
}

// ─────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────

export const useMapStore = create<MapState>((set, get) => ({
  // Initial State
  region: null,
  markers: [],
  selectedMarkerId: null,
  zoom: 10,
  isMapReady: false,
  isFollowingUser: false,

  // Set Region
  setRegion: (region) => set({ region }),

  // Set Markers (replace all)
  setMarkers: (markers) => set({ markers }),

  // Add Single Marker
  addMarker: (marker) =>
    set((state) => ({
      markers: [...state.markers, marker],
    })),

  // Remove Marker
  removeMarker: (id) =>
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
      selectedMarkerId: state.selectedMarkerId === id ? null : state.selectedMarkerId,
    })),

  // Select Marker
  selectMarker: (id) => set({ selectedMarkerId: id }),

  // Set Zoom
  setZoom: (zoom) => set({ zoom }),

  // Set Map Ready
  setMapReady: (ready) => set({ isMapReady: ready }),

  // Set Following User
  setFollowingUser: (following) => set({ isFollowingUser: following }),

  // Clear Markers
  clearMarkers: () => set({ markers: [], selectedMarkerId: null }),

  // Animate To Region (stores for reference)
  animateToRegion: (region) => {
    set({ region });
    // Actual animation would be handled by map ref
  },
}));

// ─────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────

export const selectRegion = (state: MapState) => state.region;
export const selectMarkers = (state: MapState) => state.markers;
export const selectSelectedMarker = (state: MapState) =>
  state.markers.find((m) => m.id === state.selectedMarkerId) || null;
export const selectIsMapReady = (state: MapState) => state.isMapReady;
export const selectZoom = (state: MapState) => state.zoom;

export default useMapStore;