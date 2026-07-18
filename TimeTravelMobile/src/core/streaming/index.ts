/**
 * 🌊 STREAMING SYSTEM
 * ==================
 * Production-grade streaming for real-time data flow
 * 
 * @example
 * // Basic streaming
 * const { start, cancel, text, isStreaming } = useStreaming();
 * 
 * // Itinerary streaming
 * const { streamItinerary, progress, itinerary } = useItineraryStreaming(url);
 * 
 * // Chat streaming
 * const { sendMessage, response, isStreaming } = useChatStreaming(url);
 */

// ─────────────────────────────────────────────────────────────
// Core Classes
// ─────────────────────────────────────────────────────────────

export { 
  StreamingManager, 
  SSEParser,
  getStreamingManager, 
  resetStreamingManager 
} from './StreamingManager';

export { default as StreamingManagerDefault } from './StreamingManager';

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

export {
  useStreaming,
  useItineraryStreaming,
  useChatStreaming,
  type UseStreamingOptions,
  type UseStreamingReturn,
  type UseItineraryStreamingReturn,
  type UseChatStreamingReturn,
} from './hooks';

export { default as useStreamingDefault } from './hooks';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Stream Configuration
  StreamConfig,
  StreamOptions,
  StreamState,
  StreamMetrics,
  
  // Itinerary Streaming
  ItineraryStreamRequest,
  ItinerarySection,
  ItineraryStreamProgress,
  
  // Chat Streaming
  ChatStreamRequest,
  ConversationContext,
  ConversationMessage,
  UserPreferencesSummary,
  ChatStreamProgress,
  
  // Stream Events
  StreamEventType,
  StreamEvent,
  StreamEventListener,
  
  // Parser Types
  StreamParser,
  ParsedChunk,
  
  // SSE Types
  SSEMessage,
  SSEConfig,
} from './types';