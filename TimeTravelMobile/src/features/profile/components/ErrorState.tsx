/**
 * ErrorState Component - Error display with retry
 */
import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '@/stores/uiStore';
import type { ErrorStateProps } from '../types';

const ErrorStateComponent: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const { themeDark } = useUIStore();
  
  const handleRetry = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry();
  }, [onRetry]);
  
  const errorMessage = typeof error === 'string' ? error : error?.message || 'An unexpected error occurred';
  
  return (
    <View style={[styles.container, themeDark && styles.containerDark]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.title, themeDark && styles.textDark]}>Something went wrong</Text>
      <Text style={[styles.message, themeDark && styles.messageDark]}>{errorMessage}</Text>
      <Pressable onPress={handleRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
        <Text style={styles.retryText}>Try Again</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FFFFFF' },
  containerDark: { backgroundColor: '#111827' },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  textDark: { color: '#F9FAFB' },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  messageDark: { color: '#9CA3AF' },
  retryButton: { backgroundColor: '#8B5CF6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  pressed: { opacity: 0.8 },
  retryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});

export const ErrorState = memo(ErrorStateComponent);
export default ErrorState;