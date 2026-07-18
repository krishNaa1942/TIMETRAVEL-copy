/**
 * 🌊 STREAMING SYSTEM TYPES
 * ========================
 * Production-grade streaming types for real-time data flow
 */

// ─────────────────────────────────────────────────────────────
// Stream Configuration
// ─────────────────────────────────────────────────────────────

export interface StreamConfig {
  /** Callback for each chunk received */
  onChunk: (chunk: string) => void;
  /** Callback when stream completes */
  onComplete: (fullText: string) => void;
  /** Callback for errors */
  onError: (error: Error) => void;
  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
  /** Chunk timeout in milliseconds */
  chunkTimeout?: number;
  /** Maximum total time for stream */
  maxDuration?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface StreamOptions {
  /** Endpoint URL */
  url: string;
  /** HTTP method */
  method?: 'GET' | 'POST';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Retry count on failure */
  retries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
}

export interface StreamState {
  /** Whether stream is active */
  isActive: boolean;
  /** Current accumulated text */
  accumulatedText: string;
  /** Total chunks received */
  chunkCount: number;
  /** Stream start time */
  startTime: number | null;
  /** Last chunk timestamp */
  lastChunkTime: number | null;
  /** Error if any */
  error: Error | null;
  /** Bytes received */
  bytesReceived: number;
}

export interface StreamMetrics {
  /** Total duration in ms */
  duration: number;
  /** Total chunks received */
  totalChunks: number;
  /** Total bytes received */
  totalBytes: number;
  /** Average chunk size */
  avgChunkSize: number;
  /** Chunks per second */
  chunksPerSecond: number;
  /** Bytes per second */
  bytesPerSecond: number;
}

// ─────────────────────────────────────────────────────────────
// Itinerary Streaming Types
// ─────────────────────────────────────────────────────────────

export interface ItineraryStreamRequest {
  destination: string;
  startDate: string;
  endDate: string;
  preferences?: string[];
  budget?: number;
  travelers?: number;
}

export interface ItinerarySection {
  id: string;
  type: 'day' | 'activity' | 'note' | 'transport' | 'accommodation';
  title: string;
  content: string;
  dayNumber?: number;
  time?: string;
  metadata?: Record<string, unknown>;
}

export interface ItineraryStreamProgress {
  /** Current section being streamed */
  currentSection: string;
  /** Sections completed */
  completedSections: string[];
  /** Percentage complete (0-100) */
  progress: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining: number;
}

// ─────────────────────────────────────────────────────────────
// Chat Streaming Types
// ─────────────────────────────────────────────────────────────

export interface ChatStreamRequest {
  message: string;
  conversationId?: string;
  context?: ConversationContext;
}

export interface ConversationContext {
  conversationId: string;
  messages: ConversationMessage[];
  userPreferences?: UserPreferencesSummary;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface UserPreferencesSummary {
  interests?: string[];
  budget?: 'budget' | 'moderate' | 'luxury';
  travelStyle?: string[];
}

export interface ChatStreamProgress {
  /** Whether thinking indicator should show */
  isThinking: boolean;
  /** Current partial response */
  partialResponse: string;
  /** Tokens generated */
  tokenCount: number;
}

// ─────────────────────────────────────────────────────────────
// Stream Events
// ─────────────────────────────────────────────────────────────

export type StreamEventType = 
  | 'start'
  | 'chunk'
  | 'section_complete'
  | 'progress'
  | 'complete'
  | 'error'
  | 'abort';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  data?: unknown;
}

export type StreamEventListener = (event: StreamEvent) => void;

// ─────────────────────────────────────────────────────────────
// Parser Types
// ─────────────────────────────────────────────────────────────

export interface StreamParser {
  /** Parse a chunk of data */
  parse(chunk: string): ParsedChunk[];
  /** Reset parser state */
  reset(): void;
}

export interface ParsedChunk {
  type: 'text' | 'section' | 'metadata' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// SSE Types (Server-Sent Events)
// ─────────────────────────────────────────────────────────────

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface SSEConfig extends StreamConfig {
  /** Event types to listen for */
  events?: string[];
  /** Last event ID for reconnection */
  lastEventId?: string;
}