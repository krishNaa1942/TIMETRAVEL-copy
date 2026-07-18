/**
 * TimeTravel App - Production Entry Point
 * 
 * Architecture:
 * - NavOS: Enterprise-grade navigation system
 * - QueryClient: React Query for data fetching
 * - PaperProvider: Material Design components
 * - GestureHandler: Touch interactions
 */

import React from "react";
import { StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";

import { NavOS } from "@/navigation/NavOS";
import { useUIStore } from "@/stores/uiStore";
import { lightTheme, darkTheme } from "@/theme/colors";
import { queryClient } from "@/api/queryClient";

export default function App() {
  const { themeDark } = useUIStore();
  const paperTheme = themeDark ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={styles.container}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <NavOS />
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});