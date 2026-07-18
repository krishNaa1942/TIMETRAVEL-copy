/**
 * Auth Stack - Unauthenticated Navigation Flow
 * Handles login, registration, forgot password, and onboarding
 */

import React, { Suspense } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { headerConfigs } from '../config';
import { AuthStackParamList } from '../types';

// Lazy load screens for better performance
const AuthScreen = React.lazy(() => import('@/screens/AuthScreen'));

// ── Stack Navigator ───────────────────────────────────────────────
const Stack = createNativeStackNavigator<AuthStackParamList>();

// ── Loading Fallback ──────────────────────────────────────────────
function AuthLoadingFallback() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

// ── Auth Stack Component ───────────────────────────────────────────
export function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        ...headerConfigs.dark,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="Login"
        options={{
          headerShown: false,
        }}
      >
        {() => (
          <Suspense fallback={<AuthLoadingFallback />}>
            <AuthScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Register"
        options={{
          title: 'Create Account',
        }}
      >
        {() => (
          <Suspense fallback={<AuthLoadingFallback />}>
            <AuthScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="ForgotPassword"
        options={{
          title: 'Reset Password',
        }}
      >
        {() => (
          <Suspense fallback={<AuthLoadingFallback />}>
            <AuthScreen />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Onboarding"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      >
        {() => (
          <Suspense fallback={<AuthLoadingFallback />}>
            <AuthScreen />
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

export default AuthStack;