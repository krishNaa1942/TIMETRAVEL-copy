/**
 * 🧩 LAZY SCREEN WRAPPER
 * Enterprise-grade lazy loading with retry, skeleton, and error handling
 *
 * FEATURES:
 * - Automatic retry on import failure
 * - Skeleton loader while loading
 * - Error boundary integration
 * - Preloading support
 * - Analytics tracking
 */

import React, {
  ComponentType,
  Suspense,
  useEffect,
  useState,
  useCallback,
  memo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { NavigationErrorBoundary } from "./NavigationErrorBoundary";
import { ScreenSkeletonLoader } from "./ScreenSkeletonLoader";
import { NavigationAnalytics as navigationAnalytics } from "../utils/NavigationAnalytics";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface LazyScreenWrapperProps {
  /** Lazy import function */
  loader: () => Promise<{ default: ComponentType<any> }>;
  /** Screen name for analytics */
  screenName: string;
  /** Stack name for context */
  stackName?: string;
  /** Custom skeleton component */
  SkeletonComponent?: React.ComponentType;
  /** Retry attempts on failure */
  retryAttempts?: number;
  /** Enable analytics tracking */
  trackAnalytics?: boolean;
  /** Additional props to pass to the loaded screen */
  screenProps?: Record<string, unknown>;
  /** Preload delay in ms (0 = immediate preload) */
  preloadDelay?: number;
}

interface LazyState {
  Component: ComponentType<any> | null;
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
}

// ─────────────────────────────────────────────────────────────
// RETRY INDICATOR COMPONENT
// ─────────────────────────────────────────────────────────────

const RetryIndicator = memo(function RetryIndicator({
  retryCount,
  maxRetries,
}: {
  retryCount: number;
  maxRetries: number;
}) {
  if (retryCount === 0) return null;

  return (
    <View style={styles.retryIndicator}>
      <Text style={styles.retryText}>
        Retrying... ({retryCount}/{maxRetries})
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────
// LAZY SCREEN WRAPPER COMPONENT
// ─────────────────────────────────────────────────────────────

export const LazyScreenWrapper = memo(function LazyScreenWrapper({
  loader,
  screenName,
  stackName = "Unknown",
  SkeletonComponent,
  retryAttempts = 3,
  trackAnalytics = true,
  screenProps = {},
  preloadDelay = 0,
}: LazyScreenWrapperProps) {
  const [state, setState] = useState<LazyState>({
    Component: null,
    error: null,
    retryCount: 0,
    isRetrying: false,
  });

  const navigation = useNavigation();

  // Load the component
  const loadComponent = useCallback(
    async (isRetry = false) => {
      if (isRetry) {
        setState((prev) => ({ ...prev, isRetrying: true }));
      }

      try {
        const module = await loader();

        setState((prev) => ({
          ...prev,
          Component: module.default,
          error: null,
          retryCount: 0,
          isRetrying: false,
        }));

        if (trackAnalytics) {
          navigationAnalytics.logEvent("screen_loaded", {
            screenName,
            stackName,
          });
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error as Error,
          retryCount: isRetry ? prev.retryCount + 1 : 1,
          isRetrying: false,
        }));

        if (trackAnalytics) {
          navigationAnalytics.logEvent("screen_load_error", {
            screenName,
            stackName,
            error: (error as Error).message,
          });
        }
      }
    },
    [loader, screenName, stackName, trackAnalytics],
  );

  // Auto-retry logic
  const handleRetry = useCallback(() => {
    if (state.retryCount < retryAttempts) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, state.retryCount - 1) * 1000;
      setTimeout(() => loadComponent(true), delay);
    }
  }, [state.retryCount, retryAttempts, loadComponent]);

  // Initial load
  useEffect(() => {
    const timeoutId =
      preloadDelay > 0
        ? setTimeout(() => loadComponent(), preloadDelay)
        : undefined;

    if (!timeoutId) {
      loadComponent();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loadComponent, preloadDelay]);

  // Auto-retry on error
  useEffect(() => {
    if (state.error && state.retryCount < retryAttempts) {
      handleRetry();
    }
  }, [state.error, state.retryCount, retryAttempts, handleRetry]);

  // Manual retry handler
  const onManualRetry = useCallback(() => {
    setState((prev) => ({ ...prev, retryCount: 0 }));
    loadComponent();
  }, [loadComponent]);

  // Loading state
  if (!state.Component && !state.error) {
    const Skeleton = SkeletonComponent || ScreenSkeletonLoader;
    return (
      <View style={styles.container}>
        <Skeleton />
        {state.isRetrying && (
          <RetryIndicator
            retryCount={state.retryCount}
            maxRetries={retryAttempts}
          />
        )}
      </View>
    );
  }

  // Error state
  if (state.error && state.retryCount >= retryAttempts) {
    return (
      <NavigationErrorBoundary
        screenName={screenName}
        stackName={stackName}
        error={state.error}
        onRetry={onManualRetry}
      />
    );
  }

  // Success - render the loaded component
  const LoadedComponent = state.Component;

  if (!LoadedComponent) {
    return null;
  }

  return (
    <NavigationErrorBoundary screenName={screenName} stackName={stackName}>
      <LoadedComponent {...screenProps} />
    </NavigationErrorBoundary>
  );
});

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  retryIndicator: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  retryText: {
    color: "#94A3B8",
    fontSize: 12,
    fontFamily: "Inter-Medium",
  },
});

export default LazyScreenWrapper;
