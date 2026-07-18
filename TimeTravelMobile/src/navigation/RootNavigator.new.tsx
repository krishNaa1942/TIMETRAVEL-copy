/**
 * Root Navigator - Production Grade Navigation System
 * 
 * Features:
 * - Auth gating with splash screen
 * - Deep linking support
 * - Error boundary integration
 * - Analytics tracking
 * - Role-based route protection
 */

import React, { useEffect, useCallback } from 'react';
import { NavigationContainer, LinkingOptions, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import * as Linking from 'expo-linking';

import { RootStackParamList } from './types';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { defaultStackOptions, deepLinkConfig } from './config';
import { NavigationAnalytics } from './utils/NavigationAnalytics';

// Lazy load navigators
const AuthStack = React.lazy(() => import('./stacks/AuthStack'));
const AppStack = React.lazy(() => import('./stacks/AppStack'));

// ── Stack Navigator ───────────────────────────────────────────────
const Stack = createNativeStackNavigator<RootStackParamList>();

// ── Splash Screen Component ────────────────────────────────────────
function SplashScreen() {
  return (
    <View style={styles.splashContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.splashText}>Loading...</Text>
    </View>
  );
}

// ── Error Screen Component ─────────────────────────────────────────
function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <Text style={styles.retryText} onPress={onRetry}>Tap to retry</Text>
    </View>
  );
}

// ── Deep Linking Configuration ─────────────────────────────────────
const linking: LinkingOptions<any> = {
  prefixes: [
    Linking.createURL('/'),
    'timetravel://',
    'https://timetravel.app',
    'https://www.timetravel.app',
  ],
  config: {
    screens: deepLinkConfig.config.screens,
  },
  async getInitialURL() {
    // Check for initial URL from deep link
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener: (url: string) => void) {
    // Listen for incoming URLs
    const subscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
      listener(url);
    });
    return () => subscription.remove();
  },
};

// ── Root Navigator Content (inside AuthProvider) ───────────────────
function RootNavigatorContent() {
  const { status, error, checkAuthStatus } = useAuthContext();
  const navigationRef = useNavigationContainerRef();

  // Track screen changes for analytics
  useEffect(() => {
    const unsubscribe = NavigationAnalytics.initialize(navigationRef);
    return unsubscribe;
  }, [navigationRef]);

  // Handle retry on error
  const handleRetry = useCallback(async () => {
    await checkAuthStatus();
  }, [checkAuthStatus]);

  // Render based on auth status
  const renderContent = () => {
    // Show splash during initial load
    if (status === 'idle' || status === 'loading') {
      return <SplashScreen />;
    }

    // Show error screen on auth failure
    if (status === 'error') {
      return (
        <ErrorScreen 
          error={error || 'Authentication failed'} 
          onRetry={handleRetry} 
        />
      );
    }

    // Show auth stack for unauthenticated users
    if (status === 'unauthenticated') {
      return (
        <React.Suspense fallback={<SplashScreen />}>
          <AuthStack />
        </React.Suspense>
      );
    }

    // Show app stack for authenticated users
    return (
      <React.Suspense fallback={<SplashScreen />}>
        <AppStack />
      </React.Suspense>
    );
  };

  return (
    <NavigationContainer 
      linking={linking}
      ref={navigationRef}
      onStateChange={(state) => {
        // Log navigation state changes for debugging
        if (__DEV__) {
          const currentRoute = navigationRef.getCurrentRoute();
          console.log('🧭 Navigation:', currentRoute?.name, currentRoute?.params);
        }
      }}
      onUnhandledAction={(action) => {
        console.warn('🧭 Unhandled navigation action:', action);
      }}
    >
      {renderContent()}
    </NavigationContainer>
  );
}

// ── Root Navigator Component ────────────────────────────────────────
export function RootNavigator() {
  return (
    <AuthProvider>
      <RootNavigatorContent />
    </AuthProvider>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  splashText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
});

export default RootNavigator;