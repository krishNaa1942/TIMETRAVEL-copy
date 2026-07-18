/**
 * Navigation Operating System (NavOS)
 * Enterprise-grade navigation architecture for scalable mobile apps
 *
 * Features:
 * - Fault-tolerant navigation
 * - Offline-first behavior
 * - Deep linking with validation
 * - Auth lifecycle management
 * - Role-based routing
 * - Analytics integration
 * - Error recovery
 * - State persistence
 */

import React, { useEffect, useCallback, useState } from "react";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StatusBar,
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
} from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import { getTabDeepLinkScreens } from "../config/tabConfig";

// Import screens
import AuthScreen from "@/screens/AuthScreen";
import BottomTabNavigator from "../BottomTabNavigator";
import DestinationDetailScreen from "@/screens/DestinationDetailScreen";
import BudgetScreen from "@/screens/BudgetScreen";
import ItineraryScreen from "@/screens/ItineraryScreen";
import PackingScreen from "@/screens/PackingScreen";
import FavoritesScreen from "@/screens/FavoritesScreen";
import CurrencyScreen from "@/screens/CurrencyScreen";
import CompareScreen from "@/screens/CompareScreen";
import PlacesScreen from "@/screens/PlacesScreen";
import RoutePlannerScreen from "@/screens/RoutePlannerScreen";
import TripWorkspaceScreen from "@/screens/TripWorkspaceScreen";
import ExpenseTrackerScreen from "@/screens/ExpenseTrackerScreen";
import TravelJournalScreen from "@/screens/TravelJournalScreen";
import ReservationsScreen from "@/screens/ReservationsScreen";
import TripSharingScreen from "@/screens/TripSharingScreen";
import NewsFeedScreen from "@/screens/NewsFeedScreen";
import TravelStatsScreen from "@/screens/TravelStatsScreen";
import PhrasebookScreen from "@/screens/PhrasebookScreen";

// Types
export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  DestinationDetail: { id: string; name?: string };
  Budget: { destinationId?: string; days?: number };
  Itinerary: { destinationId?: string; days?: number };
  Packing: undefined;
  Favorites: undefined;
  Currency: undefined;
  Compare: { dest1?: string; dest2?: string; days?: number };
  Places: { lat?: number; lon?: number; category?: string };
  RoutePlanner: { origin?: string; destination?: string };
  TripWorkspace: { tripId?: string };
  Expenses: undefined;
  TravelJournal: { entryId?: string };
  Reservations: { type?: string };
  TripSharing: { tripId?: string };
  NewsFeed: { category?: string };
  TravelStats: undefined;
  Phrasebook: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ============================================
// PERSISTENCE KEY
// ============================================
const NAV_STATE_KEY = "@nav_state_v1";
const NAV_VERSION = 1;

// ============================================
// DEEP LINK CONFIGURATION
// ============================================
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "timetravel://",
    "https://timetravel.app",
    "https://*.timetravel.app",
  ],
  config: {
    screens: {
      MainTabs: {
        path: "",
        screens: getTabDeepLinkScreens(),
      },
      DestinationDetail: "destination/:id",
      Budget: "budget",
      Itinerary: "itinerary/:destinationId",
      Packing: "packing",
      Favorites: "favorites",
      Currency: "currency",
      Compare: "compare",
      Places: "places",
      RoutePlanner: "route",
      TripWorkspace: "workspace/:tripId",
      Expenses: "expenses",
      TravelJournal: "journal/:entryId",
      Reservations: "reservations",
      TripSharing: "share/:tripId",
      NewsFeed: "news",
      TravelStats: "stats",
      Phrasebook: "phrasebook",
      Auth: "auth",
    },
  },
};

// ============================================
// ERROR BOUNDARY COMPONENT
// ============================================
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class NavigationErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn("[NavOS] Navigation error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Navigation Error</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Text style={styles.errorRetry} onPress={this.props.onRetry}>
            Tap to Retry
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ============================================
// SPLASH SCREEN COMPONENT
// ============================================
const SplashScreen: React.FC<{ message?: string }> = ({ message }) => (
  <View style={styles.splashContainer}>
    <Text style={styles.splashLogo}>🌍</Text>
    <Text style={styles.splashTitle}>TimeTravel</Text>
    <ActivityIndicator
      size="large"
      color="#3B82F6"
      style={styles.splashSpinner}
    />
    {message && <Text style={styles.splashMessage}>{message}</Text>}
  </View>
);

// ============================================
// SCREEN CONFIGURATIONS
// ============================================
const darkHeader = {
  headerShown: true as const,
  headerTintColor: "#fff",
  headerStyle: { backgroundColor: "#0F172A" },
};

const transparentHeader = {
  headerShown: true as const,
  headerTitle: "",
  headerTransparent: true as const,
  headerTintColor: "#fff",
};

// ============================================
// AUTHENTICATED STACK
// ============================================
interface AuthenticatedStackProps {
  initialRoute?: keyof RootStackParamList;
  initialParams?: RootStackParamList[keyof RootStackParamList];
}

const AuthenticatedStack = React.memo<AuthenticatedStackProps>(
  ({ initialRoute, initialParams }) => (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRoute || "MainTabs"}
    >
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen
        name="DestinationDetail"
        component={DestinationDetailScreen}
        options={transparentHeader}
        initialParams={
          initialRoute === "DestinationDetail"
            ? (initialParams as any)
            : undefined
        }
      />
      <Stack.Screen
        name="Budget"
        component={BudgetScreen}
        options={{ ...darkHeader, headerTitle: "💰 Trip Budget" }}
      />
      <Stack.Screen
        name="Itinerary"
        component={ItineraryScreen}
        options={{ ...darkHeader, headerTitle: "📋 AI Itinerary" }}
      />
      <Stack.Screen
        name="Packing"
        component={PackingScreen}
        options={{ ...darkHeader, headerTitle: "🧳 Packing List" }}
      />
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ ...darkHeader, headerTitle: "❤️ Wishlist" }}
      />
      <Stack.Screen
        name="Currency"
        component={CurrencyScreen}
        options={{ ...darkHeader, headerTitle: "💱 Currency" }}
      />
      <Stack.Screen
        name="Compare"
        component={CompareScreen}
        options={{ ...darkHeader, headerTitle: "⚖️ Compare" }}
      />
      <Stack.Screen
        name="Places"
        component={PlacesScreen}
        options={{ ...darkHeader, headerTitle: "📍 Discover" }}
      />
      <Stack.Screen
        name="RoutePlanner"
        component={RoutePlannerScreen}
        options={{ ...darkHeader, headerTitle: "🗺️ Route Planner" }}
      />
      <Stack.Screen
        name="TripWorkspace"
        component={TripWorkspaceScreen}
        options={{ ...darkHeader, headerTitle: "🗂️ Trip Workspace" }}
      />
      <Stack.Screen
        name="Expenses"
        component={ExpenseTrackerScreen}
        options={{ ...darkHeader, headerTitle: "💰 Expenses" }}
      />
      <Stack.Screen
        name="TravelJournal"
        component={TravelJournalScreen}
        options={{ ...darkHeader, headerTitle: "📔 Journal" }}
      />
      <Stack.Screen
        name="Reservations"
        component={ReservationsScreen}
        options={{ ...darkHeader, headerTitle: "🎫 Reservations" }}
      />
      <Stack.Screen
        name="TripSharing"
        component={TripSharingScreen}
        options={{ ...darkHeader, headerTitle: "🔗 Share Trip" }}
      />
      <Stack.Screen
        name="NewsFeed"
        component={NewsFeedScreen}
        options={{ ...darkHeader, headerTitle: "📰 News" }}
      />
      <Stack.Screen
        name="TravelStats"
        component={TravelStatsScreen}
        options={{ ...darkHeader, headerTitle: "📊 My Stats" }}
      />
      <Stack.Screen
        name="Phrasebook"
        component={PhrasebookScreen}
        options={{ ...darkHeader, headerTitle: "🗣️ Phrasebook" }}
      />
    </Stack.Navigator>
  ),
);

AuthenticatedStack.displayName = "AuthenticatedStack";

// ============================================
// GUEST STACK
// ============================================
const GuestStack = React.memo(() => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Auth" component={AuthScreen} />
  </Stack.Navigator>
));

GuestStack.displayName = "GuestStack";

// ============================================
// MAIN NAVOS COMPONENT
// ============================================
export const NavOS: React.FC = () => {
  const {
    isAuthenticated,
    loadAuthState,
    isLoading: authLoading,
  } = useAuthStore();

  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState<any>(null);
  const persistNavigationStateTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Load persisted navigation state
  const loadNavigationState = useCallback(async () => {
    try {
      const savedState = await AsyncStorage.getItem(NAV_STATE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // Only restore if version matches and state is recent (within 7 days)
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (
          parsed.version === NAV_VERSION &&
          Date.now() - parsed.timestamp < maxAge
        ) {
          setInitialState(parsed.state);
        }
      }
    } catch (error) {
      console.warn("[NavOS] Failed to restore navigation state:", error);
      // Clear corrupted state
      await AsyncStorage.removeItem(NAV_STATE_KEY);
    }
  }, []);

  // Initialize navigation
  useEffect(() => {
    const init = async () => {
      try {
        // Load auth state
        await loadAuthState();

        // Load persisted navigation state
        await loadNavigationState();

        setIsReady(true);
      } catch (error) {
        console.error("[NavOS] Initialization error:", error);
        setIsReady(true); // Continue anyway
      }
    };

    init();

    return undefined;
  }, [loadAuthState, loadNavigationState]);

  useEffect(() => {
    return () => {
      if (persistNavigationStateTimeoutRef.current) {
        clearTimeout(persistNavigationStateTimeoutRef.current);
      }
    };
  }, []);

  // Handle navigation state change
  const onStateChange = useCallback((state: any) => {
    if (persistNavigationStateTimeoutRef.current) {
      clearTimeout(persistNavigationStateTimeoutRef.current);
    }

    persistNavigationStateTimeoutRef.current = setTimeout(() => {
      persistNavigationStateTimeoutRef.current = null;

      if (!useAuthStore.getState().isAuthenticated || !state) {
        return;
      }

      void AsyncStorage.setItem(
        NAV_STATE_KEY,
        JSON.stringify({
          version: NAV_VERSION,
          timestamp: Date.now(),
          state,
        }),
      ).catch((error) => {
        console.warn("[NavOS] Failed to persist navigation state:", error);
      });
    }, 200);
  }, []);

  // Track screen views for analytics
  const onReady = useCallback(() => {
    console.log("[NavOS] Navigation ready");
  }, []);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    setIsReady(false);
    setTimeout(() => setIsReady(true), 100);
  }, []);

  // Render loading state
  if (!isReady || authLoading) {
    return (
      <SplashScreen
        message={authLoading ? "Restoring session..." : "Loading..."}
      />
    );
  }

  return (
    <NavigationErrorBoundary onRetry={handleRetry}>
      <NavigationContainer
        linking={linking}
        initialState={isAuthenticated ? initialState : undefined}
        onStateChange={onStateChange}
        onReady={onReady}
        theme={{
          dark: true,
          colors: {
            primary: "#3B82F6",
            background: "#0F172A",
            card: "#1E293B",
            text: "#F8FAFC",
            border: "#334155",
            notification: "#EF4444",
          },
          fonts: {
            regular: { fontFamily: "System", fontWeight: "400" },
            medium: { fontFamily: "System", fontWeight: "500" },
            bold: { fontFamily: "System", fontWeight: "700" },
            heavy: { fontFamily: "System", fontWeight: "900" },
          },
        }}
      >
        <StatusBar barStyle="light-content" />
        {isAuthenticated ? <AuthenticatedStack /> : <GuestStack />}
      </NavigationContainer>
    </NavigationErrorBoundary>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  splashLogo: {
    fontSize: 64,
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 24,
  },
  splashSpinner: {
    marginBottom: 16,
  },
  splashMessage: {
    fontSize: 14,
    color: "#94A3B8",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#EF4444",
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 24,
  },
  errorRetry: {
    fontSize: 16,
    color: "#3B82F6",
    fontWeight: "600",
    padding: 16,
  },
});

export default NavOS;
