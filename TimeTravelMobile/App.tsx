/**
 * TimeTravel App - Production Entry Point
 * 
 * Architecture:
 * - NavOS: Enterprise-grade navigation system
 * - QueryClient: React Query for data fetching
 * - PaperProvider: Material Design components
 * - GestureHandler: Touch interactions
 * - RootErrorBoundary: Global crash recovery
 */

import React, { type ComponentType, useEffect, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary, { type FallbackComponentProps } from "react-native-error-boundary";

import { NavOS } from "@/navigation/NavOS";
import { useUIStore } from "@/stores/uiStore";
import { lightTheme, darkTheme } from "@/theme/colors";
import { queryClient } from "@/api/queryClient";
import { initializeStores } from "@/stores";
import LoadingSpinner from "@/components/Common/LoadingSpinner";

const AppFallback: ComponentType<FallbackComponentProps> = ({
  error,
  resetError,
}) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorDetail}>{error?.message}</Text>
    <TouchableOpacity style={styles.errorButton} onPress={resetError}>
      <Text style={styles.errorButtonText}>Restart App</Text>
    </TouchableOpacity>
  </View>
);

export default function App() {
  const { themeDark } = useUIStore();
  const paperTheme = themeDark ? darkTheme : lightTheme;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeStores().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <LoadingSpinner />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ErrorBoundary FallbackComponent={AppFallback}>
          <QueryClientProvider client={queryClient}>
            <PaperProvider theme={paperTheme}>
              <NavOS />
            </PaperProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#0F172A",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 12,
  },
  errorDetail: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  errorButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});