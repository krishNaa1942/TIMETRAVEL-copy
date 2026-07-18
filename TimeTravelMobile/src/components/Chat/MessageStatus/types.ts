/**
 * 📊 MESSAGE STATUS TYPES
 * =======================
 * Production-grade type definitions for the message status system
 * Supports WhatsApp/Telegram/iMessage level features
 */

// ─────────────────────────────────────────────────────────────
// CORE STATUS ENUM (Extensible)
// ─────────────────────────────────────────────────────────────

/**
 * Complete message status lifecycle
 * Each status represents a distinct state in the message journey
 */
export type MessageStatusType =
  | "queued" // Offline / pending sync with server
  | "sending" // API request in progress
  | "sent" // Server acknowledged receipt
  | "delivered" // Reached recipient's device
  | "read" // Viewed by recipient(s)
  | "failed" // Failed to send (retryable)
  | "uploading" // Media attachment uploading
  | "edited" // Message has been edited
  | "deleted"; // Message has been deleted

// ─────────────────────────────────────────────────────────────
// STATUS METADATA
// ─────────────────────────────────────────────────────────────

/**
 * Individual read receipt for group chats
 */
export interface ReadReceipt {
  userId: string;
  userName: string;
  userAvatar?: string;
  readAt: number;
}

/**
 * Individual delivery receipt for group chats
 */
export interface DeliveryReceipt {
  userId: string;
  userName: string;
  deliveredAt: number;
}

/**
 * Rich metadata attached to each status
 */
export interface StatusMetadata {
  // Timestamps for each status transition
  queuedAt?: number;
  sendingAt?: number;
  sentAt?: number;
  deliveredAt?: number;
  readAt?: number;
  failedAt?: number;
  uploadedAt?: number;
  editedAt?: number;
  deletedAt?: number;

  // Retry information
  retryCount?: number;
  maxRetries?: number;
  lastRetryAt?: number;
  nextRetryAt?: number;

  // Error information
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;

  // Upload progress (for media)
  uploadProgress?: number; // 0-100
  uploadSpeed?: number; // bytes per second
  uploadBytesTotal?: number;
  uploadBytesUploaded?: number;

  // Group chat receipts
  readBy?: ReadReceipt[];
  deliveredTo?: DeliveryReceipt[];

  // Server sync
  serverMessageId?: string;
  serverTimestamp?: number;
  isOffline?: boolean;
}

// ─────────────────────────────────────────────────────────────
// FULL STATUS MODEL
// ─────────────────────────────────────────────────────────────

/**
 * Complete status object with type and metadata
 */
export interface MessageStatusModel {
  type: MessageStatusType;
  metadata: StatusMetadata;
  timestamp: number; // Primary timestamp for current status
}

// ─────────────────────────────────────────────────────────────
// STATUS TRANSITION TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Valid status transitions map
 * Defines the allowed state machine transitions
 */
export type StatusTransition =
  | "queued->sending"
  | "sending->sent"
  | "sending->failed"
  | "sending->uploading"
  | "uploading->sent"
  | "uploading->failed"
  | "sent->delivered"
  | "delivered->read"
  | "sent->read" // Skip delivered (direct read)
  | "failed->sending" // Retry
  | "any->edited"
  | "any->deleted";

/**
 * Status change event
 */
export interface StatusChangeEvent {
  messageId: string;
  previousStatus: MessageStatusType;
  newStatus: MessageStatusType;
  metadata?: Partial<StatusMetadata>;
  timestamp: number;
  source: "local" | "server" | "websocket";
}

// ─────────────────────────────────────────────────────────────
// VISUAL CONFIGURATION
// ─────────────────────────────────────────────────────────────

/**
 * Icon configuration for status display
 */
export interface StatusIconConfig {
  name: string;
  type: "material" | "custom";
  size: number;
  animated?: boolean;
}

/**
 * Color configuration for status
 */
export interface StatusColorConfig {
  primary: string;
  secondary?: string;
  background?: string;
  animated?: boolean;
}

/**
 * Animation configuration for status transitions
 */
export interface StatusAnimationConfig {
  type: "fade" | "scale" | "color" | "sequence" | "parallel";
  duration: number;
  delay?: number;
  easing?: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "spring";
  springConfig?: {
    damping: number;
    mass: number;
    stiffness: number;
  };
}

/**
 * Complete visual configuration for a status
 */
export interface StatusVisualConfig {
  icon: StatusIconConfig;
  color: StatusColorConfig;
  animation?: StatusAnimationConfig;
  accessibilityLabel: string;
}

// ─────────────────────────────────────────────────────────────
// TIME DISPLAY TYPES
// ─────────────────────────────────────────────────────────────

export type TimeDisplayFormat =
  | "absolute" // "10:45 AM"
  | "relative" // "2m ago"
  | "smart" // Context-aware (today: time, yesterday: "Yesterday", older: date)
  | "compact"; // Minimal space

export interface TimeDisplayConfig {
  format: TimeDisplayFormat;
  locale?: string;
  timezone?: string;
  showSeconds?: boolean;
  updateInterval?: number; // Auto-update interval in ms
}

// ─────────────────────────────────────────────────────────────
// GROUP CHAT TYPES
// ─────────────────────────────────────────────────────────────

export interface GroupStatusSummary {
  totalParticipants: number;
  deliveredCount: number;
  readCount: number;
  pendingCount: number;
  readByUsers: ReadReceipt[];
  deliveredToUsers: DeliveryReceipt[];
}

export interface GroupStatusDisplay {
  showReadAvatars: boolean;
  maxAvatarsToShow: number;
  showDeliveredCount: boolean;
  showPendingCount: boolean;
  avatarSize: number;
}

// ─────────────────────────────────────────────────────────────
// RETRY CONFIGURATION
// ─────────────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  debounceMs: number;
}

export interface RetryState {
  isRetrying: boolean;
  currentAttempt: number;
  nextRetryIn: number; // milliseconds until next retry
  canRetry: boolean;
  lastError?: string;
}

// ─────────────────────────────────────────────────────────────
// WEBSOCKET EVENT TYPES
// ─────────────────────────────────────────────────────────────

export type WebSocketStatusEvent =
  | { type: "message_sending"; messageId: string }
  | {
      type: "message_sent";
      messageId: string;
      serverMessageId: string;
      timestamp: number;
    }
  | {
      type: "message_delivered";
      messageId: string;
      deliveredTo: DeliveryReceipt[];
    }
  | { type: "message_read"; messageId: string; readBy: ReadReceipt[] }
  | {
      type: "message_failed";
      messageId: string;
      error: { code: string; message: string };
    }
  | { type: "message_edited"; messageId: string; editedAt: number }
  | { type: "message_deleted"; messageId: string; deletedAt: number };

// ─────────────────────────────────────────────────────────────
// COMPONENT PROPS
// ─────────────────────────────────────────────────────────────

/**
 * Props for the MessageStatus component
 */
export interface MessageStatusProps {
  // Core props
  status: MessageStatusType;
  timestamp: number;
  isUser: boolean;
  theme: ChatTheme;

  // Optional metadata
  metadata?: StatusMetadata;

  // Group chat props
  isGroupChat?: boolean;
  groupStatus?: GroupStatusSummary;
  groupDisplayConfig?: Partial<GroupStatusDisplay>;

  // Time display
  timeFormat?: TimeDisplayFormat;
  locale?: string;
  hideTime?: boolean;
  showRelativeTime?: boolean;

  // Retry handling
  onRetry?: () => Promise<void> | void;
  retryConfig?: Partial<RetryConfig>;

  // Visual customization
  customIcons?: Partial<Record<MessageStatusType, StatusIconConfig>>;
  customColors?: Partial<Record<MessageStatusType, StatusColorConfig>>;
  compact?: boolean;

  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;

  // Animation control
  enableAnimations?: boolean;
  animationDuration?: number;

  // Test ID for testing
  testID?: string;
}

/**
 * Props for the status icon component
 */
export interface StatusIconProps {
  status: MessageStatusType;
  color: string;
  size: number;
  animated?: boolean;
  customIcon?: StatusIconConfig;
  theme: ChatTheme;
}

/**
 * Props for the time display component
 */
export interface TimeDisplayProps {
  timestamp: number;
  format: TimeDisplayFormat;
  locale: string;
  color: string;
  compact?: boolean;
  autoUpdate?: boolean;
  updateInterval?: number;
}

/**
 * Props for group status display
 */
export interface GroupStatusProps {
  summary: GroupStatusSummary;
  displayConfig: GroupStatusDisplay;
  theme: ChatTheme;
  onShowDetails?: () => void;
}

// ─────────────────────────────────────────────────────────────
// THEME INTERFACE (Extended)
// ─────────────────────────────────────────────────────────────

export interface ChatTheme {
  mode: "light" | "dark";

  // User bubble
  userBubbleBackground: string;
  userBubbleText: string;
  userBubbleTimestamp: string;

  // Bot bubble
  botBubbleBackground: string;
  botBubbleText: string;
  botBubbleTimestamp: string;
  botBubbleBorder: string;

  // System
  backgroundColor: string;
  surfaceColor: string;
  borderColor: string;
  primaryColor: string;
  errorColor: string;
  successColor: string;

  // Status specific colors
  statusQueuedColor?: string;
  statusSendingColor?: string;
  statusSentColor?: string;
  statusDeliveredColor?: string;
  statusReadColor?: string;
  statusFailedColor?: string;
  statusUploadingColor?: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

// ─────────────────────────────────────────────────────────────
// HOOK RETURN TYPE
// ─────────────────────────────────────────────────────────────

export interface UseMessageStatusReturn {
  // Computed values
  icon: StatusIconConfig;
  color: string;
  label: string;
  accessibilityLabel: string;

  // Time formatting
  formattedTime: string;
  relativeTime: string;

  // Retry handling
  retryState: RetryState;
  handleRetry: () => Promise<void>;

  // Group status
  groupSummary: GroupStatusSummary | null;

  // Animation values
  animatedOpacity: number;
  animatedScale: number;
  animatedColor: string;

  // Status predicates
  isPending: boolean;
  isComplete: boolean;
  isError: boolean;
  canRetry: boolean;

  // Actions
  resetRetryState: () => void;
}

// ─────────────────────────────────────────────────────────────
// UTILITY TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Status priority for comparison
 * Higher priority = more "complete" status
 */
export const STATUS_PRIORITY: Record<MessageStatusType, number> = {
  queued: 0,
  sending: 1,
  uploading: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: -1,
  edited: 5,
  deleted: -2,
};

/**
 * Status category for grouping
 */
export type StatusCategory = "pending" | "complete" | "error" | "special";

/**
 * Get category for a status type
 */
export const getStatusCategory = (
  status: MessageStatusType,
): StatusCategory => {
  if (["queued", "sending", "uploading"].includes(status)) return "pending";
  if (["sent", "delivered", "read"].includes(status)) return "complete";
  if (status === "failed") return "error";
  return "special";
};

/**
 * Status configuration map
 */
export type StatusConfigMap = Record<MessageStatusType, StatusVisualConfig>;

/**
 * Default group display configuration
 */
export const DEFAULT_GROUP_DISPLAY_CONFIG: GroupStatusDisplay = {
  showReadAvatars: true,
  maxAvatarsToShow: 3,
  showDeliveredCount: true,
  showPendingCount: false,
  avatarSize: 16,
};
