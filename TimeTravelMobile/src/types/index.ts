/**
 * Shared TypeScript interfaces for TimeTravelMobile
 * Mirrors the Flask API response shapes.
 */

// ── Destinations ──────────────────────────────────────────────
export interface Destination {
  id: string;
  label: string;
  region: string;
  best_season: string;
  highlight: string;
  tagline: string;
  category: string[];
  image?: string;
  imageUrl?: string;
  lat: number;
  lon: number;
  // Extended properties (from API)
  rating?: number;
  popularity?: number;
  budgetLevel?: "budget" | "mid-range" | "luxury";
  isFavorite?: boolean;
  priceRange?: {
    min: number;
    max: number;
    currency: string;
  };
}

// ── Weather ───────────────────────────────────────────────────
export interface WeatherData {
  destination: string;
  temperature_c: number;
  feels_like_c: number;
  humidity: number;
  description: string;
  wind_speed_kmh: number;
  packing_suggestions: string[];
}

// ── Safety ────────────────────────────────────────────────────
export interface SafetyData {
  destination: string;
  overall_score: number;
  crime_score: number;
  health_score: number;
  infrastructure_score: number;
  tourist_friendliness: number;
  advisory: string;
}

// ── Chat ──────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: number;
}

export interface ChatResponse {
  reply: string;
  intent: string;
  confidence: number;
  model: string;
  mode: string;
  session_id: string;
  error_type?: string;
  fallback_from?: string;
}

// ── Trips ─────────────────────────────────────────────────────
export interface Trip {
  id: number;
  destination: string;
  num_days: number;
  family_size: number;
  travel_class: string;
  estimated_budget: number | null;
  accommodation: number | null;
  food: number | null;
  transport: number | null;
  activities: number | null;
  miscellaneous: number | null;
  created_at: string;
}

// ── Budget ────────────────────────────────────────────────────
export interface BudgetEstimate {
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

// ── Images (Unsplash) ─────────────────────────────────────────
export interface UnsplashImage {
  id: string;
  url_full: string;
  url_regular: string;
  url_small: string;
  url_thumb: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  color: string;
  width: number;
  height: number;
  unsplash_url: string;
}

// ── Navigation param types ────────────────────────────────────
export interface CompareRouteParams {
  dest1?: string;
  dest2?: string;
  days?: number;
  familySize?: number;
  travelClass?: string;
  priority?:
    | "budget"
    | "safety"
    | "weather"
    | "balanced"
    | "crowd"
    | "experience";
}

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  DestinationDetail: { destination: Destination };
  Budget: { destination?: Destination };
  Itinerary: { query?: string };
  Packing: undefined;
  Favorites: undefined;
  Currency: undefined;
  Compare: CompareRouteParams | undefined;
  Places: undefined;
  RoutePlanner: undefined;
  TripWorkspace: undefined;
  Expenses: undefined;
  TravelJournal: undefined;
  Reservations: undefined;
  TripSharing: undefined;
  NewsFeed: undefined;
  TravelStats: undefined;
  Phrasebook: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Explore: undefined;
  Chat: undefined;
  Trips: undefined;
  Profile: undefined;
};
