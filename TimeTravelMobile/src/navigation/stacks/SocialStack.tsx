/**
 * Social Stack - Social Feature Navigation
 * Handles journal, news feed, and travel stats
 */

import React, { Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { defaultStackOptions, screenTitles } from '../config';
import { SocialStackParamList } from '../types';

// Lazy load screens
const TravelJournalScreen = React.lazy(() => import('@/screens/TravelJournalScreen'));
const NewsFeedScreen = React.lazy(() => import('@/screens/NewsFeedScreen'));
const TravelStatsScreen = React.lazy(() => import('@/screens/TravelStatsScreen'));

// ── Stack Navigator ───────────────────────────────────────────────
const Stack = createNativeStackNavigator<SocialStackParamList>();

// ── Loading Fallback ──────────────────────────────────────────────
function ScreenLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

// ── Social Stack Component ────────────────────────────────────────
export function SocialStack() {
  return (
    <Stack.Navigator
      initialRouteName="TravelJournal"
      screenOptions={defaultStackOptions}
    >
      <Stack.Screen
        name="TravelJournal"
        options={{
          title: screenTitles.TravelJournal,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <TravelJournalScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="NewsFeed"
        options={{
          title: screenTitles.NewsFeed,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <NewsFeedScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="TravelStats"
        options={{
          title: screenTitles.TravelStats,
        }}
      >
        {() => (
          <Suspense fallback={<ScreenLoadingFallback />}>
            <TravelStatsScreen />
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

export default SocialStack;