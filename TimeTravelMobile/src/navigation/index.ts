/**
 * Navigation System - Production Grade Exports
 * Centralized exports for the new modular navigation architecture
 */

// ── Types ─────────────────────────────────────────────────────────
export type {
  AuthStackParamList,
  MainTabParamList,
  TripStackParamList,
  ExploreStackParamList,
  SocialStackParamList,
  SettingsStackParamList,
  RootStackParamList,
  RouteProtection,
  AuthNavigationState,
  NavigationEvent,
  ScreenProps,
  StackScreenProps,
  TabScreenProps,
} from './types';

// ── Configuration ─────────────────────────────────────────────────
export {
  defaultStackOptions,
  headerConfigs,
  screenTitles,
  deepLinkConfig,
} from './config';

// ── Context & Providers ───────────────────────────────────────────
export { AuthProvider, useAuthContext } from './context/AuthContext';

// ── Navigators ────────────────────────────────────────────────────
export { RootNavigator } from './RootNavigator.new';
export { AuthStack } from './stacks/AuthStack';
export { AppStack } from './stacks/AppStack';
export { MainTabNavigator } from './stacks/MainTabNavigator';
export { TripStack } from './stacks/TripStack';
export { ExploreStack } from './stacks/ExploreStack';
export { SocialStack } from './stacks/SocialStack';
export { SettingsStack } from './stacks/SettingsStack';

// ── Utilities ─────────────────────────────────────────────────────
export { NavigationAnalytics, useNavigationAnalytics } from './utils/NavigationAnalytics';

// ── Legacy Exports (for backward compatibility) ───────────────────
export { default as BottomTabNavigator } from './BottomTabNavigator';
export { default as OldRootNavigator } from './RootNavigator';