/**
 * 🌊 STREAMING MANAGER
 * ===================
 * Production-grade streaming manager for real-time data flow
 * Supports SSE, NDJSON, and custom streaming protocols
 */

import type {
  StreamConfig,
  StreamOptions,
  StreamState,
  StreamMetrics,
  StreamEventListener,
  StreamEvent,
  SSEMessage,
} from './types';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const DEFAULT_CHUNK_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_DURATION = 300000; // 5 minutes
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

// ─────────────────────────────────────────────────────────────
// Streaming Manager Class
// ─────────────────────────────────────────────────────────────

export class StreamingManager {
  private abortController: AbortController | null = null;
  private state: StreamState;
  private listeners: Set<StreamEventListener> = new Set();
  private chunkTimeoutId: NodeJS.Timeout | null = null;
  private maxDurationTimeoutId: NodeJS.Timeout | null = null;
  private readonly config: Required<Omit<StreamConfig, 'signal'>>;

  constructor() {
    this.state = this.getInitialState();
    this.config = {
      onChunk: () => {},
      onComplete: () => {},
      onError: () => {},
      chunkTimeout: DEFAULT_CHUNK_TIMEOUT,
      maxDuration: DEFAULT_MAX_DURATION,
      debug: false,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Public Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Start a streaming request
   */
  async start<T = string>(
    options: StreamOptions,
    config?: Partial<StreamConfig>
  ): Promise<T> {
    // Merge config
    const finalConfig = { ...this.config, ...config };
    Object.assign(this.config, finalConfig);

    // Reset state
    this.state = this.getInitialState();
    this.state.isActive = true;
    this.state.startTime = Date.now();

    // Create abort controller
    this.abortController = new AbortController();

    // Merge with external signal if provided
    if (config?.signal) {
      config.signal.addEventListener('abort', () => this.cancel());
    }

    // Emit start event
    this.emit({ type: 'start', timestamp: Date.now() });

    // Set up timeouts
    this.setupTimeouts();

    try {
      const result = await this.executeStream<T>(options);
      return result;
    } catch (error) {
      const streamError = error instanceof Error ? error : new Error(String(error));
      
      if (streamError.name === 'AbortError') {
        this.emit({ type: 'abort', timestamp: Date.now() });
        throw streamError;
      }

      this.state.error = streamError;
      this.emit({ type: 'error', timestamp: Date.now(), data: streamError });
      finalConfig.onError(streamError);
      throw streamError;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Cancel the current stream
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.emit({ type: 'abort', timestamp: Date.now() });
    }
    this.cleanup();
  }

  /**
   * Get current stream state
   */
  getState(): Readonly<StreamState> {
    return { ...this.state };
  }

  /**
   * Get stream metrics
   */
  getMetrics(): StreamMetrics {
    const duration = this.state.startTime ? Date.now() - this.state.startTime : 0;
    
    return {
      duration,
      totalChunks: this.state.chunkCount,
      totalBytes: this.state.bytesReceived,
      avgChunkSize: this.state.chunkCount > 0 
        ? this.state.bytesReceived / this.state.chunkCount 
        : 0,
      chunksPerSecond: duration > 0 
        ? (this.state.chunkCount / duration) * 1000 
        : 0,
      bytesPerSecond: duration > 0 
        ? (this.state.bytesReceived / duration) * 1000 
        : 0,
    };
  }

  /**
   * Subscribe to stream events
   */
  subscribe(listener: StreamEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private getInitialState(): StreamState {
    return {
      isActive: false,
      accumulatedText: '',
      chunkCount: 0,
      startTime: null,
      lastChunkTime: null,
      error: null,
      bytesReceived: 0,
    };
  }

  private setupTimeouts(): void {
    // Chunk timeout
    this.chunkTimeoutId = setTimeout(() => {
      if (this.state.isActive) {
        this.cancel();
        this.config.onError(new Error('Stream chunk timeout'));
      }
    }, this.config.chunkTimeout);

    // Max duration timeout
    this.maxDurationTimeoutId = setTimeout(() => {
      if (this.state.isActive) {
        this.cancel();
        this.config.onError(new Error('Stream max duration exceeded'));
      }
    }, this.config.maxDuration);
  }

  private resetChunkTimeout(): void {
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
    }
    this.chunkTimeoutId = setTimeout(() => {
      if (this.state.isActive) {
        this.cancel();
        this.config.onError(new Error('Stream chunk timeout'));
      }
    }, this.config.chunkTimeout);
  }

  private async executeStream<T>(options: StreamOptions): Promise<T> {
    const {
      url,
      method = 'POST',
      headers = {},
      body,
      retries = DEFAULT_RETRIES,
      retryDelay = DEFAULT_RETRY_DELAY,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (this.abortController?.signal.aborted) {
        throw new DOMException('Stream aborted', 'AbortError');
      }

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream, application/x-ndjson',
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: this.abortController?.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        return await this.processStream<T>(response);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on abort
        if (lastError.name === 'AbortError') {
          throw lastError;
        }

        // Log retry attempt
        if (this.config.debug) {
          console.log(`[StreamingManager] Attempt ${attempt + 1} failed:`, lastError.message);
        }

        // Wait before retry
        if (attempt < retries) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Stream failed');
  }

  private async processStream<T>(response: Response): Promise<T> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (this.state.isActive) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            this.processChunk(buffer);
          }
          break;
        }

        // Reset chunk timeout on each read
        this.resetChunkTimeout();

        // Decode chunk
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            this.processChunk(line);
          }
        }
      }

      // Emit complete
      this.emit({ type: 'complete', timestamp: Date.now() });
      this.config.onComplete(this.state.accumulatedText);

      // Return parsed result
      return this.parseResult<T>();
    } finally {
      reader.releaseLock();
    }
  }

  private processChunk(rawChunk: string): void {
    // Handle SSE format
    if (rawChunk.startsWith('data:')) {
      const data = rawChunk.slice(5).trim();
      if (data === '[DONE]') {
        return;
      }
      this.handleChunk(data);
      return;
    }

    // Handle event prefix
    if (rawChunk.startsWith('event:')) {
      return; // Event type, skip
    }

    // Handle id prefix
    if (rawChunk.startsWith('id:')) {
      return; // Event ID, skip
    }

    // Regular chunk or NDJSON
    if (rawChunk.trim()) {
      this.handleChunk(rawChunk);
    }
  }

  private handleChunk(chunk: string): void {
    // Update state
    this.state.chunkCount++;
    this.state.lastChunkTime = Date.now();
    this.state.bytesReceived += chunk.length;
    this.state.accumulatedText += chunk;

    // Emit chunk event
    this.emit({ type: 'chunk', timestamp: Date.now(), data: chunk });

    // Call chunk handler
    this.config.onChunk(chunk);

    // Debug log
    if (this.config.debug) {
      console.log(`[StreamingManager] Chunk ${this.state.chunkCount}:`, chunk.substring(0, 100));
    }
  }

  private parseResult<T>(): T {
    // Try to parse as JSON
    try {
      return JSON.parse(this.state.accumulatedText) as T;
    } catch {
      // Return as string if not JSON
      return this.state.accumulatedText as unknown as T;
    }
  }

  private emit(event: StreamEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[StreamingManager] Listener error:', error);
      }
    }
  }

  private cleanup(): void {
    this.state.isActive = false;
    
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
    
    if (this.maxDurationTimeoutId) {
      clearTimeout(this.maxDurationTimeoutId);
      this.maxDurationTimeoutId = null;
    }
    
    this.abortController = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────
// SSE Parser Utility
// ─────────────────────────────────────────────────────────────

export class SSEParser {
  private buffer: string = '';

  parse(data: string): SSEMessage[] {
    this.buffer += data;
    const messages: SSEMessage[] = [];
    const lines = this.buffer.split('\n');
    
    // Keep the last incomplete line
    this.buffer = lines.pop() || '';

    let currentMessage: Partial<SSEMessage> = {};

    for (const line of lines) {
      if (line === '') {
        // Empty line signals end of message
        if (currentMessage.data !== undefined) {
          messages.push({
            id: currentMessage.id,
            event: currentMessage.event,
            data: currentMessage.data,
            retry: currentMessage.retry,
          });
        }
        currentMessage = {};
        continue;
      }

      if (line.startsWith(':')) {
        // Comment, ignore
        continue;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        // Field without value
        const field = line;
        this.setMessageField(currentMessage, field, '');
      } else {
        const field = line.substring(0, colonIndex);
        let value = line.substring(colonIndex + 1);
        
        // Remove leading space if present
        if (value.startsWith(' ')) {
          value = value.substring(1);
        }
        
        this.setMessageField(currentMessage, field, value);
      }
    }

    return messages;
  }

  private setMessageField(message: Partial<SSEMessage>, field: string, value: string): void {
    switch (field) {
      case 'id':
        message.id = value;
        break;
      case 'event':
        message.event = value;
        break;
      case 'data':
        message.data = (message.data || '') + value + '\n';
        break;
      case 'retry':
        const retry = parseInt(value, 10);
        if (!isNaN(retry)) {
          message.retry = retry;
        }
        break;
    }
  }

  reset(): void {
    this.buffer = '';
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let streamingManagerInstance: StreamingManager | null = null;

export function getStreamingManager(): StreamingManager {
  if (!streamingManagerInstance) {
    streamingManagerInstance = new StreamingManager();
  }
  return streamingManagerInstance;
}

export function resetStreamingManager(): void {
  streamingManagerInstance?.cancel();
  streamingManagerInstance = null;
}

export default StreamingManager;