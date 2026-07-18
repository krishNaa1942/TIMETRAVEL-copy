/**
 * 📊 MESSAGE STATUS UTILITIES
 * ===========================
 * Production-grade utility functions for message status system
 * Optimized for performance with memoization support
 */

import {
  MessageStatusType,
  StatusIconConfig,
  StatusColorConfig,
  StatusVisualConfig,
  ChatTheme,
  TimeDisplayFormat,
  GroupStatusSummary,
  GroupStatusDisplay,
  ReadReceipt,
  DeliveryReceipt,
  STATUS_PRIORITY,
  getStatusCategory,
} from './types';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

/** Default icon size for status icons */
export const DEFAULT_ICON_SIZE = 14;

/** Default locale for time formatting */
export const DEFAULT_LOCALE = 'en-US';

/** Time constants in milliseconds */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
};

/** Default group status display configuration */
export const DEFAULT_GROUP_DISPLAY_CONFIG: GroupStatusDisplay = {
  showReadAvatars: true,
  maxAvatarsToShow: 3,
  showDeliveredCount: true,
  showPendingCount: false,
  avatarSize: 16,
};

// ─────────────────────────────────────────────────────────────
// ICON CONFIGURATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Material icon names for each status type
 * Using MaterialCommunityIcons from @expo/vector-icons
 */
const STATUS_ICONS: Record<MessageStatusType, string> = {
  queued: 'clock-outline',
  sending: 'clock-outline',
  uploading: 'upload',
  sent: 'check',
  delivered: 'check-all',
  read: 'check-all',
  failed: 'alert-circle-outline',
  edited: 'pencil',
  deleted: 'delete-outline',
};

/**
 * Get icon configuration for a status
 */
export const getStatusIcon = (
  status: MessageStatusType,
  customIcons?: Partial<Record<MessageStatusType, StatusIconConfig>>,
  size: number = DEFAULT_ICON_SIZE
): StatusIconConfig => {
  // Check for custom icon override
  if (customIcons?.[status]) {
    return { ...customIcons[status]!, size };
  }

  return {
    name: STATUS_ICONS[status],
    type: 'material',
    size,
    animated: ['sending', 'uploading'].includes(status),
  };
};

// ─────────────────────────────────────────────────────────────
// COLOR CONFIGURATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Default status colors with fallbacks
 */
const DEFAULT_STATUS_COLORS: Record<MessageStatusType, string> = {
  queued: '#9CA3AF',
  sending: '#9CA3AF',
  uploading: '#3B82F6',
  sent: '#9CA3AF',
  delivered: '#9CA3AF',
  read: '#3B82F6',
  failed: '#EF4444',
  edited: '#9CA3AF',
  deleted: '#9CA3AF',
};

/**
 * Get color for a status type with theme support
 */
export const getStatusColor = (
  status: MessageStatusType,
  theme: ChatTheme,
  customColors?: Partial<Record<MessageStatusType, StatusColorConfig>>
): string => {
  // Check for custom color override
  if (customColors?.[status]?.primary) {
    return customColors[status]!.primary;
  }

  // Theme-specific color mapping
  const themeColorMap: Partial<Record<MessageStatusType, keyof ChatTheme>> = {
    queued: 'statusQueuedColor',
    sending: 'statusSendingColor',
    uploading: 'statusUploadingColor',
    sent: 'statusSentColor',
    delivered: 'statusDeliveredColor',
    read: 'statusReadColor',
    failed: 'statusFailedColor',
  };

  // Try to get theme-specific color first
  const themeColorKey = themeColorMap[status];
  if (themeColorKey && theme[themeColorKey]) {
    return theme[themeColorKey] as string;
  }

  // Fallback to success color for read status
  if (status === 'read') {
    return theme.successColor || DEFAULT_STATUS_COLORS.read;
  }

  // Fallback to error color for failed status
  if (status === 'failed') {
    return theme.errorColor || DEFAULT_STATUS_COLORS.failed;
  }

  // Default fallback
  return DEFAULT_STATUS_COLORS[status];
};

/**
 * Get complete color configuration for a status
 */
export const getStatusColorConfig = (
  status: MessageStatusType,
  theme: ChatTheme,
  customColors?: Partial<Record<MessageStatusType, StatusColorConfig>>
): StatusColorConfig => {
  const primary = getStatusColor(status, theme, customColors);
  
  return {
    primary,
    animated: ['delivered', 'read'].includes(status),
  };
};

// ─────────────────────────────────────────────────────────────
// LABEL CONFIGURATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Human-readable labels for each status
 */
const STATUS_LABELS: Record<MessageStatusType, string> = {
  queued: 'Queued',
  sending: 'Sending...',
  uploading: 'Uploading...',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
  edited: 'Edited',
  deleted: 'Deleted',
};

/**
 * Get label for a status
 */
export const getStatusLabel = (status: MessageStatusType): string => {
  return STATUS_LABELS[status];
};

/**
 * Get accessibility label for screen readers
 */
export const getStatusAccessibilityLabel = (
  status: MessageStatusType,
  timestamp: number,
  formattedTime: string,
  readBy?: ReadReceipt[]
): string => {
  const timeStr = `at ${formattedTime}`;
  
  switch (status) {
    case 'queued':
      return `Message queued, waiting to send ${timeStr}`;
    case 'sending':
      return `Message sending ${timeStr}`;
    case 'uploading':
      return `Uploading media ${timeStr}`;
    case 'sent':
      return `Message sent ${timeStr}`;
    case 'delivered':
      return `Message delivered ${timeStr}`;
    case 'read':
      if (readBy && readBy.length > 0) {
        const names = readBy.map(r => r.userName).join(', ');
        return `Message read by ${names} ${timeStr}`;
      }
      return `Message read ${timeStr}`;
    case 'failed':
      return `Message failed to send ${timeStr}. Tap to retry.`;
    case 'edited':
      return `Message edited ${timeStr}`;
    case 'deleted':
      return `Message deleted`;
    default:
      return `Message status: ${status} ${timeStr}`;
  }
};

// ─────────────────────────────────────────────────────────────
// COMPLETE VISUAL CONFIG
// ─────────────────────────────────────────────────────────────

/**
 * Get complete visual configuration for a status
 */
export const getStatusVisualConfig = (
  status: MessageStatusType,
  theme: ChatTheme,
  customIcons?: Partial<Record<MessageStatusType, StatusIconConfig>>,
  customColors?: Partial<Record<MessageStatusType, StatusColorConfig>>
): StatusVisualConfig => ({
  icon: getStatusIcon(status, customIcons),
  color: getStatusColorConfig(status, theme, customColors),
  accessibilityLabel: STATUS_LABELS[status],
});

// ─────────────────────────────────────────────────────────────
// TIME FORMATTING
// ─────────────────────────────────────────────────────────────

/**
 * Format time to absolute format (e.g., "10:45 AM")
 */
export const formatTimeAbsolute = (
  timestamp: number,
  locale: string = DEFAULT_LOCALE,
  showSeconds: boolean = false
): string => {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  if (showSeconds) {
    options.second = '2-digit';
  }

  return date.toLocaleTimeString(locale, options);
};

/**
 * Format time to relative format (e.g., "2m ago")
 */
export const formatTimeRelative = (
  timestamp: number,
  locale: string = DEFAULT_LOCALE
): string => {
  const now = Date.now();
  const diff = now - timestamp;

  // Less than a minute
  if (diff < TIME.MINUTE) {
    return 'Just now';
  }

  // Less than an hour
  if (diff < TIME.HOUR) {
    const minutes = Math.floor(diff / TIME.MINUTE);
    return `${minutes}m ago`;
  }

  // Less than a day
  if (diff < TIME.DAY) {
    const hours = Math.floor(diff / TIME.HOUR);
    return `${hours}h ago`;
  }

  // Less than a week
  if (diff < TIME.WEEK) {
    const days = Math.floor(diff / TIME.DAY);
    return `${days}d ago`;
  }

  // Older than a week - show date
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Smart time format (context-aware)
 * - Today: "10:45 AM"
 * - Yesterday: "Yesterday"
 * - This week: "Mon"
 * - Older: "Jan 15"
 */
export const formatTimeSmart = (
  timestamp: number,
  locale: string = DEFAULT_LOCALE
): string => {
  const now = Date.now();
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if today
  if (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  ) {
    return formatTimeAbsolute(timestamp, locale);
  }

  // Check if yesterday
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  // Check if within this week
  const weekAgo = now - TIME.WEEK;
  if (timestamp > weekAgo) {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  }

  // Older - show date
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Compact time format (minimal space)
 */
export const formatTimeCompact = (
  timestamp: number,
  locale: string = DEFAULT_LOCALE
): string => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'p' : 'a';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')}${ampm}`;
};

/**
 * Format time based on specified format
 */
export const formatTime = (
  timestamp: number,
  format: TimeDisplayFormat = 'smart',
  locale: string = DEFAULT_LOCALE
): string => {
  switch (format) {
    case 'absolute':
      return formatTimeAbsolute(timestamp, locale);
    case 'relative':
      return formatTimeRelative(timestamp, locale);
    case 'smart':
      return formatTimeSmart(timestamp, locale);
    case 'compact':
      return formatTimeCompact(timestamp, locale);
    default:
      return formatTimeSmart(timestamp, locale);
  }
};

// ─────────────────────────────────────────────────────────────
// STATUS COMPARISON & VALIDATION
// ─────────────────────────────────────────────────────────────

/**
 * Compare two statuses by priority
 * Returns: positive if a > b, negative if a < b, 0 if equal
 */
export const compareStatusPriority = (
  a: MessageStatusType,
  b: MessageStatusType
): number => {
  return STATUS_PRIORITY[a] - STATUS_PRIORITY[b];
};

/**
 * Check if a status transition is valid
 */
export const isValidTransition = (
  from: MessageStatusType,
  to: MessageStatusType
): boolean => {
  // Special cases: edited/deleted can happen from any state
  if (to === 'edited' || to === 'deleted') return true;
  
  // Define valid transitions
  const validTransitions: Record<MessageStatusType, MessageStatusType[]> = {
    queued: ['sending', 'failed'],
    sending: ['sent', 'failed', 'uploading'],
    uploading: ['sent', 'failed'],
    sent: ['delivered', 'read', 'edited', 'deleted'],
    delivered: ['read', 'edited', 'deleted'],
    read: ['edited', 'deleted'],
    failed: ['sending'],
    edited: ['deleted'],
    deleted: [],
  };

  return validTransitions[from]?.includes(to) ?? false;
};

/**
 * Check if status is a "terminal" state (message lifecycle ended)
 */
export const isTerminalStatus = (status: MessageStatusType): boolean => {
  return status === 'deleted';
};

/**
 * Check if status indicates a pending operation
 */
export const isPendingStatus = (status: MessageStatusType): boolean => {
  return getStatusCategory(status) === 'pending';
};

/**
 * Check if status indicates an error
 */
export const isErrorStatus = (status: MessageStatusType): boolean => {
  return getStatusCategory(status) === 'error';
};

/**
 * Check if status indicates successful delivery
 */
export const isDeliveredStatus = (status: MessageStatusType): boolean => {
  return STATUS_PRIORITY[status] >= STATUS_PRIORITY.sent;
};

// ─────────────────────────────────────────────────────────────
// GROUP CHAT UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Calculate group status summary from receipts
 */
export const calculateGroupSummary = (
  totalParticipants: number,
  readBy: ReadReceipt[] = [],
  deliveredTo: DeliveryReceipt[] = []
): GroupStatusSummary => {
  const readUserIdSet = new Set(readBy.map(r => r.userId));
  const deliveredUserIdSet = new Set(deliveredTo.map(d => d.userId));
  
  // Count delivered but not read
  const deliveredNotRead = deliveredTo.filter(d => !readUserIdSet.has(d.userId));
  
  // Pending = not delivered and not read
  const pendingCount = totalParticipants - readBy.length - deliveredNotRead.length;

  return {
    totalParticipants,
    deliveredCount: deliveredTo.length,
    readCount: readBy.length,
    pendingCount: Math.max(0, pendingCount),
    readByUsers: readBy,
    deliveredToUsers: deliveredTo,
  };
};

/**
 * Get group status display text
 */
export const getGroupStatusText = (summary: GroupStatusSummary): string => {
  if (summary.readCount > 0) {
    if (summary.readCount === summary.totalParticipants) {
      return 'Read by everyone';
    }
    return `Read by ${summary.readCount}`;
  }
  
  if (summary.deliveredCount > 0) {
    if (summary.deliveredCount === summary.totalParticipants) {
      return 'Delivered to everyone';
    }
    return `Delivered to ${summary.deliveredCount}`;
  }
  
  return '';
};

/**
 * Get top N users who read the message (for avatar display)
 */
export const getTopReadByUsers = (
  readBy: ReadReceipt[],
  maxCount: number = 3
): ReadReceipt[] => {
  return [...readBy]
    .sort((a, b) => a.readAt - b.readAt)
    .slice(0, maxCount);
};

// ─────────────────────────────────────────────────────────────
// RETRY UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Calculate exponential backoff delay
 */
export const calculateBackoffDelay = (
  attempt: number,
  initialDelayMs: number = 1000,
  maxDelayMs: number = 30000,
  multiplier: number = 2
): number => {
  const delay = initialDelayMs * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelayMs);
};

/**
 * Check if retry is allowed based on config
 */
export const canRetry = (
  currentAttempt: number,
  maxRetries: number
): boolean => {
  return currentAttempt < maxRetries;
};

// ─────────────────────────────────────────────────────────────
// UPLOAD PROGRESS UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Format upload progress for display
 */
export const formatUploadProgress = (progress: number): string => {
  return `${Math.round(progress)}%`;
};

/**
 * Format upload speed for display
 */
export const formatUploadSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond} B/s`;
  }
  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

/**
 * Estimate remaining upload time
 */
export const estimateUploadTimeRemaining = (
  bytesUploaded: number,
  bytesTotal: number,
  bytesPerSecond: number
): number => {
  if (bytesPerSecond <= 0) return Infinity;
  const bytesRemaining = bytesTotal - bytesUploaded;
  return Math.ceil(bytesRemaining / bytesPerSecond);
};

// ─────────────────────────────────────────────────────────────
// MEMOIZATION HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Create a memoized time formatter
 * Useful for preventing re-renders when time hasn't changed
 */
export const createTimeFormatter = (
  format: TimeDisplayFormat = 'smart',
  locale: string = DEFAULT_LOCALE
) => {
  const cache = new Map<number, string>();
  
  return (timestamp: number): string => {
    // Round to minute for caching (prevents unnecessary recalculations)
    const cacheKey = Math.floor(timestamp / TIME.MINUTE) * TIME.MINUTE;
    
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
    
    const result = formatTime(timestamp, format, locale);
    cache.set(cacheKey, result);
    
    // Limit cache size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }
    
    return result;
  };
};