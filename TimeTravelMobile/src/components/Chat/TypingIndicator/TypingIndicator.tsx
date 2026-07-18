/**
 * ⌨️ TYPING INDICATOR COMPONENT
 * ==============================
 * Production-grade, high-performance typing indicator system
 * 
 * Features:
 * - Multiple animation variants (dots, wave, pulse, text)
 * - Smooth fade in/out transitions
 * - Full customization support
 * - Accessibility compliant
 * - Theme-aware with fallbacks
 * - AppState optimization (pause on background)
 * - Memory leak prevention
 * - Cross-platform compatible
 * 
 * @version 2.0.0
 * @author TimeTravel Team
 */

import React, { memo, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Platform,
} from 'react-native';

// Local imports
import {
  TypingIndicatorVariant,
  AnimationConfig,
  DotConfig,
  ContainerConfig,
  FadeConfig,
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_DOT_CONFIG,
  DEFAULT_CONTAINER_CONFIG,
  DEFAULT_FADE_CONFIG,
  LIGHT_THEME_FALLBACK,
  DARK_THEME_FALLBACK,
  ACCESSIBILITY_LABEL,
  ACCESSIBILITY_HINT,
  ACCESSIBILITY_ROLE,
} from './typingIndicator.constants';
import {
  createContainerStyle,
  createDotContainerStyle,
  createDotStyle,
  createAnimatedDotStyle,
  createWaveDotStyle,
  createPulseDotStyle,
} from './typingIndicator.styles';
import { useTypingAnimation } from './hooks/useTypingAnimation';

// Import ChatTheme for compatibility
import { ChatTheme } from '../types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface TypingIndicatorProps {
  /** Chat theme (optional - will use fallbacks if not provided) */
  theme?: ChatTheme;
  /** Whether the indicator is visible */
  visible?: boolean;
  /** Animation variant */
  variant?: TypingIndicatorVariant;
  /** Text to display for accessibility and optional label */
  text?: string;
  /** User name for accessibility announcement */
  userName?: string;
  /** Show avatar placeholder */
  showAvatar?: boolean;
  /** Avatar URL (optional) */
  avatarUrl?: string;
  /** Alignment of the indicator */
  alignment?: 'left' | 'right';
  /** Custom animation configuration */
  animationConfig?: Partial<AnimationConfig>;
  /** Custom dot configuration */
  dotConfig?: Partial<DotConfig>;
  /** Custom container configuration */
  containerConfig?: Partial<ContainerConfig>;
  /** Custom fade configuration */
  fadeConfig?: Partial<FadeConfig>;
  /** Custom background color (overrides theme) */
  backgroundColor?: string;
  /** Custom dot color (overrides theme) */
  dotColor?: string;
  /** Custom text color (overrides theme) */
  textColor?: string;
  /** Test ID for testing */
  testID?: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Whether typing is from streaming API */
  isStreaming?: boolean;
  /** Pause animation on app background */
  pauseOnBackground?: boolean;
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Custom accessibility label */
  accessibilityLabel?: string;
  /** Announce typing for screen readers */
  announceForAccessibility?: boolean;
  /** Callback when animation starts */
  onAnimationStart?: () => void;
  /** Callback when animation stops */
  onAnimationStop?: () => void;
  /** Additional container style */
  style?: any;
}

// ─────────────────────────────────────────────────────────────
// THEME HELPER
// ─────────────────────────────────────────────────────────────

const getThemeColors = (
  theme?: ChatTheme,
  backgroundColor?: string,
  dotColor?: string,
  textColor?: string
) => {
  const isDark = theme?.mode === 'dark';
  const fallback = isDark ? DARK_THEME_FALLBACK : LIGHT_THEME_FALLBACK;

  return {
    backgroundColor: backgroundColor || theme?.botBubbleBackground || fallback.backgroundColor,
    dotColor: dotColor || theme?.primaryColor || fallback.dotColor,
    textColor: textColor || theme?.botBubbleText || fallback.textColor || fallback.dotColor,
  };
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

const TypingIndicator = memo<TypingIndicatorProps>(({
  theme,
  visible = true,
  variant = 'dots',
  text,
  userName,
  showAvatar = false,
  avatarUrl,
  alignment = 'left',
  animationConfig,
  dotConfig,
  containerConfig,
  fadeConfig,
  backgroundColor,
  dotColor,
  textColor,
  testID = 'typing-indicator',
  debug = false,
  isStreaming = false,
  pauseOnBackground = true,
  enablePerformanceMonitoring = false,
  accessibilityLabel,
  announceForAccessibility = true,
  onAnimationStart,
  onAnimationStop,
  style,
}) => {
  // ─────────────────────────────────────────────────────────
  // MERGE CONFIGURATIONS
  // ─────────────────────────────────────────────────────────

  const mergedAnimationConfig = useMemo(
    () => ({ ...DEFAULT_ANIMATION_CONFIG, ...animationConfig }),
    [animationConfig]
  );

  const mergedDotConfig = useMemo(
    () => ({ ...DEFAULT_DOT_CONFIG, ...dotConfig }),
    [dotConfig]
  );

  const mergedContainerConfig = useMemo(
    () => ({ ...DEFAULT_CONTAINER_CONFIG, ...containerConfig }),
    [containerConfig]
  );

  const mergedFadeConfig = useMemo(
    () => ({ ...DEFAULT_FADE_CONFIG, ...fadeConfig }),
    [fadeConfig]
  );

  // ─────────────────────────────────────────────────────────
  // THEME COLORS
  // ─────────────────────────────────────────────────────────

  const colors = useMemo(
    () => getThemeColors(theme, backgroundColor, dotColor, textColor),
    [theme, backgroundColor, dotColor, textColor]
  );

  // ─────────────────────────────────────────────────────────
  // ANIMATION HOOK
  // ─────────────────────────────────────────────────────────

  const {
    dotAnimations,
    fadeAnimation,
    scaleAnimation,
    controls,
    state,
    textState,
    isLowPerformance,
  } = useTypingAnimation({
    visible,
    variant,
    config: mergedAnimationConfig,
    fadeConfig: mergedFadeConfig,
    dotCount: mergedAnimationConfig.dotCount,
    pauseOnBackground,
    enablePerformanceMonitoring,
    onAnimationStart,
    onAnimationStop,
    debug,
  });

  // ─────────────────────────────────────────────────────────
  // ACCESSIBILITY
  // ─────────────────────────────────────────────────────────

  const computedAccessibilityLabel = useMemo(() => {
    const userNameText = userName ? `${userName} is` : 'User is';
    return accessibilityLabel || `${userNameText} typing...`;
  }, [userName, accessibilityLabel]);

  // Announce typing for screen readers
  useEffect(() => {
    if (visible && announceForAccessibility && state.isAnimating) {
      AccessibilityInfo.announceForAccessibility(computedAccessibilityLabel);
    }
  }, [visible, announceForAccessibility, state.isAnimating, computedAccessibilityLabel]);

  // ─────────────────────────────────────────────────────────
  // STYLES (MEMOIZED)
  // ─────────────────────────────────────────────────────────

  const containerStyle = useMemo(
    () =>
      createContainerStyle({
        containerConfig: mergedContainerConfig,
        backgroundColor: colors.backgroundColor,
        alignment,
        showAvatar,
      }),
    [mergedContainerConfig, colors.backgroundColor, alignment, showAvatar]
  );

  const dotContainerStyle = useMemo(
    () => createDotContainerStyle({ dotConfig: mergedDotConfig }),
    [mergedDotConfig]
  );

  const staticDotStyle = useMemo(
    () => createDotStyle({ dotConfig: mergedDotConfig, dotColor: colors.dotColor }),
    [mergedDotConfig, colors.dotColor]
  );

  // ─────────────────────────────────────────────────────────
  // ANIMATED DOT RENDERER
  // ─────────────────────────────────────────────────────────

  const renderDot = useCallback(
    (animValue: Animated.Value, index: number) => {
      // Low performance fallback: static dots with simple opacity
      if (isLowPerformance) {
        return (
          <View
            key={index}
            style={[
              staticDotStyle,
              { opacity: 0.5 + (index * 0.15) },
            ]}
          />
        );
      }

      // Variant-specific animated styles
      let animatedStyle: any;

      switch (variant) {
        case 'wave':
          animatedStyle = createWaveDotStyle({
            animationValue: animValue,
            dotConfig: mergedDotConfig,
            dotColor: colors.dotColor,
            amplitude: DEFAULT_ANIMATION_CONFIG.amplitude,
          });
          break;

        case 'pulse':
          animatedStyle = createPulseDotStyle({
            animationValue: animValue,
            dotConfig: mergedDotConfig,
            dotColor: colors.dotColor,
            minScale: 0.8,
            maxScale: 1.3,
          });
          break;

        case 'dots':
        default:
          animatedStyle = createAnimatedDotStyle({
            animationValue: animValue,
            dotConfig: mergedDotConfig,
            dotColor: colors.dotColor,
            amplitude: mergedAnimationConfig.amplitude,
            scale: mergedAnimationConfig.scale,
          });
      }

      return <Animated.View key={index} style={animatedStyle} />;
    },
    [
      isLowPerformance,
      variant,
      staticDotStyle,
      mergedDotConfig,
      colors.dotColor,
      mergedAnimationConfig.amplitude,
      mergedAnimationConfig.scale,
    ]
  );

  // ─────────────────────────────────────────────────────────
  // CONTENT RENDERER
  // ─────────────────────────────────────────────────────────

  const renderContent = useCallback(() => {
    switch (variant) {
      case 'text':
        return (
          <View style={styles.textContainer}>
            <Text
              style={[styles.text, { color: colors.textColor }]}
              accessibilityElementsHidden
            >
              {text || 'Typing'}
              {textState}
            </Text>
          </View>
        );

      case 'dots':
      case 'wave':
      case 'pulse':
      default:
        return (
          <View style={dotContainerStyle}>
            {dotAnimations.map(renderDot)}
          </View>
        );
    }
  }, [
    variant,
    text,
    textState,
    colors.textColor,
    dotContainerStyle,
    dotAnimations,
    renderDot,
  ]);

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  // Don't render if not visible and not mounted (no animation running)
  if (!visible && !state.isMounted) {
    return null;
  }

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          opacity: fadeAnimation,
          transform: [{ scale: scaleAnimation }],
        },
        style,
      ]}
      accessible={true}
      accessibilityLabel={computedAccessibilityLabel}
      accessibilityHint={ACCESSIBILITY_HINT}
      accessibilityRole={ACCESSIBILITY_ROLE as any}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {/* Avatar placeholder */}
      {showAvatar && (
        <View style={styles.avatarPlaceholder}>
          {avatarUrl ? null : (
            <View style={[styles.avatarCircle, { backgroundColor: colors.dotColor }]} />
          )}
        </View>
      )}

      {/* Main content */}
      {renderContent()}

      {/* Streaming indicator */}
      {isStreaming && (
        <View style={styles.streamingBadge}>
          <View style={[styles.streamingDot, { backgroundColor: colors.dotColor }]} />
        </View>
      )}
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────
// DISPLAY NAME & STATIC PROPS
// ─────────────────────────────────────────────────────────────

TypingIndicator.displayName = 'TypingIndicator';

// ─────────────────────────────────────────────────────────────
// STATIC STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  textContainer: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
  avatarPlaceholder: {
    position: 'absolute',
    left: -40,
    bottom: 0,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.7,
  },
  streamingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

// ─────────────────────────────────────────────────────────────
// EXPORT DEFAULT
// ─────────────────────────────────────────────────────────────

export default TypingIndicator;

// ─────────────────────────────────────────────────────────────
// NAMED EXPORTS FOR ADVANCED USAGE
// ─────────────────────────────────────────────────────────────

export {
  TypingIndicatorVariant,
  AnimationConfig,
  DotConfig,
  ContainerConfig,
  FadeConfig,
};