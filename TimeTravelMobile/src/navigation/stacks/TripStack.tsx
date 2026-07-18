/**
 * Trip Stack - Trip Management Feature Navigation
 * Handles all trip-related screens with lazy loading
 */

import React, { Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { defaultStackOptions, headerConfigs, screenTitles } from '../config';
import { TripStackParamList } from '../types';

// Lazy load screens for code splitting
const TripsScreen = React.lazy(() => import('@/screens/TripsScreen'));
const TripWorkspaceScreen = React.lazy(() => import('@/screens/TripWorkspaceScreen'));
const BudgetScreen = React.lazy(() => import('@/screens/BudgetScreen'));
const ItineraryScreen = React.lazy(() => import('@/screens/ItineraryScreen'));
const PackingScreen = React.lazy(() => import('@/screens/PackingScreen'));
const ExpenseTrackerScreen = React.lazy(() => import('@/screens/ExpenseTrackerScreen'));
const ReservationsScreen = React.lazy(() => import('@/screens/ReservationsScreen'));
const TripSharingScreen = React.lazy(() => import('@/screens/TripSharingScreen'));

// ── Stack Navigator ───────────────────────────────────────────────
const Stack = createNativeStackNavigator<TripStackParamList>();

// ── Loading Fallback ──────────────────────────────────────────────
function ScreenLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

// ── Trip Stack Component ───────────────────────────────────────────
export function TripStack() {
  return (
    <Stack.Navigator
      initialRouteName="TripList"
      screenOptions={defaultStackOptions}
    >
      <Stack.Screen
        name="TripList"
        options={{
          title: screenTitles.Trips,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <TripsScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="TripWorkspace"
        options={{
          title: screenTitles.TripWorkspace,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <TripWorkspaceScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Budget"
        options={{
          title: screenTitles.Budget,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <BudgetScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Itinerary"
        options={{
          title: screenTitles.Itinerary,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ItineraryScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Packing"
        options={{
          title: screenTitles.Packing,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <PackingScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Expenses"
        options={{
          title: screenTitles.Expenses,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ExpenseTrackerScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Reservations"
        options={{
          title: screenTitles.Reservations,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ReservationsScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="TripSharing"
        options={{
          title: screenTitles.TripSharing,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <TripSharingScreen />
          </Suspense>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});

export default TripStack;