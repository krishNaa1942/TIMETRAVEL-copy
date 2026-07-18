/**
 * 🎯 CENTRALIZED TAB CONFIGURATION
 * ================================
 * Enterprise-grade tab configuration for scalable navigation
 *
 * Features:
 * - Centralized icon management
 * - Role-based permissions
 * - Badge configuration
 * - Deep linking paths
 * - Analytics tracking
 */

import { MaterialIcons, Ionicons } from "@expo/vector-icons";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type TabRouteName = "Home" | "Explore" | "Chat" | "Trips" | "Profile";

export type UserRole = "guest" | "user" | "premium" | "admin";

export type TabStackName =
  | "HomeStack"
  | "ExploreStack"
  | "ChatStack"
  | "TripsStack"
  | "ProfileStack";

export type TabBadgeStoreKey = "unreadMessagesCount" | "pendingTripsCount";

export interface TabBadgeCounts {
  unreadMessagesCount: number;
  pendingTripsCount: number;
}

export interface TabConfig {
  name: TabRouteName;
  label: string;
  icon: {
    active:
      | keyof typeof MaterialIcons.glyphMap
      | keyof typeof Ionicons.glyphMap;
    inactive:
      | keyof typeof MaterialIcons.glyphMap
      | keyof typeof Ionicons.glyphMap;
    family: "material" | "ionicons";
  };
  badge?: {
    enabled: boolean;
    storeKey: TabBadgeStoreKey;
  };
  permissions: {
    minRole: UserRole;
    hideIfUnauthorized: boolean;
  };
  deepLink: {
    path: string;
    params?: string[];
  };
  analytics: {
    eventName: string;
    properties: Record<string, string>;
  };
  stack: TabStackName;
}

// ─────────────────────────────────────────────────────────────
// TAB CONFIGURATIONS
// ─────────────────────────────────────────────────────────────

export const TAB_CONFIGS: TabConfig[] = [
  {
    name: "Home",
    label: "Home",
    icon: {
      active: "home",
      inactive: "home",
      family: "material",
    },
    permissions: {
      minRole: "guest",
      hideIfUnauthorized: false,
    },
    deepLink: {
      path: "home",
    },
    analytics: {
      eventName: "tab_home_opened",
      properties: { section: "home" },
    },
    stack: "HomeStack",
  },
  {
    name: "Explore",
    label: "Explore",
    icon: {
      active: "search",
      inactive: "search-outline",
      family: "ionicons",
    },
    permissions: {
      minRole: "guest",
      hideIfUnauthorized: false,
    },
    deepLink: {
      path: "explore",
      params: ["category", "destinationId"],
    },
    analytics: {
      eventName: "tab_explore_opened",
      properties: { section: "explore" },
    },
    stack: "ExploreStack",
  },
  {
    name: "Chat",
    label: "Chat",
    icon: {
      active: "chatbubble",
      inactive: "chatbubble-outline",
      family: "ionicons",
    },
    badge: {
      enabled: true,
      storeKey: "unreadMessagesCount",
    },
    permissions: {
      minRole: "user",
      hideIfUnauthorized: false, // Show but disabled
    },
    deepLink: {
      path: "chat",
      params: ["conversationId"],
    },
    analytics: {
      eventName: "tab_chat_opened",
      properties: { section: "chat" },
    },
    stack: "ChatStack",
  },
  {
    name: "Trips",
    label: "Trips",
    icon: {
      active: "airplane",
      inactive: "airplane-outline",
      family: "ionicons",
    },
    badge: {
      enabled: true,
      storeKey: "pendingTripsCount",
    },
    permissions: {
      minRole: "user",
      hideIfUnauthorized: false,
    },
    deepLink: {
      path: "trips",
      params: ["tripId", "mode"],
    },
    analytics: {
      eventName: "tab_trips_opened",
      properties: { section: "trips" },
    },
    stack: "TripsStack",
  },
  {
    name: "Profile",
    label: "Profile",
    icon: {
      active: "person",
      inactive: "person-outline",
      family: "ionicons",
    },
    permissions: {
      minRole: "guest",
      hideIfUnauthorized: false,
    },
    deepLink: {
      path: "profile",
      params: ["section"],
    },
    analytics: {
      eventName: "tab_profile_opened",
      properties: { section: "profile" },
    },
    stack: "ProfileStack",
  },
];

// ─────────────────────────────────────────────────────────────
// ROLE HIERARCHY
// ─────────────────────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest: 0,
  user: 1,
  premium: 2,
  admin: 3,
};

const normalizeDeepLinkPath = (path: string): string =>
  path
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

export const TAB_ROUTE_TO_PATH: Record<TabRouteName, string> =
  TAB_CONFIGS.reduce(
    (acc, tab) => {
      acc[tab.name] = tab.deepLink.path;
      return acc;
    },
    {} as Record<TabRouteName, string>,
  );

export const TAB_PATH_TO_ROUTE: Record<string, TabRouteName> =
  TAB_CONFIGS.reduce(
    (acc, tab) => {
      acc[normalizeDeepLinkPath(tab.deepLink.path)] = tab.name;
      return acc;
    },
    {} as Record<string, TabRouteName>,
  );

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

export function hasTabPermission(tab: TabConfig, userRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[tab.permissions.minRole];
}

export function getVisibleTabs(userRole: UserRole): TabConfig[] {
  return TAB_CONFIGS.filter((tab) => {
    if (tab.permissions.hideIfUnauthorized) {
      return hasTabPermission(tab, userRole);
    }
    return true;
  });
}

export function getTabByName(name: TabRouteName): TabConfig | undefined {
  return TAB_CONFIGS.find((tab) => tab.name === name);
}

export function resolveTabRouteByPath(path: string): TabRouteName | undefined {
  return TAB_PATH_TO_ROUTE[normalizeDeepLinkPath(path)];
}

export function getTabDeepLinkScreens(): Record<TabRouteName, string> {
  return TAB_CONFIGS.reduce(
    (acc, tab) => {
      acc[tab.name] = tab.deepLink.path;
      return acc;
    },
    {} as Record<TabRouteName, string>,
  );
}

export function getDeepLinkConfig(): Record<
  string,
  { screen: string; params?: string[] }
> {
  const config: Record<string, { screen: string; params?: string[] }> = {};

  TAB_CONFIGS.forEach((tab) => {
    config[tab.deepLink.path] = {
      screen: tab.name,
      params: tab.deepLink.params,
    };
  });

  return config;
}

// ─────────────────────────────────────────────────────────────
// ANIMATION CONFIG
// ─────────────────────────────────────────────────────────────

export const TAB_ANIMATION_CONFIG = {
  iconScale: {
    active: 1.15,
    inactive: 1.0,
    springDamping: 0.6,
    springStiffness: 300,
  },
  badge: {
    scale: {
      active: 1.2,
      inactive: 1.0,
    },
    pulseDuration: 300,
  },
  transition: {
    duration: 200,
  },
};

// ─────────────────────────────────────────────────────────────
// ACCESSIBILITY LABELS
// ─────────────────────────────────────────────────────────────

export function getAccessibilityLabel(
  tab: TabConfig,
  focused: boolean,
): string {
  const state = focused ? "active" : "inactive";
  const badge = tab.badge?.enabled ? " with notifications" : "";
  return `${tab.label} tab, ${state}${badge}`;
}
