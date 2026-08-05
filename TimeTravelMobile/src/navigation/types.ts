/**
 * Navigation Types — Single Source of Truth
 * ==========================================
 * Canonical param lists for the whole app.
 *
 * The root stack list MUST mirror the screens registered in
 * navigation/NavOS/index.tsx. Screens navigate against this list so
 * params are checked at compile time (no `as any`).
 */

import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Destination } from "@/types";
import type { TripPlace } from "@/services/tripPlanner";

export interface CompanionInfo {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  avatar_color?: string;
}

// ── Root Stack (all screens registered in NavOS) ─────────────
export type RootStackParamList = {
  Auth: undefined;
  MainTabs: { screen?: string; params?: Record<string, unknown> } | undefined;
  DestinationDetail: { destination: Destination; id?: string };
  Budget: {
    destinationId?: string;
    days?: number;
    destination?: { label?: string; id?: string };
  } | undefined;
  Itinerary: { destinationId?: string; days?: number; query?: string } | undefined;
  Packing: { destination?: string; tripId?: string } | undefined;
  Favorites: undefined;
  Currency: undefined;
  Compare: { dest1?: string; dest2?: string; days?: number } | undefined;
  Places: { lat?: number; lon?: number; category?: string } | undefined;
  RoutePlanner: { origin?: string; destination?: string } | undefined;
  TripWorkspace: { tripId?: string | number };
  Expenses: { tripId?: string | number; destination?: string } | undefined;
  TravelJournal: { entryId?: string } | undefined;
  Reservations: { type?: string; tripId?: string | number } | undefined;
  TripSharing: { tripId?: string | number; trip?: any; shareToken?: string } | undefined;
  NewsFeed: { category?: string } | undefined;
  TravelStats: undefined;
  Phrasebook: undefined;
  PlaceDetail: { place: TripPlace; tripId?: number };
  CompanionDetail: { companion: CompanionInfo };
  AddCompanion: { tripId: string | number };
};

// ── Convenience helper types ──────────────────────────────────
export type RootStackNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export type RootStackRouteProp<Route extends keyof RootStackParamList> =
  RouteProp<RootStackParamList, Route>;
