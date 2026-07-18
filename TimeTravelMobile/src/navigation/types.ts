/**
 * Navigation Types - Production Grade Type Definitions
 * Centralized navigation param lists with full type safety
 */

import { Destination } from "@/types";
import { NavigatorScreenParams } from "@react-navigation/native";
import { CompositeNavigationProp, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

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

// ── Auth Stack (Unauthenticated flows) ─────────────────────────
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Onboarding: undefined;
};

// ── Main Tab Navigator ──────────────────────────────────────────
export type MainTabParamList = {
  HomeTab: undefined;
  ExploreTab: undefined;
  ChatTab: undefined;
  TripsTab: undefined;
  ProfileTab: undefined;
};

// ── Trip Feature Stack ──────────────────────────────────────────
export type TripStackParamList = {
  TripList: undefined;
  TripDetail: { tripId: string };
  TripWorkspace: { tripId?: string };
  Budget: { destination?: Destination; tripId?: string };
  Itinerary: { query?: string; tripId?: string };
  Packing: { tripId?: string };
  Expenses: { tripId?: string };
  Reservations: { tripId?: string };
  TripSharing: { tripId?: string; shareToken?: string };
};

// ── Explore Feature Stack ───────────────────────────────────────
export type ExploreStackParamList = {
  ExploreMain: undefined;
  DestinationDetail: { destination: Destination };
  Places: { destination?: Destination };
  Compare: CompareRouteParams | undefined;
  Favorites: undefined;
};

// ── Social Feature Stack ────────────────────────────────────────
export type SocialStackParamList = {
  TravelJournal: { tripId?: string };
  NewsFeed: undefined;
  TravelStats: undefined;
};

// ── Settings Stack ──────────────────────────────────────────────
export type SettingsStackParamList = {
  SettingsMain: undefined;
  Currency: undefined;
  Phrasebook: undefined;
  RoutePlanner: undefined;
  Notifications: undefined;
  Privacy: undefined;
  About: undefined;
};

// ── Root Stack (Top-level navigation) ───────────────────────────
export type RootStackParamList = {
  // Auth flows
  Auth: undefined;

  // Main app
  MainApp: undefined;

  // Feature stacks (modal presentation)
  TripStack: NavigatorScreenParams<TripStackParamList>;
  ExploreStack: NavigatorScreenParams<ExploreStackParamList>;
  SocialStack: NavigatorScreenParams<SocialStackParamList>;
  SettingsStack: NavigatorScreenParams<SettingsStackParamList>;

  // Direct deep link targets
  DestinationDetail: { destination: Destination };
  SharedTrip: { shareToken: string };

  // Modals
  CurrencyModal: undefined;

  // Error states
  NetworkError: undefined;
};

// ── Legacy types for backward compatibility ─────────────────────
export type BottomTabParamList = {
  Home: undefined;
  Explore: undefined;
  Chat: undefined;
  Trips: undefined;
  Profile: undefined;
};

// ── Route Protection Levels ─────────────────────────────────────
export type RouteProtection = "public" | "authenticated" | "premium" | "admin";

// ── Navigation Route Config ─────────────────────────────────────
export interface RouteConfig {
  name: string;
  protection: RouteProtection;
  title?: string;
  headerShown?: boolean;
  headerTransparent?: boolean;
}

// ── Deep Linking Config ─────────────────────────────────────────
export interface DeepLinkConfig {
  path: string;
  screen: string;
  params?: Record<string, string>;
}

// ── Helper Types ────────────────────────────────────────────────

// Type for root navigation prop
export type RootStackNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

// Type for tab navigation prop
export type TabNavigationProp = BottomTabNavigationProp<MainTabParamList>;

// Composite navigation prop for screens that need both
export type AppNavigationProp = CompositeNavigationProp<
  RootStackNavigationProp,
  TabNavigationProp
>;

// Screen props helpers
export type ScreenProps<T extends Record<string, any>> = {
  navigation: NativeStackNavigationProp<T>;
  route: RouteProp<T>;
};

// Stack screen props with navigation and route
export type StackScreenProps<T extends Record<string, any>> = {
  navigation: NativeStackNavigationProp<T>;
  route: RouteProp<T>;
};

// Tab screen props
export type TabScreenProps<T extends Record<string, any>> = {
  navigation: BottomTabNavigationProp<T>;
  route: RouteProp<T>;
};

// ── Auth State for Navigation ───────────────────────────────────
export interface AuthNavigationState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  userRole?: "free" | "premium" | "admin";
}

// ── Navigation Event Types for Analytics ────────────────────────
export interface NavigationEvent {
  screen: string;
  params?: Record<string, any>;
  timestamp: number;
  previousScreen?: string;
}
