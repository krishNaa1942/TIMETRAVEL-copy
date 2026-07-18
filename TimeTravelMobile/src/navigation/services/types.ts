/**
 * Navigation Types
 * Enterprise-grade type definitions for navigation system
 */

import { NavigationState as RNNavigationState } from "@react-navigation/native";

// ============================================
// User & Auth Types
// ============================================

export type UserRole = "guest" | "user" | "admin" | "premium";

export interface Permission {
  key: string;
  label: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  user: User | null;
  role: UserRole;
  permissions: string[];
  sessionExpired: boolean;
  token: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  role?: UserRole;
  permissions?: string[];
  preferences?: Record<string, unknown>;
  createdAt?: string;
  lastLogin?: string;
}

// ============================================
// Route Param Types
// ============================================

export interface DestinationDetailParams {
  id: string;
  name?: string;
}

export interface BudgetParams {
  destinationId?: string;
  days?: number;
}

export interface ItineraryParams {
  destinationId?: string;
  days?: number;
}

export interface CompareParams {
  dest1?: string;
  dest2?: string;
  days?: number;
}

export interface PlacesParams {
  lat?: number;
  lon?: number;
  category?: string;
}

export interface RoutePlannerParams {
  origin?: string;
  destination?: string;
}

export interface TripWorkspaceParams {
  tripId?: string;
}

export interface JournalParams {
  entryId?: string;
}

export interface ReservationsParams {
  type?: string;
}

export interface NewsFeedParams {
  category?: string;
}

// ============================================
// Root Stack Param List
// ============================================

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  DestinationDetail: DestinationDetailParams;
  Budget: BudgetParams;
  Itinerary: ItineraryParams;
  Packing: undefined;
  Favorites: undefined;
  Currency: undefined;
  Compare: CompareParams;
  Places: PlacesParams;
  RoutePlanner: RoutePlannerParams;
  TripWorkspace: TripWorkspaceParams;
  Expenses: undefined;
  TravelJournal: JournalParams;
  Reservations: ReservationsParams;
  TripSharing: TripWorkspaceParams;
  NewsFeed: NewsFeedParams;
  TravelStats: undefined;
  Phrasebook: undefined;
};

// ============================================
// Navigation State Types
// ============================================

export interface NavigationState {
  stale: boolean;
  type: string;
  index: number;
  routeNames: (keyof RootStackParamList)[];
  routes: NavigationRoute[];
}

export interface NavigationRoute {
  key: string;
  name: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
  state?: NavigationState;
}

// ============================================
// Route Protection Types
// ============================================

export interface RouteConfig {
  name: keyof RootStackParamList;
  requiresAuth: boolean;
  requiredRoles?: UserRole[];
  requiredPermissions?: string[];
  guestAllowed?: boolean;
}

export interface ProtectedRouteProps {
  requiredRoles?: UserRole[];
  requiredPermissions?: string[];
  guestAllowed?: boolean;
  fallbackRoute?: keyof RootStackParamList;
  children: React.ReactNode;
}

// ============================================
// Deep Link Types
// ============================================

export interface DeepLinkConfig {
  prefix: string;
  config: {
    screens: Record<string, string>;
  };
}

export interface ParsedDeepLink {
  route: keyof RootStackParamList;
  params: RootStackParamList[keyof RootStackParamList];
  valid: boolean;
  error?: string;
}

// ============================================
// Analytics Types
// ============================================

export interface NavigationEvent {
  type: "navigate" | "back" | "reset" | "tab_switch" | "deep_link";
  routeName: string;
  params?: Record<string, unknown>;
  timestamp: number;
  userId?: string;
  sessionId: string;
}

export interface ScreenViewEvent {
  screenName: string;
  previousScreen?: string;
  timestamp: number;
  duration?: number;
}

// ============================================
// Feature Flags Types
// ============================================

export interface NavigationFeatureFlags {
  enableDeepLinks: boolean;
  enableAnalytics: boolean;
  enablePersistence: boolean;
  enableOfflineMode: boolean;
  enablePreload: boolean;
  betaFeatures: string[];
  hiddenRoutes: string[];
}

// ============================================
// Persistence Types
// ============================================

export interface PersistedNavigationState {
  version: number;
  timestamp: number;
  state: NavigationState;
  userId?: string;
}

// ============================================
// Error Types
// ============================================

export interface NavigationError {
  code: string;
  message: string;
  route?: string;
  params?: unknown;
  timestamp: number;
  stack?: string;
}

export const NavigationErrorCodes = {
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_PARAMS: "INVALID_PARAMS",
  DEEP_LINK_FAILED: "DEEP_LINK_FAILED",
  STATE_RESTORE_FAILED: "STATE_RESTORE_FAILED",
  UNKNOWN: "UNKNOWN",
} as const;

export type NavigationErrorCode =
  (typeof NavigationErrorCodes)[keyof typeof NavigationErrorCodes];
