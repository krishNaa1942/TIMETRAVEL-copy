/**
 * 💬 CHAT SYSTEM TYPES
 * =====================
 * Production-grade type definitions for the chat system
 */

import { ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────
// MESSAGE STATE MACHINE
// ─────────────────────────────────────────────────────────────

export type MessageStatus = 
  | 'sending'      // Local, not yet sent
  | 'sent'         // Delivered to server
  | 'delivered'    // Received by recipient
  | 'read'         // Viewed by recipient
  | 'failed'       // Failed to send
  | 'retrying';    // Retrying after failure

export type MessageSender = 'user' | 'bot' | 'system';

// ─────────────────────────────────────────────────────────────
// MESSAGE CONTENT TYPES
// ─────────────────────────────────────────────────────────────

export interface TextContent {
  type: 'text';
  text: string;
}

export interface MarkdownContent {
  type: 'markdown';
  text: string;
}

export interface ImageContent {
  type: 'image';
  uri: string;
  width: number;
  height: number;
  thumbnail?: string;
  caption?: string;
}

export interface VideoContent {
  type: 'video';
  uri: string;
  thumbnail: string;
  duration: number;
  width: number;
  height: number;
}

export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface LinkContent {
  type: 'link';
  url: string;
  preview?: LinkPreview;
}

export interface LocationContent {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface FileContent {
  type: 'file';
  name: string;
  size: number;
  mimeType: string;
  uri: string;
}

export interface AICardContent {
  type: 'ai_card';
  cardType: 'destination' | 'hotel' | 'flight' | 'activity' | 'restaurant';
  title: string;
  subtitle?: string;
  image?: string;
  data: Record<string, unknown>;
  actions: AICardAction[];
}

export interface AICardAction {
  id: string;
  label: string;
  type: 'link' | 'book' | 'save' | 'share';
  payload: Record<string, unknown>;
}

export interface Reaction {
  emoji: string;
  count: number;
  reactedByUser: boolean;
}

export type MessageContent = 
  | TextContent 
  | MarkdownContent 
  | ImageContent 
  | VideoContent 
  | LinkContent 
  | LocationContent 
  | FileContent 
  | AICardContent;

// ─────────────────────────────────────────────────────────────
// MESSAGE MODEL
// ─────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: MessageSender;
  content: MessageContent;
  status: MessageStatus;
  timestamp: number;
  editedAt?: number;
  reactions?: Reaction[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// STREAMING TYPES
// ─────────────────────────────────────────────────────────────

export interface StreamingChunk {
  id: string;
  messageId: string;
  content: string;
  isComplete: boolean;
  timestamp: number;
}

export interface StreamingState {
  isStreaming: boolean;
  messageId: string | null;
  content: string;
  cursorVisible: boolean;
}

// ─────────────────────────────────────────────────────────────
// USER MODEL
// ─────────────────────────────────────────────────────────────

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: number;
}

// ─────────────────────────────────────────────────────────────
// CONVERSATION MODEL
// ─────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  participants: ChatUser[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// GESTURE TYPES
// ─────────────────────────────────────────────────────────────

export interface MessageAction {
  id: string;
  label: string;
  icon: string;
  destructive?: boolean;
  onPress: () => void;
}

export type ReactionEmoji = '❤️' | '👍' | '👎' | '😂' | '😮' | '😢';

// ─────────────────────────────────────────────────────────────
// THEME TYPES
// ─────────────────────────────────────────────────────────────

export interface ChatTheme {
  mode: 'light' | 'dark';
  
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
  
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS TYPES
// ─────────────────────────────────────────────────────────────

export interface ChatAnalyticsEvent {
  eventName: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT PROPS
// ─────────────────────────────────────────────────────────────

export interface ChatBubbleProps {
  message: Message;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  previousMessage?: Message;
  nextMessage?: Message;
  isGrouped?: boolean;
  onLongPress?: () => void;
  onReply?: () => void;
  onReaction?: (emoji: ReactionEmoji) => void;
  onRetry?: () => void;
  theme?: ChatTheme;
}

export interface MessageTextProps {
  content: MessageContent;
  isUser: boolean;
  theme: ChatTheme;
  isStreaming?: boolean;
  streamingContent?: string;
  onLinkPress?: (url: string) => void;
}

export interface MessageAvatarProps {
  user: ChatUser;
  size?: number;
  showOnline?: boolean;
  theme: ChatTheme;
}

export interface MessageStatusProps {
  status: MessageStatus;
  timestamp: number;
  isUser: boolean;
  theme: ChatTheme;
}

export interface MessageActionsProps {
  visible: boolean;
  actions: MessageAction[];
  position: { x: number; y: number };
  onClose: () => void;
}

export interface TypingIndicatorProps {
  theme: ChatTheme;
  text?: string;
}

// ─────────────────────────────────────────────────────────────
// API TYPES
// ─────────────────────────────────────────────────────────────

export interface SendMessageRequest {
  conversationId: string;
  content: MessageContent;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageResponse {
  success: boolean;
  message?: Message;
  error?: string;
}

export interface GetMessagesRequest {
  conversationId: string;
  before?: string;
  limit?: number;
}

export interface GetMessagesResponse {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface WebSocketMessage {
  type: 'new_message' | 'message_status' | 'typing' | 'streaming_chunk' | 'reaction';
  payload: unknown;
}