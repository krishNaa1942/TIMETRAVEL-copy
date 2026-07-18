/**
 * ⌨️ TYPING INDICATOR COMPONENT
 * ==============================
 * Re-exports the upgraded TypingIndicator from the new modular structure
 * 
 * This file maintains backward compatibility for existing imports.
 * For new implementations, import from './TypingIndicator/' directly.
 * 
 * @version 2.0.0
 */

// Re-export everything from the new modular structure
export {
  default,
  TypingIndicator,
  TypingIndicatorVariant,
  AnimationConfig,
  DotConfig,
  ContainerConfig,
  FadeConfig,
} from './TypingIndicator/';

// Re-export types
export type { TypingIndicatorProps } from './TypingIndicator/';

// Re-export hooks and utilities
export {
  useTypingAnimation,
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_FADE_CONFIG,
  DEFAULT_DOT_CONFIG,
  DEFAULT_CONTAINER_CONFIG,
  LIGHT_THEME_FALLBACK,
  DARK_THEME_FALLBACK,
} from './TypingIndicator/';