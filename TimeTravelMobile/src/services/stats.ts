/**
 * Travel Stats Service
 * Backend: /api/stats
 */
import apiService from "./api";

export interface TravelStats {
  trips: { total: number; planning: number; active: number; completed: number };
  destinations_visited: number;
  places_visited: number;
  total_travel_days: number;
  total_spent: number;
  spending_breakdown: Record<string, number>;
  reservations: { total: number; by_type: Record<string, number> };
  photos_uploaded: number;
  favorites_count: number;
  top_destinations: { destination: string; trips: number }[];
  budget_by_trip: { trip: string; budget: number }[];
  place_categories: Record<string, number>;
}

export const statsService = {
  async getStats(): Promise<{ stats: TravelStats }> {
    return apiService.get("/stats");
  },
};

export default statsService;
