/**
 * Navigation Analytics - Screen Tracking & Event Logging
 * Production-grade analytics integration for navigation events
 */

import { NavigationContainerRef } from '@react-navigation/native';
import { NavigationEvent } from '../types';

// ── Types ─────────────────────────────────────────────────────────
type ScreenViewEvent = {
  screen: string;
  params?: Record<string, any>;
  timestamp: number;
};

type NavigationEventHandler = (event: NavigationEvent) => void;

// ── Configuration ─────────────────────────────────────────────────
const ANALYTICS_ENABLED = !__DEV__;
const SCREEN_BLACKLIST = ['Splash', 'Loading']; // Screens to exclude from tracking

// ── State ─────────────────────────────────────────────────────────
let navigationRef: NavigationContainerRef<any> | null = null;
let previousScreen: string | undefined;
let eventHandlers: NavigationEventHandler[] = [];

// ── Analytics Service ──────────────────────────────────────────────
class NavigationAnalyticsService {
  /**
   * Initialize analytics with navigation ref
   */
  static initialize(ref: NavigationContainerRef<any>): () => void {
    navigationRef = ref;
    
    // Track initial screen
    this.trackCurrentScreen();
    
    // Return cleanup function
    return () => {
      navigationRef = null;
      previousScreen = undefined;
      eventHandlers = [];
    };
  }

  /**
   * Track current screen
   */
  static trackCurrentScreen(): void {
    if (!navigationRef) return;

    const currentRoute = navigationRef.getCurrentRoute();
    if (!currentRoute) return;

    const screenName = currentRoute.name;
    
    // Skip blacklisted screens
    if (SCREEN_BLACKLIST.includes(screenName)) return;

    // Log screen view
    this.logScreenView({
      screen: screenName,
      params: currentRoute.params as Record<string, any>,
      timestamp: Date.now(),
    });

    // Update previous screen
    previousScreen = screenName;
  }

  /**
   * Log screen view event
   */
  static logScreenView(event: ScreenViewEvent): void {
    // Console log in dev mode
    if (__DEV__) {
      console.log('📊 Screen View:', event.screen, event.params || '');
    }

    // Send to analytics service (e.g., Firebase Analytics, Mixpanel, etc.)
    if (ANALYTICS_ENABLED) {
      this.sendToAnalytics(event);
    }

    // Notify event handlers
    this.notifyHandlers({
      ...event,
      previousScreen,
    });
  }

  /**
   * Send to external analytics service
   */
  static sendToAnalytics(event: ScreenViewEvent): void {
    // Integration point for analytics services
    // Example: Firebase Analytics
    // analytics().logScreenView({
    //   screen_name: event.screen,
    //   screen_class: event.screen,
    // });

    // Example: Mixpanel
    // mixpanel.track('Screen View', {
    //   screen: event.screen,
    //   params: event.params,
    // });
  }

  /**
   * Subscribe to navigation events
   */
  static subscribe(handler: NavigationEventHandler): () => void {
    eventHandlers.push(handler);
    return () => {
      eventHandlers = eventHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Notify all handlers
   */
  static notifyHandlers(event: NavigationEvent): void {
    eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('📊 Navigation event handler error:', error);
      }
    });
  }

  /**
   * Log custom navigation event
   */
  static logEvent(eventName: string, params?: Record<string, any>): void {
    if (__DEV__) {
      console.log('📊 Navigation Event:', eventName, params || '');
    }

    if (ANALYTICS_ENABLED) {
      // Send to analytics
      // analytics().logEvent(eventName, params);
    }
  }

  /**
   * Get previous screen name
   */
  static getPreviousScreen(): string | undefined {
    return previousScreen;
  }

  /**
   * Get current screen name
   */
  static getCurrentScreen(): string | undefined {
    if (!navigationRef) return undefined;
    const route = navigationRef.getCurrentRoute();
    return route?.name;
  }
}

// ── Export Singleton ───────────────────────────────────────────────
export const NavigationAnalytics = NavigationAnalyticsService;

// ── Hook for Components ────────────────────────────────────────────
export function useNavigationAnalytics() {
  return {
    logEvent: NavigationAnalytics.logEvent,
    getPreviousScreen: NavigationAnalytics.getPreviousScreen,
    getCurrentScreen: NavigationAnalytics.getCurrentScreen,
    subscribe: NavigationAnalytics.subscribe,
  };
}

export default NavigationAnalytics;