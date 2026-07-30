/**
 * Production Bottom Tab Navigator
 * - Single-source tab metadata from tabConfig
 * - Real auth and badge store integration
 * - Role-based tab access guards
 * - Tab-local fault isolation via error boundaries
 * - Deterministic analytics events
 */

import React, {
  Component,
  ErrorInfo,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { getAnalytics } from "@/core/telemetry/Analytics";
import { useAuthStore } from "@/stores/authStore";
import { useTripsStore } from "@/stores/tripsStore";
import { useUserBehaviorStore } from "@/stores/userBehaviorStore";

import {
  TAB_CONFIGS,
  TabBadgeCounts,
  TabConfig,
  TabRouteName,
  UserRole,
  getAccessibilityLabel,
  getVisibleTabs,
  hasTabPermission,
} from "./config/tabConfig";
import AnimatedTabIcon from "./components/AnimatedTabIcon";

import HomeStack from "./stacks/HomeStack";
import ExploreStack from "./stacks/ExploreStack";
import ChatStack from "./stacks/ChatStack";
import TripStack from "./stacks/TripStack";
import ProfileStack from "./stacks/ProfileStack";

export type BottomTabParamList = {
  Home: undefined;
  Explore: { category?: string; destinationId?: string } | undefined;
  Chat: { conversationId?: string } | undefined;
  Trips: { tripId?: string; mode?: string } | undefined;
  Profile: { section?: string } | undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const tabBarShadow =
  Platform.select({
    web: {
      boxShadow: "0px -4px 12px rgba(0, 0, 0, 0.1)",
    } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 10,
    },
  }) ?? {};
interface TabErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage: string;
}

interface TabErrorBoundaryState {
  hasError: boolean;
}

class TabErrorBoundary extends Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): TabErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[BottomTabNavigator] Tab render error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to open this tab</Text>
          <Text style={styles.errorSubtitle}>{this.props.fallbackMessage}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const LoadingFallback: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#3B82F6" />
  </View>
);

const ProtectedStackScreen = (
  StackComponent: React.ComponentType<any>,
  label: string,
): React.ComponentType => {
  const Screen: React.FC = () => (
    <TabErrorBoundary fallbackMessage={`Please try opening ${label} again.`}>
      <StackComponent />
    </TabErrorBoundary>
  );

  Screen.displayName = `${label}TabScreen`;
  return Screen;
};

const TAB_STACK_SCREENS: Record<TabRouteName, React.ComponentType> = {
  Home: ProtectedStackScreen(HomeStack, "Home"),
  Explore: ProtectedStackScreen(ExploreStack, "Explore"),
  Chat: ProtectedStackScreen(ChatStack, "Chat"),
  Trips: ProtectedStackScreen(TripStack, "Trips"),
  Profile: ProtectedStackScreen(ProfileStack, "Profile"),
};

const RestrictedAccessScreen: React.FC<{
  tabLabel: string;
  isAuthenticated: boolean;
  requiredRole: UserRole;
}> = ({ tabLabel, isAuthenticated, requiredRole }) => {
  const message = isAuthenticated
    ? `${tabLabel} requires ${requiredRole} access.`
    : `${tabLabel} requires sign in.`;

  return (
    <View style={styles.lockedContainer}>
      <Text style={styles.lockedTitle}>Access Restricted</Text>
      <Text style={styles.lockedText}>{message}</Text>
    </View>
  );
};

const createRestrictedTabScreen = (tab: TabConfig): React.ComponentType => {
  const Screen: React.FC = () => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    return (
      <RestrictedAccessScreen
        tabLabel={tab.label}
        requiredRole={tab.permissions.minRole}
        isAuthenticated={isAuthenticated}
      />
    );
  };

  Screen.displayName = `${tab.name}RestrictedScreen`;
  return Screen;
};

const TAB_CONFIG_BY_ROUTE = TAB_CONFIGS.reduce(
  (acc, tab) => {
    acc[tab.name] = tab;
    return acc;
  },
  {} as Record<TabRouteName, TabConfig>,
);

const RESTRICTED_TAB_SCREENS: Record<TabRouteName, React.ComponentType> = {
  Home: createRestrictedTabScreen(TAB_CONFIG_BY_ROUTE.Home),
  Explore: createRestrictedTabScreen(TAB_CONFIG_BY_ROUTE.Explore),
  Chat: createRestrictedTabScreen(TAB_CONFIG_BY_ROUTE.Chat),
  Trips: createRestrictedTabScreen(TAB_CONFIG_BY_ROUTE.Trips),
  Profile: createRestrictedTabScreen(TAB_CONFIG_BY_ROUTE.Profile),
};

const ROLE_VALUES: UserRole[] = ["guest", "user", "premium", "admin"];

const resolveUserRole = (
  isAuthenticated: boolean,
  preferences?: Record<string, unknown>,
): UserRole => {
  const candidates = [preferences?.role, preferences?.tier, preferences?.plan]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase().trim())
    .filter((value): value is UserRole =>
      ROLE_VALUES.includes(value as UserRole),
    );

  if (candidates.length > 0) {
    return candidates[0];
  }

  return isAuthenticated ? "user" : "guest";
};

interface BottomTabNavigatorProps {
  onTabPress?: (tabName: TabRouteName) => void;
}

const BottomTabNavigator: React.FC<BottomTabNavigatorProps> = ({
  onTabPress,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const analytics = useMemo(() => getAnalytics(), []);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const rolePreference = useAuthStore(
    (state) => state.user?.preferences?.role as string | undefined,
  );
  const tierPreference = useAuthStore(
    (state) => state.user?.preferences?.tier as string | undefined,
  );
  const planPreference = useAuthStore(
    (state) => state.user?.preferences?.plan as string | undefined,
  );

  const pendingTripsCount = useTripsStore(
    (state) => state.upcomingTrips.length,
  );
  const unreadMessagesCount = useUserBehaviorStore(
    (state) => state.nextActions.length,
  );

  const userRole = useMemo(
    () =>
      resolveUserRole(isAuthenticated, {
        role: rolePreference,
        tier: tierPreference,
        plan: planPreference,
      }),
    [isAuthenticated, planPreference, rolePreference, tierPreference],
  );

  const badgeCounts = useMemo<TabBadgeCounts>(
    () => ({
      unreadMessagesCount: Math.max(0, unreadMessagesCount),
      pendingTripsCount: Math.max(0, pendingTripsCount),
    }),
    [pendingTripsCount, unreadMessagesCount],
  );

  const visibleTabs = useMemo(() => getVisibleTabs(userRole), [userRole]);

  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        backgroundColor: theme.colors.card,
        borderTopColor: theme.colors.border,
        height: 60 + insets.bottom,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
      },
    ],
    [insets.bottom, theme.colors.border, theme.colors.card],
  );

  const navigatorScreenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: true,
      freezeOnBlur: true,
      tabBarHideOnKeyboard: true,
      tabBarShowLabel: true,
      tabBarStyle,
      tabBarItemStyle: styles.tabBarItem,
    }),
    [tabBarStyle],
  );

  const tabScreenOptions = useMemo<
    Record<TabRouteName, BottomTabNavigationOptions>
  >(
    () =>
      TAB_CONFIGS.reduce(
        (acc, tab) => {
          const badgeCount = tab.badge?.enabled
            ? badgeCounts[tab.badge.storeKey]
            : 0;

          acc[tab.name] = {
            tabBarIcon: ({ focused }) => (
              <AnimatedTabIcon
                tab={tab}
                focused={focused}
                badgeCount={badgeCount}
              />
            ),
            tabBarAccessibilityLabel: getAccessibilityLabel(tab, false),
            tabBarButtonTestID: `tab-${tab.name.toLowerCase()}`,
          };

          return acc;
        },
        {} as Record<TabRouteName, BottomTabNavigationOptions>,
      ),
    [badgeCounts],
  );

  const trackTabOpen = useCallback(
    (tabName: TabRouteName) => {
      const tab = TAB_CONFIG_BY_ROUTE[tabName];
      if (!tab) {
        return;
      }

      setTimeout(() => {
        analytics.trackScreenView(`${tabName}Tab`);
        analytics.trackEvent(tab.analytics.eventName, {
          ...tab.analytics.properties,
          tab: tabName,
          role: userRole,
          authenticated: isAuthenticated,
        });

        useUserBehaviorStore.getState().trackEvent({
          type: "view",
          category: "navigation",
          metadata: {
            tab: tabName,
            role: userRole,
          },
        });
      });
    },
    [analytics, isAuthenticated, userRole],
  );

  const handleTabPress = useCallback(
    (tab: TabConfig, event: { preventDefault: () => void }) => {
      const isAuthorized = hasTabPermission(tab, userRole);

      if (!isAuthorized) {
        event.preventDefault();

        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );

        setTimeout(() => {
          analytics.trackEvent("tab_access_denied", {
            tab: tab.name,
            requiredRole: tab.permissions.minRole,
            userRole,
            authenticated: isAuthenticated,
          });
        });

        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      trackTabOpen(tab.name);
      onTabPress?.(tab.name);
    },
    [analytics, isAuthenticated, onTabPress, trackTabOpen, userRole],
  );

  const screenListeners = useCallback(
    ({ route }: { route: { name: string } }) => ({
      tabPress: (event: { preventDefault: () => void }) => {
        const tab = TAB_CONFIG_BY_ROUTE[route.name as TabRouteName];
        if (tab) {
          handleTabPress(tab, event);
        }
      },
    }),
    [handleTabPress],
  );

  useEffect(() => {
    return;
  }, []);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={navigatorScreenOptions}
      screenListeners={screenListeners}
    >
      {visibleTabs.map((tab) => {
        const isAuthorized = hasTabPermission(tab, userRole);
        const component = isAuthorized
          ? TAB_STACK_SCREENS[tab.name]
          : RESTRICTED_TAB_SCREENS[tab.name];

        return (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            component={component}
            options={tabScreenOptions[tab.name]}
          />
        );
      })}
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    paddingTop: 8,
    ...tabBarShadow,
  },
  tabBarItem: {
    paddingTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    color: "#F8FAFC",
    fontWeight: "700",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
  },
  lockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
    padding: 24,
  },
  lockedTitle: {
    fontSize: 18,
    color: "#F8FAFC",
    fontWeight: "700",
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
  },
});

export default BottomTabNavigator;
