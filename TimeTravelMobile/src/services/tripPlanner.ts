/**
 * Trip Planner Service — Full CRUD for trip workspace
 * Backend: /api/trips/planner
 */
import apiService from "./api";

export interface TripPlace {
  id: number;
  name: string;
  address?: string;
  lat?: number;
  lon?: number;
  category?: string;
  notes?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  estimated_cost?: number;
  image_url?: string;
  rating?: number;
  day_id?: number;
  position_order?: number;
  is_booked?: boolean;
}

export interface TripDay {
  id: number;
  day_number: number;
  date?: string;
  title: string;
  notes?: string;
  places?: TripPlace[];
}

export interface TripData {
  id: number;
  title: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  num_days: number;
  family_size: number;
  travel_class: string;
  cover_image_url?: string;
  notes?: string;
  status: string;
  budget_total?: number;
  is_public?: boolean;
  days?: TripDay[];
  companions?: any[];
  reservations?: any[];
  created_at?: string;
  updated_at?: string;
}

export const tripPlannerService = {
  async createTrip(data: {
    title: string;
    destination: string;
    num_days?: number;
    start_date?: string;
    end_date?: string;
    family_size?: number;
    travel_class?: string;
    notes?: string;
  }): Promise<{ trip: TripData }> {
    return apiService.post("/trips/planner", data);
  },

  async listTrips(status?: string): Promise<{ trips: TripData[] }> {
    const q = status ? `?status=${status}` : "";
    return apiService.get(`/trips/planner${q}`);
  },

  async getTrip(tripId: number): Promise<{ trip: TripData }> {
    return apiService.get(`/trips/planner/${tripId}`);
  },

  async updateTrip(tripId: number, data: Partial<TripData>): Promise<{ trip: TripData }> {
    return apiService.put(`/trips/planner/${tripId}`, data);
  },

  async deleteTrip(tripId: number): Promise<void> {
    return apiService.delete(`/trips/planner/${tripId}`);
  },

  async addDay(tripId: number, data?: { title?: string; notes?: string; date?: string }): Promise<{ day: TripDay }> {
    return apiService.post(`/trips/planner/${tripId}/days`, data || {});
  },

  async updateDay(tripId: number, dayId: number, data: { title?: string; notes?: string }): Promise<{ day: TripDay }> {
    return apiService.put(`/trips/planner/${tripId}/days/${dayId}`, data);
  },

  async addPlace(tripId: number, data: Partial<TripPlace>): Promise<{ place: TripPlace }> {
    return apiService.post(`/trips/planner/${tripId}/places`, data);
  },

  async updatePlace(tripId: number, placeId: number, data: Partial<TripPlace>): Promise<{ place: TripPlace }> {
    return apiService.put(`/trips/planner/${tripId}/places/${placeId}`, data);
  },

  async deletePlace(tripId: number, placeId: number): Promise<void> {
    return apiService.delete(`/trips/planner/${tripId}/places/${placeId}`);
  },

  async addCompanion(tripId: number, data: { name: string; email?: string; phone?: string; role?: string }): Promise<any> {
    return apiService.post(`/trips/planner/${tripId}/companions`, data);
  },

  async removeCompanion(tripId: number, compId: number): Promise<void> {
    return apiService.delete(`/trips/planner/${tripId}/companions/${compId}`);
  },
};

export default tripPlannerService;
