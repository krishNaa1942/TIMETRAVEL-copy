/**
 * Places Service (Foursquare-powered)
 * Search, recommend, detail places
 */

import apiService from "./api";

export interface Place {
  fsq_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  category: string;
  rating?: number;
  popularity?: number;
  is_open?: boolean;
  distance?: number;
  price_level?: string;
  recommended_for?: string;
}

export const placesService = {
  async search(lat: number, lon: number, category?: string, query?: string): Promise<Place[]> {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    if (category) params.append("category", category);
    if (query) params.append("query", query);
    const res = await apiService.get<{ places: Place[] }>(`/places/search?${params}`);
    return res.places;
  },

  async recommend(lat: number, lon: number, situation?: string): Promise<{ places: Place[]; reasons: string[] }> {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    if (situation) params.append("situation", situation);
    return apiService.get(`/places/recommend?${params}`);
  },

  async getCategories(): Promise<string[]> {
    const res = await apiService.get<{ categories: string[] }>("/places/categories");
    return res.categories;
  },

  async checkStatus(): Promise<boolean> {
    try {
      const res = await apiService.get<{ available: boolean }>("/places/status");
      return res.available;
    } catch { return false; }
  },
};

export default placesService;
