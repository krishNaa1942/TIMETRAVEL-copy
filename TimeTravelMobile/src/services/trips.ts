/**
 * Trips Service
 * ==============
 * Full integration with backend /api/trips endpoints.
 * Manages saved trip history and trip creation.
 */

import apiService from "./api";
import { Trip } from "@/types";

export interface CreateTripPayload {
  destination: string;
  title?: string;
  num_days: number;
  family_size: number;
  travel_class: "economy" | "comfort" | "premium";
  start_date?: string;
  end_date?: string;
  status?: "planning" | "active" | "completed";
  budget_total?: number;
  notes?: string;
}

export interface UpdateTripPayload {
  title?: string;
  destination?: string;
  num_days?: number;
  family_size?: number;
  travel_class?: "economy" | "comfort" | "premium";
  start_date?: string;
  end_date?: string;
  status?: "planning" | "active" | "completed";
  budget_total?: number;
  notes?: string;
}

export const tripsService = {
  /** List all trips for the logged-in user */
  async getTrips(): Promise<Trip[]> {
    const response = await apiService.get<{ trips: Trip[] }>("/trips");
    return response.trips;
  },

  /** Get a single trip by ID */
  async getTrip(id: number): Promise<Trip> {
    return apiService.get<Trip>(`/trips/${id}`);
  },

  /** Create a new trip */
  async createTrip(data: CreateTripPayload): Promise<Trip> {
    return apiService.post<Trip>("/trips", data);
  },

  /** Update an existing trip */
  async updateTrip(id: number, data: UpdateTripPayload): Promise<Trip> {
    return apiService.put<Trip>(`/trips/${id}`, data);
  },

  /** Delete a trip */
  async deleteTrip(id: number): Promise<void> {
    await apiService.delete(`/trips/${id}`);
  },

  /** Get trips by status */
  async getTripsByStatus(status: "planning" | "active" | "completed"): Promise<Trip[]> {
    const response = await apiService.get<{ trips: Trip[] }>(`/trips?status=${status}`);
    return response.trips;
  },

  /** Duplicate a trip (create a copy) */
  async duplicateTrip(id: number): Promise<Trip> {
    return apiService.post<Trip>(`/trips/${id}/duplicate`, {});
  },
};

export default tripsService;