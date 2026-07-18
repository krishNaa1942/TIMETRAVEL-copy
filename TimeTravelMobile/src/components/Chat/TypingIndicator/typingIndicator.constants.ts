/**
 * ⌨️ TYPING INDICATOR CONSTANTS
 * ==============================
 * Production-grade configuration constants for the typing indicator system
 */

import { ColorValue } from 'react-native';

// ─────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────

export type TypingIndicatorVariant = 'dots' | 'wave' | 'pulse' | 'text';

// ─────────────────────────────────────────────────────────────
// ANIMATION CONFIGURATION
// ─────────────────────────────────────────────────────────────

export interface AnimationConfig {
  /** Duration of one animation cycle in ms */
  duration: number;
  /** Delay between each dot's animation in ms */
  staggerDelay: number;
  /** How high the dots bounce (translateY pixels) */
  amplitude: number;
  /** Scale factor at peak animation */
  scale: number;
  /** Number of dots to display */
  dotCount: number;
  /** Easing function type */
  easing: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  duration: 400,
  staggerDelay: 150,
  amplitude: 6,
  scale: 1.2,
  dotCount: 3,
  easing: 'ease-in-out',
};

// ─────────────────────────────────────────────────────────────
// DOT CONFIGURATION
// ─────────────────────────────────────────────────────────────

export interface DotConfig {
  /** Width and height of each dot */
  size: number;
  /** Gap between dots */
  spacing: number;
  /** Border radius (size/2 for circle, 0 for square) */
  borderRadius: number;
  /** Opacity when at rest */
  restOpacity: number;
  /** Opacity at peak animation */
  activeOpacity: number;
}

export const DEFAULT_DOT_CONFIG: DotConfig = {
  size: 8,
  spacing: 4,
  borderRadius: 4, // Half of size for perfect circle
  restOpacity: 0.4,
  activeOpacity: 1,
};

// ─────────────────────────────────────────────────────────────
// CONTAINER CONFIGURATION
// ─────────────────────────────────────────────────────────────

export interface ContainerConfig {
  /** Horizontal padding */
  paddingHorizontal: number;
  /** Vertical padding */
  paddingVertical: number;
  /** Border radius of container */
  borderRadius: number;
  /** Bottom left radius (for chat bubble effect) */
  bottomLeftRadius: number;
  /** Margin from the side */
  sideMargin: number;
  /** Vertical margin */
  verticalMargin: number;
}

export const DEFAULT_CONTAINER_CONFIG: ContainerConfig = {
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 18,
  bottomLeftRadius: 6,
  sideMargin: 0, // Made configurable, no hardcoded values
  verticalMargin: 6,
};

// ─────────────────────────────────────────────────────────────
// FADE ANIMATION CONFIGURATION
// ─────────────────────────────────────────────────────────────

export interface FadeConfig {
  /** Duration of fade in animation */
  fadeInDuration: number;
  /** Duration of fade out animation */
  fadeOutDuration: number;
  /** Starting opacity */
  startOpacity: number;
  /** Ending opacity */
  endOpacity: number;
  /** Starting scale */
  startScale: number;
  /** Ending scale */
  endScale: number;
}

export const DEFAULT_FADE_CONFIG: FadeConfig = {
  fadeInDuration: 200,
  fadeOutDuration: 200,
  startOpacity: 0,
  endOpacity: 1,
  startScale: 0.8,
  endScale: 1,
};

// ─────────────────────────────────────────────────────────────
// THEME FALLBACKS
// ─────────────────────────────────────────────────────────────

export interface TypingIndicatorTheme {
  /** Background color of the container */
  backgroundColor: string;
  /** Color of the dots */
  dotColor: string;
  /** Text color for variant='text' */
  textColor?: string;
  /** Optional gradient colors for dots */
  gradientColors?: [ColorValue, ColorValue];
}

export const LIGHT_THEME_FALLBACK: TypingIndicatorTheme = {
  backgroundColor: '#F5F5F5',
  dotColor: '#666666',
  textColor: '#666666',
};

export const DARK_THEME_FALLBACK: TypingIndicatorTheme = {
  backgroundColor: '#2A2A2A',
  dotColor: '#AAAAAA',
  textColor: '#AAAAAA',
};

// ─────────────────────────────────────────────────────────────
// ACCESSIBILITY
// ─────────────────────────────────────────────────────────────

export const ACCESSIBILITY_LABEL = 'Typing indicator';
export const ACCESSIBILITY_HINT = 'User is typing a message';
export const ACCESSIBILITY_ROLE = 'text';

// ─────────────────────────────────────────────────────────────
// PERFORMANCE THRESHOLDS
// ─────────────────────────────────────────────────────────────

export interface PerformanceConfig {
  /** Minimum FPS before switching to simple animation */
  minFPS: number;
  /** Interval for FPS monitoring in ms */
  fpsCheckInterval: number;
  /** Whether to use native driver (always true for transforms) */
  useNativeDriver: boolean;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  minFPS: 30,
  fpsCheckInterval: 1000,
  useNativeDriver: true,
};

// ─────────────────────────────────────────────────────────────
// TEXT VARIANT CONFIGURATION
// ─────────────────────────────────────────────────────────────

export interface TextAnimationConfig {
  /** Characters to cycle through for typing effect */
  characters: string[];
  /** Duration to show each character set */
  cycleDuration: number;
}

export const DEFAULT_TEXT_CONFIG: TextAnimationConfig = {
  characters: ['', '.', '..', '...'],
  cycleDuration: 400,
};

// ─────────────────────────────────────────────────────────────
// WAVE VARIANT CONFIGURATION
// ─────────────────────────────────────────────────────────────

export interface WaveAnimationConfig {
  /** Wave amplitude */
  amplitude: number;
  /** Wave frequency (affects speed) */
  frequency: number;
  /** Phase offset between dots */
  phaseOffset: number;
}

export const DEFAULT_WAVE_CONFIG: WaveAnimationConfig = {
  amplitude: 4,
  frequency: 1.5,
  phaseOffset: Math.PI / 3,
};

// ─────────────────────────────────────────────────────────────
// PULSE VARIANT CONFIGURATION
// ─────────────────────────────────────────────────────────────

export interface PulseAnimationConfig {
  /** Minimum scale */
  minScale: number;
  /** Maximum scale */
  maxScale: number;
  /** Pulse duration */
  duration: number;
}

export const DEFAULT_PULSE_CONFIG: PulseAnimationConfig = {
  minScale: 0.8,
  maxScale: 1.3,
  duration: 600,
};