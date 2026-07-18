/**
 * Compare Service
 * GET /api/compare?dest1=Goa&dest2=Jaipur&days=5&family=4&class=economy
 */

import apiService from "./api";

export interface CompareProfile {
  destination: string;
  budget: {
    destination: string;
    num_days: number;
    family_size: number;
    travel_class: string;
    accommodation: number;
    food: number;
    transport: number;
    activities: number;
    miscellaneous: number;
    total: number;
    currency: string;
  };
  safety: {
    destination: string;
    overall_score: number;
    crime: number;
    health: number;
    infrastructure: number;
    tourist_friendly: number;
    advisory: string;
  };
  weather: {
    destination: string;
    temperature_c: number;
    feels_like_c: number;
    humidity: number;
    description: string;
    wind_speed_kmh: number;
  } | null;
}

export interface CompareResult {
  dest1: CompareProfile;
  dest2: CompareProfile;
  params: { num_days: number; family_size: number; travel_class: string };
}

export const compareService = {
  async compare(
    dest1: string,
    dest2: string,
    days: number = 5,
    family: number = 4,
    travelClass: string = "economy"
  ): Promise<CompareResult> {
    const params = new URLSearchParams({
      dest1, dest2,
      days: String(days),
      family: String(family),
      class: travelClass,
    });
    return apiService.get<CompareResult>(`/compare?${params}`);
  },
};

export default compareService;
