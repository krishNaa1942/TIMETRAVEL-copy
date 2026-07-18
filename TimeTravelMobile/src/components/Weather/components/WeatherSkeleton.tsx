/**
 * 💀 WEATHER SKELETON
 * Shimmer loading state
 */

import React, { memo } from 'react';
import { View, StyleSheet, Animated, useAnimatedValue } from 'react-native';
import { colors, spacing } from '@/theme/colors';

interface Props {
  compact?: boolean;
}

function WeatherSkeleton({ compact = false }: Props) {
  const shimmer = useAnimatedValue(0);
  
  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.header}>
        <Animated.View style={[styles.iconSkeleton, { opacity }]} />
        <View style={styles.tempContainer}>
          <Animated.View style={[styles.tempSkeleton, { opacity }]} />
          <Animated.View style={[styles.descSkeleton, { opacity }]} />
        </View>
      </View>
      <View style={styles.stats}>
        {[1, 2, 3].map(i => (
          <View key={i} style={styles.stat}>
            <Animated.View style={[styles.statLabelSkeleton, { opacity }]} />
            <Animated.View style={[styles.statValueSkeleton, { opacity }]} />
          </View>
        ))}
      </View>
      {!compact && (
        <View style={styles.packing}>
          <Animated.View style={[styles.packLabelSkeleton, { opacity }]} />
          {[1, 2, 3].map(i => (
            <Animated.View key={i} style={[styles.packItemSkeleton, { opacity }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: { padding: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  iconSkeleton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
  tempContainer: { flex: 1, marginLeft: spacing.md },
  tempSkeleton: { width: 100, height: 36, borderRadius: 8, backgroundColor: colors.border, marginBottom: 4 },
  descSkeleton: { width: 80, height: 15, borderRadius: 4, backgroundColor: colors.border },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, borderBottomWidth: 1, borderBottomColor: colors.border },
  stat: { alignItems: 'center' },
  statLabelSkeleton: { width: 50, height: 11, borderRadius: 4, backgroundColor: colors.border, marginBottom: 4 },
  statValueSkeleton: { width: 40, height: 15, borderRadius: 4, backgroundColor: colors.border },
  packing: { marginTop: spacing.md },
  packLabelSkeleton: { width: 100, height: 14, borderRadius: 4, backgroundColor: colors.border, marginBottom: spacing.sm },
  packItemSkeleton: { width: '80%', height: 13, borderRadius: 4, backgroundColor: colors.border, marginVertical: 4 },
});

export default memo(WeatherSkeleton);