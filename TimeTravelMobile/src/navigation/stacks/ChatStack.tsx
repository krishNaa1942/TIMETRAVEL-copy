/**
 * 💬 CHAT STACK NAVIGATOR
 * ========================
 * Feature-based stack for Chat tab
 */

import React, { Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const ChatScreen = lazy(() => import('../../screens/ChatScreen'));

export type ChatStackParamList = {
  ChatMain: undefined;
  ChatConversation: { conversationId: string };
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

class ChatErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <View style={styles.errorContainer}><Text style={styles.errorText}>Failed to load Chat</Text></View>;
    }
    return this.props.children;
  }
}

const LoadingFallback = () => (
  <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#3B82F6" /></View>
);

const ChatStack: React.FC = () => (
  <ChatErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ChatMain" component={ChatScreen} />
      </Stack.Navigator>
    </Suspense>
  </ChatErrorBoundary>
);

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  errorText: { color: '#EF4444', fontSize: 16 },
});

export default ChatStack;