/**
 * Navigation Configuration - Production Grade
 * Centralized configuration for navigation themes, options, and settings
 */

import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { colors } from "@/theme/colors";

// ── Header Configurations ───────────────────────────────────────
export const headerConfigs = {
  // Dark header (default for most screens)
  dark: {
    headerShown: true,
    headerTintColor: "#fff",
    headerStyle: {
      backgroundColor: "#0F172A",
    },
    headerTitleStyle: {
      fontWeight: "600" as const,
    },
    headerBackVisible: true,
  } satisfies NativeStackNavigationOptions,

  // Transparent header (for detail screens with hero images)
  transparent: {
    headerShown: true,
    headerTitle: "",
    headerTransparent: true,
    headerTintColor: "#fff",
    headerBackVisible: true,
  } satisfies NativeStackNavigationOptions,

  // No header
  none: {
    headerShown: false,
  } satisfies NativeStackNavigationOptions,

  // Light header (for light-themed screens)
  light: {
    headerShown: true,
    headerTintColor: "#0F172A",
    headerStyle: {
      backgroundColor: "#fff",
    },
    headerTitleStyle: {
      fontWeight: "600" as const,
    },
    headerBackVisible: true,
  } satisfies NativeStackNavigationOptions,
};

// ── Screen Titles ───────────────────────────────────────────────
export const screenTitles = {
  // Trip screens
  Budget: "💰 Trip Budget",
  Itinerary: "📋 AI Itinerary",
  Packing: "🧳 Packing List",
  Favorites: "❤️ Wishlist",
  Currency: "💱 Currency",
  Compare: "⚖️ Compare",
  Places: "📍 Discover",
  RoutePlanner: "🗺️ Route Planner",
  TripWorkspace: "🗂️ Trip Workspace",
  Expenses: "💰 Expenses",
  TravelJournal: "📔 Journal",
  Reservations: "🎫 Reservations",
  TripSharing: "🔗 Share Trip",
  NewsFeed: "📰 News",
  TravelStats: "📊 My Stats",
  Phrasebook: "🗣️ Phrasebook",
  DestinationDetail: "",
  Profile: "👤 Profile",
  Chat: "💬 Travel Assistant",
  Trips: "✈️ My Trips",
  Explore: "🧭 Explore",
  Home: "🏠 Home",
} as const;

// ── Tab Bar Configuration ───────────────────────────────────────
export const tabBarConfig = {
  screenOptions: {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.gray,
    tabBarStyle: {
      backgroundColor: colors.darkBackground,
      borderTopWidth: 0,
      height: 65,
      paddingBottom: 8,
      paddingTop: 6,
      boxShadow: "0px -4px 12px rgba(0, 0, 0, 0.15)",
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: "600" as const,
    },
  } satisfies BottomTabNavigationOptions,
};

// ── Tab Icons ────────────────────────────────────────────────────
export const tabIcons: Record<string, { focused: string; unfocused: string }> =
  {
    Home: { focused: "🏠", unfocused: "🏡" },
    Explore: { focused: "🧭", unfocused: "🗺️" },
    Chat: { focused: "💬", unfocused: "🗨️" },
    Trips: { focused: "✈️", unfocused: "🛫" },
    Profile: { focused: "👤", unfocused: "👥" },
  };

// ── Animation Configurations ────────────────────────────────────
export const animations = {
  // Standard slide from right
  slideFromRight: {
    animation: "slide_from_right" as const,
    animationDuration: 300,
  },

  // Slide from bottom (modal-like)
  slideFromBottom: {
    animation: "slide_from_bottom" as const,
    animationDuration: 400,
  },

  // Fade in
  fade: {
    animation: "fade" as const,
    animationDuration: 200,
  },

  // No animation
  none: {
    animation: "none" as const,
  },
};

// ── Default Stack Options ────────────────────────────────────────
export const defaultStackOptions: NativeStackNavigationOptions = {
  ...headerConfigs.dark,
  ...animations.slideFromRight,
  gestureEnabled: true,
  orientation: "portrait" as const,
  statusBarAnimation: "slide" as const,
  statusBarBackgroundColor: "#0F172A",
  statusBarStyle: "light" as const,
};

// ── Modal Stack Options ──────────────────────────────────────────
export const modalStackOptions: NativeStackNavigationOptions = {
  ...headerConfigs.dark,
  ...animations.slideFromBottom,
  presentation: "modal" as const,
  gestureEnabled: true,
};

// ── Deep Linking Configuration ───────────────────────────────────
export const deepLinkConfig = {
  prefixes: [
    "timetravel://", // Custom URL scheme
    "https://timetravel.app", // Universal links
    "https://*.timetravel.app", // Universal links with subdomains
  ],
  config: {
    screens: {
      // Deep link to specific destination
      DestinationDetail: "destination/:destinationId",
      // Deep link to shared trip
      SharedTrip: "shared/:shareToken",
      // Feature stacks
      TripStack: {
        screens: {
          TripDetail: "trips/:tripId",
          TripWorkspace: "trips/:tripId/workspace",
          Budget: "trips/:tripId/budget",
          Itinerary: "trips/:tripId/itinerary",
          Packing: "trips/:tripId/packing",
          Expenses: "trips/:tripId/expenses",
        },
      },
      ExploreStack: {
        screens: {
          ExploreMain: "explore",
          Favorites: "favorites",
          Compare: "compare",
          Places: "places/:destinationId",
        },
      },
      SocialStack: {
        screens: {
          TravelJournal: "journal/:tripId",
          NewsFeed: "news",
          TravelStats: "stats",
        },
      },
      SettingsStack: {
        screens: {
          SettingsMain: "settings",
          Currency: "currency",
          Phrasebook: "phrasebook",
        },
      },
      // Auth screens
      Auth: {
        screens: {
          Login: "login",
          Register: "register",
          ForgotPassword: "forgot-password",
        },
      },
    },
  },
};

// ── Navigation State Persistence ─────────────────────────────────
export const navigationPersistenceConfig = {
  key: "NAVIGATION_STATE_V1",
  // Only persist navigation state for authenticated users
  shouldPersist: (state: any) => {
    const routes = state?.routes ?? [];
    // Don't persist if we're on auth screens
    return !routes.some(
      (route: any) =>
        route.name === "Auth" ||
        route.name === "Login" ||
        route.name === "Register",
    );
  },
};

// ── Gesture Configuration ────────────────────────────────────────
export const gestureConfig = {
  // Enable swipe back gesture
  swipeEnabled: true,
  // Gesture response distance
  gestureResponseDistance: {
    horizontal: 50,
    vertical: 50,
  },
  // Gesture direction
  gestureDirection: "horizontal" as const,
};

// ── Safe Area Configuration ──────────────────────────────────────
export const safeAreaConfig = {
  // Force safe area insets for notched devices
  edges: ["top", "right", "bottom", "left"] as const,
  // Minimum insets
  minInsets: {
    top: 44,
    bottom: 34,
  },
};

// ── Route Protection Mapping ─────────────────────────────────────
export const protectedRoutes: Record<
  string,
  "public" | "authenticated" | "premium" | "admin"
> = {
  // Public routes
  Auth: "public",
  Login: "public",
  Register: "public",
  ForgotPassword: "public",

  // Authenticated routes
  MainApp: "authenticated",
  Home: "authenticated",
  Explore: "authenticated",
  Chat: "authenticated",
  Trips: "authenticated",
  Profile: "authenticated",
  Budget: "authenticated",
  Itinerary: "authenticated",
  Packing: "authenticated",
  Expenses: "authenticated",
  Reservations: "authenticated",
  TripSharing: "authenticated",
  TravelJournal: "authenticated",
  NewsFeed: "authenticated",
  TravelStats: "authenticated",
  Phrasebook: "authenticated",
  Favorites: "authenticated",
  Compare: "authenticated",
  Places: "authenticated",
  RoutePlanner: "authenticated",
  TripWorkspace: "authenticated",
  DestinationDetail: "authenticated",
  Currency: "authenticated",

  // Premium routes (future)
  // AdvancedAnalytics: 'premium',
  // TeamCollaboration: 'premium',

  // Admin routes (future)
  // AdminDashboard: 'admin',
  // UserManagement: 'admin',
};
