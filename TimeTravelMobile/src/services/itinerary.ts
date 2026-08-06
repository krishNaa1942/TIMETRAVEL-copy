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
  destination_coordinates?: {
    lat: number;
    lon: number;
    label?: string;
  } | null;
  source?: string;
  warning?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// v2: background generation jobs
// ─────────────────────────────────────────────────────────────

export type ItineraryJobStatus =
  | "queued"
  | "running"
  | "cancelling"
  | "done"
  | "error"
  | "cancelled";

export interface ItineraryJobSnapshot {
  id: string;
  status: ItineraryJobStatus;
  step: string;
  progress: number;
  day_count: number;
  itinerary: ItineraryDay[];
  error?: string | null;
  params: Record<string, unknown>;
  result?: ItineraryResponse;
  created_at: number;
  updated_at: number;
}

export interface CreateItineraryJobPayload {
  query?: string;
  destination?: string;
  num_days?: number;
  family_size?: number;
  travel_class?: "economy" | "comfort" | "premium";
  interests?: string;
}

export interface BulkSavePlacePayload {
  name: string;
  category?: string;
  notes?: string;
  position_order?: number;
  lat?: number;
  lon?: number;
  duration_minutes?: number;
  estimated_cost?: number;
}

export interface BulkSaveDayPayload {
  day_number: number;
  title: string;
  notes?: string;
  date?: string;
  places: BulkSavePlacePayload[];
}

export interface BulkSaveTripPayload {
  trip: {
    title: string;
    destination: string;
    num_days: number;
    family_size: number;
    travel_class: string;
    start_date?: string;
    end_date?: string;
    notes?: string;
  };
  source_id: string;
  itinerary_payload?: ItineraryResponse;
  days: BulkSaveDayPayload[];
}

export interface BulkSaveTripResult {
  trip: {
    id: number;
    title: string;
    destination: string;
    days: Array<{ id: number; day_number: number; places?: Array<{ id: number }> }>;
    duplicate?: boolean;
  };
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

  /** Start a background generation job (202 + job_id). Server parses the query. */
  async createJob(
    payload: CreateItineraryJobPayload,
  ): Promise<{ job_id: string; status: ItineraryJobStatus }> {
    return apiService.post<{ job_id: string; status: ItineraryJobStatus }>(
      "/itinerary/jobs",
      payload,
    );
  },

  /** Poll a job's live status/streamed days/result. */
  async getJob(jobId: string): Promise<ItineraryJobSnapshot> {
    return apiService.get<ItineraryJobSnapshot>(`/itinerary/jobs/${jobId}`);
  },

  /** Request cancellation of a running job. */
  async cancelJob(jobId: string): Promise<{ job_id: string; cancelled: boolean }> {
    return apiService.post<{ job_id: string; cancelled: boolean }>(
      `/itinerary/jobs/${jobId}/cancel`,
      {},
    );
  },

  /** Persist a generated itinerary as a Trip + Days + Places in one call. */
  async bulkSaveTrip(payload: BulkSaveTripPayload): Promise<BulkSaveTripResult> {
    return apiService.post<BulkSaveTripResult>("/trips/planner/bulk", payload);
  },
};

export default itineraryService;
