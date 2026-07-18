/**
 * SkeletonLoader Component - Loading placeholder
 */
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import type { SkeletonLoaderProps } from '../types';

const SkeletonBlock: React.FC<{ width?: number | string; height?: number; style?: any }> = ({ width = '100%', height = 16, style }) => {
  const opacity = useSharedValue(0.3);
  
  opacity.value = withRepeat(
    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
    -1,
    true
  );
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  
  return <Animated.View style={[styles.skeleton, { width, height }, animatedStyle, style]} />;
};

const SkeletonLoaderComponent: React.FC<SkeletonLoaderProps> = ({ visible }) => {
  if (!visible) return null;
  
  return (
    <View style={styles.container}>
      <View style={styles.headerSkeleton}>
        <SkeletonBlock width={100} height={100} style={styles.avatarSkeleton} />
        <SkeletonBlock width={150} height={24} style={styles.nameSkeleton} />
        <SkeletonBlock width={100} height={14} />
      </View>
      <SkeletonBlock height={80} style={styles.cardSkeleton} />
      <SkeletonBlock height={200} style={styles.cardSkeleton} />
      <SkeletonBlock height={120} style={styles.cardSkeleton} />
      <SkeletonBlock height={150} style={styles.cardSkeleton} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  skeleton: { backgroundColor: '#E5E7EB', borderRadius: 8 },
  headerSkeleton: { alignItems: 'center', marginBottom: 24 },
  avatarSkeleton: { borderRadius: 50, marginBottom: 12 },
  nameSkeleton: { marginBottom: 8 },
  cardSkeleton: { marginVertical: 8, borderRadius: 16 },
});

export const SkeletonLoader = memo(SkeletonLoaderComponent);
export default SkeletonLoader;