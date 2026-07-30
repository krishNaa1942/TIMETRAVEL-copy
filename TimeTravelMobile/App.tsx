/**
 * TimeTravel App - Production Entry Point
 * 
 * Architecture:
 * - NavOS: Enterprise-grade navigation system
 * - QueryClient: React Query for data fetching
 * - PaperProvider: Material Design components
 * - GestureHandler: Touch interactions
 */

import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";

import { NavOS } from "@/navigation/NavOS";
import { useUIStore } from "@/stores/uiStore";
import { lightTheme, darkTheme } from "@/theme/colors";
import { queryClient } from "@/api/queryClient";
import { initializeStores } from "@/stores";
import LoadingSpinner from "@/components/Common/LoadingSpinner";

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
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={paperTheme}>
            <NavOS />
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});