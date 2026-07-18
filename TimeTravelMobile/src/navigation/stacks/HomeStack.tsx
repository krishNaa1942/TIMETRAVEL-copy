/**
 * 🏠 HOME STACK NAVIGATOR
 * ========================
 * Feature-based stack for Home tab
 */

import React, { Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Lazy loaded screens
const HomeScreen = lazy(() => import('../../screens/HomeScreen'));

// Types
export type HomeStackParamList = {
  HomeMain: undefined;
  HomeDetail: { id: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

// Error Boundary
class HomeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Home Stack Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load Home</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Loading Fallback
const LoadingFallback = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#3B82F6" />
  </View>
);

// Main Component
const HomeStack: React.FC = () => {
  return (
    <HomeErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="HomeMain" component={HomeScreen} />
        </Stack.Navigator>
      </Suspense>
    </HomeErrorBoundary>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
  },
});

export default HomeStack;