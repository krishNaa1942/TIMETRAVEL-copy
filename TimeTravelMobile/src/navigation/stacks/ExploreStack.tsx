/**
 * Explore Stack - Discovery Feature Navigation
 * Handles explore, destinations, favorites, and compare screens
 */

import React, { Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { defaultStackOptions, headerConfigs, screenTitles } from '../config';
import { ExploreStackParamList } from '../types';

// Lazy load screens
const ExploreScreen = React.lazy(() => import('@/screens/ExploreScreen'));
const DestinationDetailScreen = React.lazy(() => import('@/screens/DestinationDetailScreen'));
const PlacesScreen = React.lazy(() => import('@/screens/PlacesScreen'));
const CompareScreen = React.lazy(() => import('@/screens/CompareScreen'));
const FavoritesScreen = React.lazy(() => import('@/screens/FavoritesScreen'));

// ── Stack Navigator ───────────────────────────────────────────────
const Stack = createNativeStackNavigator<ExploreStackParamList>();

// ── Loading Fallback ──────────────────────────────────────────────
function ScreenLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

// ── Explore Stack Component ────────────────────────────────────────
export function ExploreStack() {
  return (
    <Stack.Navigator
      initialRouteName="ExploreMain"
      screenOptions={defaultStackOptions}
    >
      <Stack.Screen
        name="ExploreMain"
        options={{
          title: screenTitles.Explore,
          headerShown: false,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ExploreScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="DestinationDetail"
        options={{
          ...headerConfigs.transparent,
          title: screenTitles.DestinationDetail,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <DestinationDetailScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Places"
        options={{
          title: screenTitles.Places,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <PlacesScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Compare"
        options={{
          title: screenTitles.Compare,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <CompareScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Favorites"
        options={{
          title: screenTitles.Favorites,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <FavoritesScreen />
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

export default ExploreStack;