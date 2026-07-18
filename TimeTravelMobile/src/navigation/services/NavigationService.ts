/**
 * Navigation Service
 * Stable navigation reference outside React render cycle
 * Provides type-safe navigation from anywhere in the app
 */

import { createNavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList, NavigationState } from "./types";

// Create stable navigation ref outside React
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Navigation state persistence key
const NAVIGATION_STATE_KEY = "@nav_state";

// Track if navigation is ready
let isNavigationReady = false;
let pendingActions: Array<() => void> = [];

/**
 * Navigation Service - Singleton pattern for global navigation
 */
export class NavigationService {
  /**
   * Check if navigation is ready
   */
  static isReady(): boolean {
    return isNavigationReady && navigationRef.isReady();
  }

  /**
   * Mark navigation as ready and flush pending actions
   */
  static setReady(ready: boolean): void {
    isNavigationReady = ready;
    if (ready && pendingActions.length > 0) {
      pendingActions.forEach((action) => action());
      pendingActions = [];
    }
  }

  /**
   * Execute action when navigation is ready
   */
  static whenReady(action: () => void): void {
    if (this.isReady()) {
      action();
    } else {
      pendingActions.push(action);
    }
  }

  /**
   * Navigate to screen with params
   */
  static navigate<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName],
  ): void {
    this.whenReady(() => {
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate(name, params);
      }
    });
  }

  /**
   * Go back to previous screen
   */
  static goBack(): void {
    this.whenReady(() => {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
      }
    });
  }

  /**
   * Reset navigation state to a new state
   */
  static reset<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName],
  ): void {
    this.whenReady(() => {
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: name as never, params: params as never }],
        });
      }
    });
  }

  /**
   * Replace current screen
   */
  static replace<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName],
  ): void {
    this.whenReady(() => {
      if (navigationRef.isReady()) {
        navigationRef.dispatch({
          type: "REPLACE",
          payload: { name, params: params as any },
        });
      }
    });
  }

  /**
   * Push screen onto stack
   */
  static push<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName],
  ): void {
    this.whenReady(() => {
      if (navigationRef.isReady()) {
        navigationRef.dispatch({
          type: "PUSH",
          payload: { name: name as never, params: params as never },
        });
      }
    });
  }

  /**
   * Pop n screens from stack
   */
  static pop(count: number = 1): void {
    this.whenReady(() => {
      if (navigationRef.isReady()) {
        navigationRef.dispatch({
          type: "POP",
          payload: { count },
        });
      }
    });
  }

  /**
   * Pop to top of stack
   */
  static popToTop(): void {
    this.whenReady(() => {
      if (navigationRef.isReady()) {
        navigationRef.dispatch({
          type: "POP_TO_TOP",
        });
      }
    });
  }

  /**
   * Get current route name
   */
  static getCurrentRoute(): string | undefined {
    if (navigationRef.isReady()) {
      const route = navigationRef.getCurrentRoute();
      return route?.name;
    }
    return undefined;
  }

  /**
   * Get current route params
   */
  static getCurrentParams<RouteName extends keyof RootStackParamList>():
    | RootStackParamList[RouteName]
    | undefined {
    if (navigationRef.isReady()) {
      const route = navigationRef.getCurrentRoute();
      return route?.params as RootStackParamList[RouteName] | undefined;
    }
    return undefined;
  }

  /**
   * Get full navigation state
   */
  static getState(): NavigationState | undefined {
    if (navigationRef.isReady()) {
      return navigationRef.getState() as NavigationState;
    }
    return undefined;
  }

  /**
   * Check if can go back
   */
  static canGoBack(): boolean {
    return navigationRef.isReady() && navigationRef.canGoBack();
  }

  /**
   * Navigate to Auth stack
   */
  static navigateToAuth(): void {
    this.reset("Auth");
  }

  /**
   * Navigate to Main app
   */
  static navigateToMain(): void {
    this.reset("MainTabs");
  }

  /**
   * Navigate to deep link path
   */
  static navigateToPath(path: string, params?: Record<string, any>): void {
    // Route mapping for deep links
    const routeMap: Record<string, keyof RootStackParamList> = {
      destination: "DestinationDetail",
      budget: "Budget",
      itinerary: "Itinerary",
      packing: "Packing",
      favorites: "Favorites",
      currency: "Currency",
      compare: "Compare",
      places: "Places",
      route: "RoutePlanner",
      workspace: "TripWorkspace",
      expenses: "Expenses",
      journal: "TravelJournal",
      reservations: "Reservations",
      sharing: "TripSharing",
      news: "NewsFeed",
      stats: "TravelStats",
      phrasebook: "Phrasebook",
    };

    const routeName = routeMap[path.toLowerCase()];
    if (routeName) {
      this.navigate(routeName, params as any);
    }
  }

  /**
   * Open external URL (for deep links)
   */
  static handleDeepLink(url: string): boolean {
    try {
      const parsed = this.parseDeepLink(url);
      if (parsed) {
        this.navigate(parsed.route as any, parsed.params as any);
        return true;
      }
    } catch (error) {
      console.error("[Navigation] Failed to handle deep link:", error);
    }
    return false;
  }

  /**
   * Parse deep link URL
   */
  private static parseDeepLink(
    url: string,
  ): { route: string; params: Record<string, any> } | null {
    // Support formats: timetravel://destination/agra, https://timetravel.app/destination/agra
    const urlRegex =
      /^(?:timetravel:\/\/|https?:\/\/timetravel\.app\/)([^\/]+)\/?(.+)?$/;
    const match = url.match(urlRegex);

    if (match) {
      const [, route, paramStr] = match;
      const params: Record<string, any> = {};

      if (paramStr) {
        // Parse query params
        const queryMatch = paramStr.match(/\?(.+)$/);
        if (queryMatch) {
          const searchParams = new URLSearchParams(queryMatch[1]);
          searchParams.forEach((value, key) => {
            params[key] = value;
          });
        } else {
          // Treat as ID
          params.id = paramStr;
        }
      }

      return { route, params };
    }

    return null;
  }
}

// Export convenience functions
export const navigate = NavigationService.navigate;
export const goBack = NavigationService.goBack;
export const reset = NavigationService.reset;
export const replace = NavigationService.replace;
export const push = NavigationService.push;
export const pop = NavigationService.pop;
export const getCurrentRoute = NavigationService.getCurrentRoute;

export default NavigationService;
