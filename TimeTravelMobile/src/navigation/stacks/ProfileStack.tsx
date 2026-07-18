/**
 * 👤 PROFILE STACK NAVIGATOR
 * ===========================
 * Feature-based stack for Profile tab
 */

import React, { Suspense, lazy, Component, ReactNode } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const ProfileScreen = lazy(() => import('../../screens/ProfileScreen'));

export type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileEdit: undefined;
  ProfileSettings: { section?: string };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

class ProfileErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <View style={styles.errorContainer}><Text style={styles.errorText}>Failed to load Profile</Text></View>;
    }
    return this.props.children;
  }
}

const LoadingFallback = () => (
  <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>
);

const ProfileStack: React.FC = () => (
  <ProfileErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      </Stack.Navigator>
    </Suspense>
  </ProfileErrorBoundary>
);

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  errorText: { color: '#EF4444', fontSize: 16 },
});

export default ProfileStack;