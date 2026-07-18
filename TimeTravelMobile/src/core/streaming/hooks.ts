/**
 * 🎣 STREAMING HOOKS
 * ================
 * React hooks for streaming data in components
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StreamingManager, getStreamingManager } from './StreamingManager';
import type {
  StreamConfig,
  StreamOptions,
  StreamState,
  StreamMetrics,
  ItineraryStreamRequest,
  ItineraryStreamProgress,
  ChatStreamRequest,
  ChatStreamProgress,
} from './types';

// ─────────────────────────────────────────────────────────────
// useStreaming Hook
// ─────────────────────────────────────────────────────────────

export interface UseStreamingOptions {
  /** Auto-cancel on unmount */
  cancelOnUnmount?: boolean;
  /** Debug mode */
  debug?: boolean;
}

export interface UseStreamingReturn {
  /** Start streaming */
  start: (options: StreamOptions, config?: Partial<StreamConfig>) => Promise<string>;
  /** Cancel current stream */
  cancel: () => void;
  /** Current stream state */
  state: StreamState;
  /** Stream metrics */
  metrics: StreamMetrics | null;
  /** Whether stream is active */
  isStreaming: boolean;
  /** Accumulated text */
  text: string;
  /** Error if any */
  error: Error | null;
}

export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const { cancelOnUnmount = true, debug = false } = options;
  
  const managerRef = useRef<StreamingManager | null>(null);
  const [state, setState] = useState<StreamState>({
    isActive: false,
    accumulatedText: '',
    chunkCount: 0,
    startTime: null,
    lastChunkTime: null,
    error: null,
    bytesReceived: 0,
  });
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);

  // Get or create manager
  const getManager = useCallback(() => {
    if (!managerRef.current) {
      managerRef.current = new StreamingManager();
    }
    return managerRef.current;
  }, []);

  // Start streaming
  const start = useCallback(async (
    streamOptions: StreamOptions,
    config?: Partial<StreamConfig>
  ): Promise<string> => {
    const manager = getManager();
    
    // Subscribe to state updates
    const unsubscribe = manager.subscribe((event) => {
      if (debug) {
        console.log('[useStreaming] Event:', event.type);
      }
      
      setState(manager.getState());
      
      if (event.type === 'complete' || event.type === 'error') {
        setMetrics(manager.getMetrics());
      }
    });

    try {
      const result = await manager.start<string>(streamOptions, {
        ...config,
        debug,
      });
      
      return result;
    } finally {
      unsubscribe();
    }
  }, [debug, getManager]);

  // Cancel streaming
  const cancel = useCallback(() => {
    managerRef.current?.cancel();
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelOnUnmount) {
        managerRef.current?.cancel();
      }
    };
  }, [cancelOnUnmount]);

  return {
    start,
    cancel,
    state,
    metrics,
    isStreaming: state.isActive,
    text: state.accumulatedText,
    error: state.error,
  };
}

// ─────────────────────────────────────────────────────────────
// useItineraryStreaming Hook
// ─────────────────────────────────────────────────────────────

export interface UseItineraryStreamingReturn {
  /** Start itinerary streaming */
  streamItinerary: (request: ItineraryStreamRequest) => Promise<string>;
  /** Cancel streaming */
  cancel: () => void;
  /** Current progress */
  progress: ItineraryStreamProgress;
  /** Full itinerary text */
  itinerary: string;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Error if any */
  error: Error | null;
}

export function useItineraryStreaming(
  apiUrl: string
): UseItineraryStreamingReturn {
  const [progress, setProgress] = useState<ItineraryStreamProgress>({
    currentSection: '',
    completedSections: [],
    progress: 0,
    estimatedTimeRemaining: 0,
  });
  const [itinerary, setItinerary] = useState('');
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const streamItinerary = useCallback(async (
    request: ItineraryStreamRequest
  ): Promise<string> => {
    // Reset state
    setItinerary('');
    setError(null);
    setProgress({
      currentSection: '',
      completedSections: [],
      progress: 0,
      estimatedTimeRemaining: 0,
    });

    // Create abort controller
    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              // Handle progress updates
              if (parsed.section) {
                setProgress(prev => ({
                  ...prev,
                  currentSection: parsed.section,
                  completedSections: parsed.completed 
                    ? [...prev.completedSections, parsed.section]
                    : prev.completedSections,
                  progress: parsed.progress ?? prev.progress,
                }));
              }

              // Handle text content
              if (parsed.text || parsed.content) {
                accumulatedText += parsed.text || parsed.content;
                setItinerary(accumulatedText);
              }
            } catch {
              // Plain text chunk
              accumulatedText += data;
              setItinerary(accumulatedText);
            }
          }
        }

        // Estimate remaining time
        const elapsed = Date.now() - startTimeRef.current;
        const progressPercent = Math.min(
          (accumulatedText.length / 10000) * 100, // Rough estimate
          95
        );
        
        setProgress(prev => ({
          ...prev,
          progress: progressPercent,
          estimatedTimeRemaining: progressPercent > 0
            ? (elapsed / progressPercent) * (100 - progressPercent)
            : 0,
        }));
      }

      setProgress(prev => ({
        ...prev,
        progress: 100,
        estimatedTimeRemaining: 0,
      }));

      return accumulatedText;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.name !== 'AbortError') {
        setError(error);
      }
      throw error;
    }
  }, [apiUrl]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setProgress(prev => ({ ...prev, progress: 0 }));
  }, []);

  return {
    streamItinerary,
    cancel,
    progress,
    itinerary,
    isStreaming: progress.progress > 0 && progress.progress < 100,
    error,
  };
}

// ─────────────────────────────────────────────────────────────
// useChatStreaming Hook
// ─────────────────────────────────────────────────────────────

export interface UseChatStreamingReturn {
  /** Send message and stream response */
  sendMessage: (request: ChatStreamRequest) => Promise<string>;
  /** Cancel streaming */
  cancel: () => void;
  /** Current progress */
  progress: ChatStreamProgress;
  /** Full response */
  response: string;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Error if any */
  error: Error | null;
}

export function useChatStreaming(
  apiUrl: string
): UseChatStreamingReturn {
  const [progress, setProgress] = useState<ChatStreamProgress>({
    isThinking: true,
    partialResponse: '',
    tokenCount: 0,
  });
  const [response, setResponse] = useState('');
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    request: ChatStreamRequest
  ): Promise<string> => {
    // Reset state
    setResponse('');
    setError(null);
    setProgress({
      isThinking: true,
      partialResponse: '',
      tokenCount: 0,
    });

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';
      let tokenCount = 0;

      // First chunk received - stop thinking
      setProgress(prev => ({ ...prev, isThinking: false }));

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              // Handle token/content
              if (parsed.token || parsed.content || parsed.text) {
                const token = parsed.token || parsed.content || parsed.text;
                accumulatedText += token;
                tokenCount++;
                
                setResponse(accumulatedText);
                setProgress({
                  isThinking: false,
                  partialResponse: accumulatedText,
                  tokenCount,
                });
              }

              // Handle thinking state
              if (parsed.thinking !== undefined) {
                setProgress(prev => ({
                  ...prev,
                  isThinking: parsed.thinking,
                }));
              }
            } catch {
              // Plain text - accumulate character by character
              accumulatedText += data;
              tokenCount++;
              
              setResponse(accumulatedText);
              setProgress({
                isThinking: false,
                partialResponse: accumulatedText,
                tokenCount,
              });
            }
          }
        }
      }

      return accumulatedText;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.name !== 'AbortError') {
        setError(error);
      }
      throw error;
    }
  }, [apiUrl]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setProgress({
      isThinking: false,
      partialResponse: '',
      tokenCount: 0,
    });
  }, []);

  return {
    sendMessage,
    cancel,
    progress,
    response,
    isStreaming: progress.isThinking || progress.tokenCount > 0 && response.length > 0,
    error,
  };
}

export default useStreaming;