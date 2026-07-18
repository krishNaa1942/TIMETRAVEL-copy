/**
 * Main Tab Navigator - Bottom Tab Navigation
 * Primary navigation for authenticated users
 */

import React, { Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { tabBarConfig, tabIcons } from '../config';
import { MainTabParamList } from '../types';

// Lazy load screens
const HomeScreen = React.lazy(() => import('@/screens/HomeScreen'));
const ExploreScreen = React.lazy(() => import('@/screens/ExploreScreen'));
const ChatScreen = React.lazy(() => import('@/screens/ChatScreen'));
const TripsScreen = React.lazy(() => import('@/screens/TripsScreen'));
const ProfileScreen = React.lazy(() => import('@/screens/ProfileScreen'));

// ── Tab Navigator ─────────────────────────────────────────────────
const Tab = createBottomTabNavigator<MainTabParamList>();

// ── Loading Fallback ──────────────────────────────────────────────
function TabLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

// ── Tab Icon Component ─────────────────────────────────────────────
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons = tabIcons[name] || { focused: '●', unfocused: '○' };
  const icon = focused ? icons.focused : icons.unfocused;
  
  return (
    <Text style={styles.tabIcon}>
      {icon}
    </Text>
  );
}

// ── Main Tab Navigator Component ───────────────────────────────────
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        ...tabBarConfig.screenOptions,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name.replace('Tab', '')} focused={focused} />
        ),
      })}
    >
      <Tab.Screen
        name="HomeTab"
        options={{
          tabBarLabel: 'Home',
        }}
      >
        {() => (
          <Suspense fallback={<TabLoadingFallback />}>
            <HomeScreen />
          </Suspense>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="ExploreTab"
        options={{
          tabBarLabel: 'Explore',
        }}
      >
        {() => (
          <Suspense fallback={<TabLoadingFallback />}>
            <ExploreScreen />
          </Suspense>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="ChatTab"
        options={{
          tabBarLabel: 'Chat',
        }}
      >
        {() => (
          <Suspense fallback={<TabLoadingFallback />}>
            <ChatScreen />
          </Suspense>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="TripsTab"
        options={{
          tabBarLabel: 'Trips',
        }}
      >
        {() => (
          <Suspense fallback={<TabLoadingFallback />}>
            <TripsScreen />
          </Suspense>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: 'Profile',
        }}
      >
        {() => (
          <Suspense fallback={<TabLoadingFallback />}>
            <ProfileScreen />
          </Suspense>
        )}
      </Tab.Screen>
    </Tab.Navigator>
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
  tabIcon: {
    fontSize: 24,
  },
});

export default MainTabNavigator;