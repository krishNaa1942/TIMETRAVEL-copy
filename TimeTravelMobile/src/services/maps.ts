/**
 * Maps Service (TomTom-powered)
 * Route planning, geocoding, nearby POIs, smart suggestions
 */

import apiService from "./api";

export interface MapDestination {
  name: string;
  lat: number;
  lon: number;
  label?: string;
}

export interface RouteResult {
  origin: string;
  destination: string;
  travel_mode: string;
  distance_km: number;
  duration_minutes: number;
  duration_text: string;
  summary?: string;
  geometry?: [number, number][];
}

export interface NearbyPOI {
  name: string;
  category: string;
  lat: number;
  lon: number;
  distance_m: number;
  address?: string;
  phone?: string;
}

export interface GeoResult {
  lat: number;
  lon: number;
  address: string;
  city?: string;
  country?: string;
}

export interface SmartSuggestion {
  nearest_destination: { name: string; distance_km: number } | null;
  suggestions: Record<string, NearbyPOI[]>;
  location: { lat: number; lon: number };
}

export const mapsService = {
  async getConfig(): Promise<{ key: string; available: boolean }> {
    return apiService.get("/maps/config");
  },

  async getDestinations(): Promise<MapDestination[]> {
    const res = await apiService.get<{ destinations: MapDestination[] }>("/maps/destinations");
    return res.destinations;
  },

  async geocode(query: string): Promise<GeoResult | null> {
    try {
      return await apiService.get<GeoResult>(`/maps/geocode?q=${encodeURIComponent(query)}`);
    } catch { return null; }
  },

  async getRoute(from: string, to: string, mode: string = "car"): Promise<RouteResult> {
    const params = new URLSearchParams({ from, to, mode });
    return apiService.get<RouteResult>(`/maps/route?${params}`);
  },

  async getNearby(dest: string, category?: string, limit?: number): Promise<NearbyPOI[]> {
    const params = new URLSearchParams({ dest });
    if (category) params.append("category", category);
    if (limit) params.append("limit", String(limit));
    const res = await apiService.get<{ pois: NearbyPOI[] }>(`/maps/nearby?${params}`);
    return res.pois;
  },

  async getSuggestions(lat: number, lon: number): Promise<SmartSuggestion> {
    return apiService.get(`/maps/suggest?lat=${lat}&lon=${lon}`);
  },

  async reverseGeocode(lat: number, lon: number): Promise<GeoResult & { nearest_destination?: any }> {
    return apiService.get(`/maps/reverse?lat=${lat}&lon=${lon}`);
  },
};

export default mapsService;
