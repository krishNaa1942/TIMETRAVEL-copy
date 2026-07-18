/**
 * Services Index - Unified Export
 * ================================
 * Central export for all API services.
 * This provides a single import point for all backend integrations.
 */

// ─────────────────────────────────────────────────────────────
// 🔐 BULLETPROOF API CLIENT (NEW - USE THIS)
// ─────────────────────────────────────────────────────────────
export { apiClient, tokenManager, ApiError } from "./apiClient";
export type { TokenPair, ApiErrorDetails } from "./apiClient";

// ─────────────────────────────────────────────────────────────
// 🔐 PRODUCTION AUTH SERVICE (JWT-based)
// ─────────────────────────────────────────────────────────────
export { authServiceV2 } from "./authV2";
export type { LoginCredentials, RegisterData, AuthResponse } from "./authV2";

// ─────────────────────────────────────────────────────────────
// LEGACY API (Backward Compatibility)
// ─────────────────────────────────────────────────────────────
export { apiService, ApiError as LegacyApiError } from "./api";
export { authService } from "./auth";
export type { LoginPayload, RegisterPayload } from "./auth";

// ─────────────────────────────────────────────────────────────
// DESTINATIONS & PLACES
// ─────────────────────────────────────────────────────────────
export { destinationsService } from "./destinations";
export { placesService } from "./places";

// ─────────────────────────────────────────────────────────────
// TRIP MANAGEMENT
// ─────────────────────────────────────────────────────────────
export { tripsService } from "./trips";
export type { CreateTripPayload, UpdateTripPayload } from "./trips";
export { tripPlannerService } from "./tripPlanner";
export { itineraryService } from "./itinerary";
export type {
  ItineraryActivity,
  ItineraryDay,
  ItineraryResponse,
} from "./itinerary";

// ─────────────────────────────────────────────────────────────
// BUDGET & EXPENSES
// ─────────────────────────────────────────────────────────────
export { budgetService } from "./budget";
export { expenseService } from "./expenses";
export type { Expense, ExpenseSummary } from "./expenses";

// ─────────────────────────────────────────────────────────────
// TRAVEL INTELLIGENCE
// ─────────────────────────────────────────────────────────────
export { weatherService } from "./weather";
export { safetyService } from "./safety";
export { currencyService } from "./currency";
export { packingService } from "./packing";
export { compareService } from "./compare";
export { favoritesService } from "./favorites";

// ─────────────────────────────────────────────────────────────
// MAPS & NAVIGATION
// ─────────────────────────────────────────────────────────────
export { mapsService } from "./maps";

// ─────────────────────────────────────────────────────────────
// CHAT & AI
// ─────────────────────────────────────────────────────────────
export { chatService } from "./chat";

// ─────────────────────────────────────────────────────────────
// CONTENT & MEDIA
// ─────────────────────────────────────────────────────────────
export { newsService } from "./news";
export { journalService } from "./journal";
export { reservationService } from "./reservations";
export type { Reservation } from "./reservations";
export { statsService } from "./stats";
export type { TravelStats } from "./stats";

// ─────────────────────────────────────────────────────────────
// LANGUAGE & LOCALIZATION
// ─────────────────────────────────────────────────────────────
export { phrasebookService } from "./phrasebook";
export type { PhraseData } from "./phrasebook";

// ─────────────────────────────────────────────────────────────
// SHARING & COLLABORATION
// ─────────────────────────────────────────────────────────────
export { sharingService } from "./sharing";
export type {
  SharedTrip,
  CreateSharePayload,
  ShareResponse,
  SharesResponse,
} from "./sharing";

// ─────────────────────────────────────────────────────────────
// STORAGE & OFFLINE
// ─────────────────────────────────────────────────────────────
export { secureStorage } from "./secureStorage";
export { offlineQueue } from "./offlineQueue";
