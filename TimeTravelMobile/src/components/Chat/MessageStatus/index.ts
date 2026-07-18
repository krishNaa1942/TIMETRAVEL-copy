/**
 * 📊 MESSAGE STATUS MODULE
 * ========================
 * Production-grade message status system
 * WhatsApp/Telegram/iMessage level features
 */

// Main component
export { MessageStatus, default } from './MessageStatus';
export type { MessageStatusProps } from './MessageStatus';

// Hook
export { useMessageStatus } from './useMessageStatus';
export type { UseMessageStatusReturn } from './types';

// Types
export {
  // Core types
  type MessageStatusType,
  type StatusMetadata,
  type MessageStatusModel,
  type StatusChangeEvent,
  
  // Receipt types
  type ReadReceipt,
  type DeliveryReceipt,
  
  // Visual config types
  type StatusIconConfig,
  type StatusColorConfig,
  type StatusAnimationConfig,
  type StatusVisualConfig,
  
  // Time display types
  type TimeDisplayFormat,
  type TimeDisplayConfig,
  
  // Group chat types
  type GroupStatusSummary,
  type GroupStatusDisplay,
  
  // Retry types
  type RetryConfig,
  type RetryState,
  
  // WebSocket types
  type WebSocketStatusEvent,
  
  // Theme
  type ChatTheme,
  
  // Constants
  STATUS_PRIORITY,
  getStatusCategory,
  DEFAULT_GROUP_DISPLAY_CONFIG,
} from './types';

// Utilities
export {
  // Icon utilities
  getStatusIcon,
  
  // Color utilities
  getStatusColor,
  getStatusColorConfig,
  
  // Label utilities
  getStatusLabel,
  getStatusAccessibilityLabel,
  
  // Visual config
  getStatusVisualConfig,
  
  // Time formatting
  formatTime,
  formatTimeAbsolute,
  formatTimeRelative,
  formatTimeSmart,
  formatTimeCompact,
  
  // Status utilities
  compareStatusPriority,
  isValidTransition,
  isTerminalStatus,
  isPendingStatus,
  isErrorStatus,
  isDeliveredStatus,
  
  // Group chat utilities
  calculateGroupSummary,
  getGroupStatusText,
  getTopReadByUsers,
  
  // Retry utilities
  calculateBackoffDelay,
  canRetry,
  
  // Upload utilities
  formatUploadProgress,
  formatUploadSpeed,
  estimateUploadTimeRemaining,
  
  // Memoization helpers
  createTimeFormatter,
  
  // Constants
  DEFAULT_ICON_SIZE,
  DEFAULT_LOCALE,
  TIME,
} from './statusUtils';