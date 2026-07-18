/**
 * ⌨️ TYPING INDICATOR MODULE
 * ===========================
 * Production-grade typing indicator system exports
 * 
 * @version 2.0.0
 */

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export { default as TypingIndicator } from './TypingIndicator';
export { default } from './TypingIndicator';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type {
  TypingIndicatorProps,
  TypingIndicatorVariant,
  AnimationConfig,
  DotConfig,
  ContainerConfig,
  FadeConfig,
} from './TypingIndicator';

export type {
  AnimationControls,
  AnimationState,
  UseTypingAnimationOptions,
  UseTypingAnimationReturn,
} from './hooks/useTypingAnimation';

export type {
  TypingIndicatorTheme,
  PerformanceConfig,
  TextAnimationConfig,
  WaveAnimationConfig,
  PulseAnimationConfig,
} from './typingIndicator.constants';

export type {
  TypingIndicatorStyles,
  StyleFactoryParams,
} from './typingIndicator.styles';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

export {
  // Animation defaults
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_FADE_CONFIG,
  DEFAULT_DOT_CONFIG,
  DEFAULT_CONTAINER_CONFIG,
  
  // Theme fallbacks
  LIGHT_THEME_FALLBACK,
  DARK_THEME_FALLBACK,
  
  // Accessibility
  ACCESSIBILITY_LABEL,
  ACCESSIBILITY_HINT,
  ACCESSIBILITY_ROLE,
  
  // Performance
  DEFAULT_PERFORMANCE_CONFIG,
  
  // Variant configs
  DEFAULT_TEXT_CONFIG,
  DEFAULT_WAVE_CONFIG,
  DEFAULT_PULSE_CONFIG,
} from './typingIndicator.constants';

// ─────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────

export { useTypingAnimation } from './hooks/useTypingAnimation';

// ─────────────────────────────────────────────────────────────
// STYLE UTILITIES
// ─────────────────────────────────────────────────────────────

export {
  createContainerStyle,
  createDotContainerStyle,
  createDotStyle,
  createAnimatedDotStyle,
  createWaveDotStyle,
  createPulseDotStyle,
  createFadeContainerStyle,
  createStyles,
  getAlignmentStyle,
  getAvatarMarginStyle,
  staticStyles,
} from './typingIndicator.styles';