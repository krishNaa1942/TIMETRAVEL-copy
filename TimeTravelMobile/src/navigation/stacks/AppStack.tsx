/**
 * App Stack - Main Application Navigation
 * Contains the main tab navigator and feature stacks
 */

import React, { Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { defaultStackOptions, headerConfigs, screenTitles } from '../config';
import { RootStackParamList } from '../types';
import { MainTabNavigator } from './MainTabNavigator';

// Lazy load feature stacks
const TripStack = React.lazy(() => import('./TripStack'));
const ExploreStack = React.lazy(() => import('./ExploreStack'));
const SocialStack = React.lazy(() => import('./SocialStack'));
const SettingsStack = React.lazy(() => import('./SettingsStack'));

// Lazy load direct screens
const DestinationDetailScreen = React.lazy(() => import('@/screens/DestinationDetailScreen'));

// ── Stack Navigator ───────────────────────────────────────────────
const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Loading Fallback ──────────────────────────────────────────────
function ScreenLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

// ── App Stack Component ────────────────────────────────────────────
export function AppStack() {
  return (
    <Stack.Navigator
      initialRouteName="MainApp"
      screenOptions={defaultStackOptions}
    >
      {/* Main Tab Navigator */}
      <Stack.Screen
        name="MainApp"
        component={MainTabNavigator}
        options={{
          headerShown: false,
        }}
      />

      {/* Feature Stacks */}
      <Stack.Screen
        name="TripStack"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <TripStack />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="ExploreStack"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <ExploreStack />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="SocialStack"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <SocialStack />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="SettingsStack"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <SettingsStack />
          </Suspense>
        )}
      </Stack.Screen>

      {/* Direct Access Screens */}
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

export default AppStack;