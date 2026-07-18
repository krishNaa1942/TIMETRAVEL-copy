/**
 * 🛡️ NAVIGATION ERROR BOUNDARY
 * Enterprise-grade error handling for navigation
 *
 * FEATURES:
 * - Catches JavaScript errors in navigation tree
 * - Retry functionality
 * - Fallback navigation to safe routes
 * - Error logging and analytics
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface Props {
  children?: ReactNode;
  screenName?: string;
  stackName?: string;
  error?: Error | null;
  onRetry?: () => void;
  fallbackRoute?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ─────────────────────────────────────────────────────────────
// ERROR FALLBACK UI
// ─────────────────────────────────────────────────────────────

interface ErrorFallbackProps {
  error: Error | null;
  screenName: string;
  onRetry: () => void;
  onGoHome: () => void;
}

function ErrorFallback({
  error,
  screenName,
  onRetry,
  onGoHome,
}: ErrorFallbackProps) {
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver,
      }),
    ]).start();
  }, [scaleAnim, fadeAnim, useNativeDriver]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { transform: [{ scale: scaleAnim }], opacity: fadeAnim },
        ]}
      >
        {/* Error Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>

        {/* Error Message */}
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          {`Failed to load "${screenName}" screen`}
        </Text>

        {/* Error Details (Dev Only) */}
        {__DEV__ && error && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorText} numberOfLines={3}>
              {error.message}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.homeButton} onPress={onGoHome}>
            <Text style={styles.homeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ERROR BOUNDARY CLASS COMPONENT
// ─────────────────────────────────────────────────────────────

export class NavigationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: !!props.error,
      error: props.error || null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    // If error prop changed, update state
    if (props.error && !state.error) {
      return { hasError: true, error: props.error, errorInfo: null };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error
    console.error("🚨 Navigation Error:", {
      screen: this.props.screenName,
      stack: this.props.stackName,
      error: error.message,
      componentStack: errorInfo.componentStack,
    });

    // Track analytics
    // navigationAnalytics.trackError(this.props.screenName || 'Unknown', error);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryNavigationHandler
          screenName={this.props.screenName || "Unknown"}
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children ?? null;
  }
}

// ─────────────────────────────────────────────────────────────
// NAVIGATION HANDLER WRAPPER
// ─────────────────────────────────────────────────────────────

function ErrorBoundaryNavigationHandler({
  screenName,
  error,
  onRetry,
}: {
  screenName: string;
  error: Error | null;
  onRetry: () => void;
}) {
  const navigation = useNavigation();

  const handleGoHome = React.useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainApp" }],
      }),
    );
  }, [navigation]);

  return (
    <ErrorFallback
      error={error}
      screenName={screenName}
      onRetry={onRetry}
      onGoHome={handleGoHome}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    alignItems: "center",
    maxWidth: 320,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "Inter-Bold",
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 24,
    fontFamily: "Inter-Regular",
  },
  errorDetails: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: "100%",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    fontFamily: "monospace",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
  homeButton: {
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  homeButtonText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },
});

export default NavigationErrorBoundary;
