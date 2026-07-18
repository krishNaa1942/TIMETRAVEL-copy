/**
 * 💬 CHAT COMPONENTS INDEX
 * =========================
 * Production-grade chat system exports
 */

// Types
export * from './types';

// Components
export { default as ChatBubble } from './ChatBubble';
export { default as ChatBubblePremium } from './ChatBubble.premium';
export type { ChatBubbleProps } from './ChatBubble.premium';
export { default as MessageAvatar } from './MessageAvatar';
export { default as MessageStatus } from './MessageStatus';
export { default as MessageActions } from './MessageActions';
export { default as TypingIndicator } from './TypingIndicator';

// Theme
export { lightTheme, darkTheme } from './theme';

// Hooks
export { useChatStreaming } from './hooks/useChatStreaming';
export { useMessageQueue } from './hooks/useMessageQueue';
export { useChatGestures } from './hooks/useChatGestures';

// Typing Indicator exports (v2.0.0 - Production Grade)
export {
  useTypingAnimation,
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_FADE_CONFIG,
  DEFAULT_DOT_CONFIG,
  DEFAULT_CONTAINER_CONFIG,
  LIGHT_THEME_FALLBACK,
  DARK_THEME_FALLBACK,
} from './TypingIndicator';

// Typing Indicator types
export type {
  TypingIndicatorProps,
  TypingIndicatorVariant,
  AnimationConfig,
  DotConfig,
  ContainerConfig,
  FadeConfig,
} from './TypingIndicator';

// MessageText exports (v2.0.0 - Production Grade)
export { default as MessageTextV2 } from './MessageText';
