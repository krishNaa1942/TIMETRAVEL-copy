/**
 * Itinerary Service
 * POST /api/itinerary/generate – AI-powered day-by-day trip itinerary
 */

import apiService from "./api";

export interface ItineraryActivity {
  activity: string;
  place?: string;
  description: string;
  duration: string;
  cost: string;
}

export interface ItineraryBudgetEstimate {
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
}

export interface ItineraryRoutePoint {
  day: number;
  slot: "morning" | "afternoon" | "evening";
  order: number;
  place: string;
  activity: string;
  query: string;
  description: string;
  duration: string;
  cost: string;
  destination: string;
  destination_key?: string;
  coordinates?: {
    lat: number;
    lon: number;
    label?: string;
  };
  destination_coordinates?: {
    lat: number;
    lon: number;
    label?: string;
  };
}

export interface ItineraryDay {
  day: number;
  title: string;
  morning: ItineraryActivity;
  afternoon: ItineraryActivity;
  evening: ItineraryActivity;
  tip: string;
}

export interface ItineraryResponse {
  destination: string;
  num_days: number;
  family_size: number;
  travel_class: string;
  interests: string;
  itinerary: ItineraryDay[];
  budget_estimate?: ItineraryBudgetEstimate | null;
  route_points?: ItineraryRoutePoint[];
  source?: string;
  warning?: string;
  error?: string;
}

export const itineraryService = {
  async generate(
    destination: string,
    numDays: number,
    familySize: number,
    travelClass: "economy" | "comfort" | "premium" = "economy",
    interests: string = "",
  ): Promise<ItineraryResponse> {
    return apiService.post<ItineraryResponse>("/itinerary/generate", {
      destination,
      num_days: numDays,
      family_size: familySize,
      travel_class: travelClass,
      interests,
    });
  },
};

export default itineraryService;
