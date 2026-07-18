/**
 * Settings Stack - Settings Feature Navigation
 * Handles profile, preferences, and app settings
 */

import React, { Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { defaultStackOptions, screenTitles } from '../config';
import { SettingsStackParamList } from '../types';

// Lazy load screens
const ProfileScreen = React.lazy(() => import('@/screens/ProfileScreen'));
const CurrencyScreen = React.lazy(() => import('@/screens/CurrencyScreen'));
const PhrasebookScreen = React.lazy(() => import('@/screens/PhrasebookScreen'));
const RoutePlannerScreen = React.lazy(() => import('@/screens/RoutePlannerScreen'));

// ── Stack Navigator ───────────────────────────────────────────────
const Stack = createNativeStackNavigator<SettingsStackParamList>();

// ── Loading Fallback ──────────────────────────────────────────────
function ScreenLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

// ── Settings Stack Component ───────────────────────────────────────
export function SettingsStack() {
  return (
    <Stack.Navigator
      initialRouteName="SettingsMain"
      screenOptions={defaultStackOptions}
    >
      <Stack.Screen
        name="SettingsMain"
        options={{
          title: screenTitles.Profile,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ProfileScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Currency"
        options={{
          title: screenTitles.Currency,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <CurrencyScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Phrasebook"
        options={{
          title: screenTitles.Phrasebook,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <PhrasebookScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="RoutePlanner"
        options={{
          title: screenTitles.RoutePlanner,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <RoutePlannerScreen />
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

export default SettingsStack;