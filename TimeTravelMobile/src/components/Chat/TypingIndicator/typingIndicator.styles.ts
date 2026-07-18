/**
 * ⌨️ TYPING INDICATOR STYLES
 * ===========================
 * Production-grade styles for the typing indicator system
 */

import { StyleSheet, ViewStyle, TextStyle, Animated } from 'react-native';
import {
  DotConfig,
  ContainerConfig,
  DEFAULT_DOT_CONFIG,
  DEFAULT_CONTAINER_CONFIG,
} from './typingIndicator.constants';

// ─────────────────────────────────────────────────────────────
// STYLE INTERFACES
// ─────────────────────────────────────────────────────────────

export interface TypingIndicatorStyles {
  container: ViewStyle;
  dotContainer: ViewStyle;
  dot: Animated.AnimatedProps<ViewStyle>;
  textContainer: ViewStyle;
  text: TextStyle;
  avatarContainer: ViewStyle;
  bubbleWrapper: ViewStyle;
}

// ─────────────────────────────────────────────────────────────
// STYLE CREATOR FUNCTIONS
// ─────────────────────────────────────────────────────────────

interface ContainerStyleParams {
  containerConfig: ContainerConfig;
  backgroundColor: string;
  alignment: 'left' | 'right';
  showAvatar: boolean;
}

export const createContainerStyle = ({
  containerConfig,
  backgroundColor,
  alignment,
  showAvatar,
}: ContainerStyleParams): ViewStyle => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: containerConfig.paddingHorizontal,
  paddingVertical: containerConfig.paddingVertical,
  borderRadius: containerConfig.borderRadius,
  borderBottomLeftRadius: alignment === 'left' ? containerConfig.bottomLeftRadius : containerConfig.borderRadius,
  borderBottomRightRadius: alignment === 'right' ? containerConfig.bottomLeftRadius : containerConfig.borderRadius,
  alignSelf: alignment === 'left' ? 'flex-start' : 'flex-end',
  marginLeft: alignment === 'left' && showAvatar ? 44 : containerConfig.sideMargin,
  marginRight: alignment === 'right' && showAvatar ? 44 : containerConfig.sideMargin,
  marginVertical: containerConfig.verticalMargin,
  backgroundColor,
});

interface DotContainerStyleParams {
  dotConfig: DotConfig;
}

export const createDotContainerStyle = ({
  dotConfig,
}: DotContainerStyleParams): ViewStyle => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: dotConfig.spacing,
});

interface DotStyleParams {
  dotConfig: DotConfig;
  dotColor: string;
}

export const createDotStyle = ({
  dotConfig,
  dotColor,
}: DotStyleParams): ViewStyle => ({
  width: dotConfig.size,
  height: dotConfig.size,
  borderRadius: dotConfig.borderRadius,
  backgroundColor: dotColor,
});

// ─────────────────────────────────────────────────────────────
// STATIC STYLES
// ─────────────────────────────────────────────────────────────

export const staticStyles = StyleSheet.create({
  // Container styles
  containerBase: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Dot container
  dotContainerBase: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Text variant container
  textContainer: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text style
  text: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Avatar container
  avatarContainer: {
    position: 'absolute',
    left: 4,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Bubble wrapper for avatar + indicator
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  // Hidden wrapper for accessibility
  hiddenWrapper: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});

// ─────────────────────────────────────────────────────────────
// ANIMATED STYLE CREATORS
// ─────────────────────────────────────────────────────────────

interface AnimatedDotStyleParams {
  animationValue: Animated.Value;
  dotConfig: DotConfig;
  dotColor: string;
  amplitude: number;
  scale: number;
}

export const createAnimatedDotStyle = ({
  animationValue,
  dotConfig,
  dotColor,
  amplitude,
  scale,
}: AnimatedDotStyleParams): Animated.AnimatedProps<ViewStyle> => ({
  width: dotConfig.size,
  height: dotConfig.size,
  borderRadius: dotConfig.borderRadius,
  backgroundColor: dotColor,
  transform: [
    {
      translateY: animationValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -amplitude],
      }),
    },
    {
      scale: animationValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, scale],
      }),
    },
  ],
  opacity: animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [dotConfig.restOpacity, dotConfig.activeOpacity],
  }),
});

interface WaveDotStyleParams {
  animationValue: Animated.Value;
  dotConfig: DotConfig;
  dotColor: string;
  amplitude: number;
}

export const createWaveDotStyle = ({
  animationValue,
  dotConfig,
  dotColor,
  amplitude,
}: WaveDotStyleParams): Animated.AnimatedProps<ViewStyle> => ({
  width: dotConfig.size,
  height: dotConfig.size,
  borderRadius: dotConfig.borderRadius,
  backgroundColor: dotColor,
  transform: [
    {
      translateY: animationValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, -amplitude, 0],
      }),
    },
  ],
  opacity: animationValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [dotConfig.restOpacity, dotConfig.activeOpacity, dotConfig.restOpacity],
  }),
});

interface PulseDotStyleParams {
  animationValue: Animated.Value;
  dotConfig: DotConfig;
  dotColor: string;
  minScale: number;
  maxScale: number;
}

export const createPulseDotStyle = ({
  animationValue,
  dotConfig,
  dotColor,
  minScale,
  maxScale,
}: PulseDotStyleParams): Animated.AnimatedProps<ViewStyle> => ({
  width: dotConfig.size,
  height: dotConfig.size,
  borderRadius: dotConfig.borderRadius,
  backgroundColor: dotColor,
  transform: [
    {
      scale: animationValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [minScale, maxScale, minScale],
      }),
    },
  ],
  opacity: animationValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [dotConfig.restOpacity, dotConfig.activeOpacity, dotConfig.restOpacity],
  }),
});

// ─────────────────────────────────────────────────────────────
// FADE ANIMATION STYLES
// ─────────────────────────────────────────────────────────────

interface FadeContainerStyleParams {
  opacity: Animated.Value;
  scale: Animated.Value;
  containerStyle: ViewStyle;
}

export const createFadeContainerStyle = ({
  opacity,
  scale,
  containerStyle,
}: FadeContainerStyleParams): Animated.AnimatedProps<ViewStyle> => ({
  ...containerStyle,
  opacity,
  transform: [{ scale }],
});

// ─────────────────────────────────────────────────────────────
// MEMOIZED STYLE FACTORY
// ─────────────────────────────────────────────────────────────

export interface StyleFactoryParams {
  backgroundColor: string;
  dotColor: string;
  textColor?: string;
  dotConfig?: DotConfig;
  containerConfig?: ContainerConfig;
  alignment?: 'left' | 'right';
  showAvatar?: boolean;
}

export const createStyles = ({
  backgroundColor,
  dotColor,
  textColor,
  dotConfig = DEFAULT_DOT_CONFIG,
  containerConfig = DEFAULT_CONTAINER_CONFIG,
  alignment = 'left',
  showAvatar = false,
}: StyleFactoryParams) => {
  return StyleSheet.create({
    container: createContainerStyle({
      containerConfig,
      backgroundColor,
      alignment,
      showAvatar,
    }),
    dotContainer: createDotContainerStyle({ dotConfig }),
    dot: createDotStyle({ dotConfig, dotColor }),
    textContainer: {
      minWidth: 40,
      alignItems: 'center',
    },
    text: {
      fontSize: 14,
      fontWeight: '500',
      color: textColor || dotColor,
    },
    avatarContainer: {
      position: 'absolute',
      left: 4,
      bottom: 0,
    },
    bubbleWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
  });
};

// ─────────────────────────────────────────────────────────────
// UTILITY STYLE FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Get alignment-specific container style
 */
export const getAlignmentStyle = (alignment: 'left' | 'right'): ViewStyle => {
  if (alignment === 'left') {
    return {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: DEFAULT_CONTAINER_CONFIG.bottomLeftRadius,
    };
  }
  return {
    alignSelf: 'flex-end',
    borderBottomRightRadius: DEFAULT_CONTAINER_CONFIG.bottomLeftRadius,
  };
};

/**
 * Get avatar margin style
 */
export const getAvatarMarginStyle = (
  alignment: 'left' | 'right',
  showAvatar: boolean
): ViewStyle => {
  if (!showAvatar) return {};
  
  if (alignment === 'left') {
    return { marginLeft: 44 };
  }
  return { marginRight: 44 };
};