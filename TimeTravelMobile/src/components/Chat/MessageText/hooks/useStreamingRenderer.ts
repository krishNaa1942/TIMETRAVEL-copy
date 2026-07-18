/**
 * 🌊 STREAMING RENDERER HOOK
 * ===========================
 * Production-grade streaming text rendering for AI chat responses
 * 
 * @version 2.0.0
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Animated,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  StreamingState,
  StreamingConfig,
  ParsedContent,
  MarkdownNode,
} from '../types';
import { parseMarkdown, parseMarkdownIncremental } from '../utils/markdownParser';

// ─────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: StreamingConfig = {
  minChunkSize: 5,
  debounceMs: 16, // ~60fps
  showCursor: true,
  cursorSpeed: 530,
  autoScroll: true,
  batchUpdates: true,
  maxBatchSize: 100,
};

// ─────────────────────────────────────────────────────────────
// HOOK RETURN TYPE
// ─────────────────────────────────────────────────────────────

export interface StreamingRendererResult {
  /** Current streaming state */
  state: StreamingState;
  /** Parsed markdown content */
  parsedContent: ParsedContent | null;
  /** Animated cursor opacity value */
  cursorOpacity: Animated.Value;
  /** Whether cursor should be shown */
  showCursor: boolean;
  /** Start streaming */
  startStreaming: () => void;
  /** Stop streaming */
  stopStreaming: () => void;
  /** Update streaming content */
  updateContent: (content: string) => void;
  /** Append content to stream */
  appendContent: (delta: string) => void;
  /** Reset streaming state */
  reset: () => void;
  /** Performance metrics */
  metrics: {
    totalUpdates: number;
    averageUpdateTime: number;
    lastUpdateTime: number;
  };
}

// ─────────────────────────────────────────────────────────────
// HOOK IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export function useStreamingRenderer(
  initialContent: string = '',
  isStreaming: boolean = false,
  config: Partial<StreamingConfig> = {}
): StreamingRendererResult {
  // Merge config with defaults
  const fullConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config,
  }), [config]);

  // State
  const [state, setState] = useState<StreamingState>(() => ({
    isActive: isStreaming,
    content: initialContent,
    renderedContent: '',
    deltaContent: '',
    cursorPosition: initialContent.length,
    tokenCount: 0,
    startedAt: isStreaming ? Date.now() : undefined,
    lastUpdate: Date.now(),
  }));

  // Parsed content state
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(() => 
    initialContent ? parseMarkdown(initialContent) : null
  );

  // Cursor animation
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const cursorAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Performance tracking
  const metricsRef = useRef({
    totalUpdates: 0,
    totalTime: 0,
    lastUpdateTime: 0,
  });

  // Previous content ref for incremental parsing
  const previousContentRef = useRef<string>(initialContent);
  const previousParsedRef = useRef<ParsedContent | null>(parsedContent);

  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // App state ref
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ─────────────────────────────────────────────────────────────
  // CURSOR ANIMATION
  // ─────────────────────────────────────────────────────────────

  const startCursorAnimation = useCallback(() => {
    if (!fullConfig.showCursor) return;

    // Stop existing animation
    if (cursorAnimationRef.current) {
      cursorAnimationRef.current.stop();
    }

    // Create blinking animation
    cursorAnimationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: fullConfig.cursorSpeed,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: fullConfig.cursorSpeed,
          useNativeDriver: true,
        }),
      ])
    );

    cursorAnimationRef.current.start();
  }, [cursorOpacity, fullConfig.cursorSpeed, fullConfig.showCursor]);

  const stopCursorAnimation = useCallback(() => {
    if (cursorAnimationRef.current) {
      cursorAnimationRef.current.stop();
      cursorAnimationRef.current = null;
    }
    cursorOpacity.setValue(1);
  }, [cursorOpacity]);

  // ─────────────────────────────────────────────────────────────
  // APP STATE HANDLING
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && appStateRef.current !== 'active') {
        // App came to foreground
        if (state.isActive) {
          startCursorAnimation();
        }
      } else if (nextAppState !== 'active' && appStateRef.current === 'active') {
        // App went to background
        stopCursorAnimation();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [state.isActive, startCursorAnimation, stopCursorAnimation]);

  // ─────────────────────────────────────────────────────────────
  // STREAMING CONTROLS
  // ─────────────────────────────────────────────────────────────

  const startStreaming = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: true,
      startedAt: Date.now(),
      lastUpdate: Date.now(),
    }));
    startCursorAnimation();
  }, [startCursorAnimation]);

  const stopStreaming = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
    }));
    stopCursorAnimation();
  }, [stopCursorAnimation]);

  const reset = useCallback(() => {
    setState({
      isActive: false,
      content: '',
      renderedContent: '',
      deltaContent: '',
      cursorPosition: 0,
      tokenCount: 0,
    });
    setParsedContent(null);
    previousContentRef.current = '';
    previousParsedRef.current = null;
    metricsRef.current = {
      totalUpdates: 0,
      totalTime: 0,
      lastUpdateTime: 0,
    };
    stopCursorAnimation();
  }, [stopCursorAnimation]);

  // ─────────────────────────────────────────────────────────────
  // CONTENT UPDATE
  // ─────────────────────────────────────────────────────────────

  const parseAndUpdateContent = useCallback((newContent: string) => {
    const startTime = performance?.now?.() || Date.now();

    // Incremental parsing
    const result = parseMarkdownIncremental(
      newContent,
      previousContentRef.current,
      previousParsedRef.current
    );

    setParsedContent(result.parsed);

    // Update refs for next incremental parse
    previousContentRef.current = newContent;
    previousParsedRef.current = result.parsed;

    // Update metrics
    const updateTime = (performance?.now?.() || Date.now()) - startTime;
    metricsRef.current.totalUpdates++;
    metricsRef.current.totalTime += updateTime;
    metricsRef.current.lastUpdateTime = updateTime;
  }, []);

  const updateContent = useCallback((newContent: string) => {
    setState(prev => {
      const delta = newContent.slice(prev.content.length);
      return {
        ...prev,
        content: newContent,
        renderedContent: prev.content,
        deltaContent: delta,
        cursorPosition: newContent.length,
        tokenCount: newContent.split(/\s+/).filter(Boolean).length,
        lastUpdate: Date.now(),
      };
    });

    // Debounced parsing
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      parseAndUpdateContent(newContent);
    }, fullConfig.debounceMs);
  }, [fullConfig.debounceMs, parseAndUpdateContent]);

  const appendContent = useCallback((delta: string) => {
    setState(prev => {
      const newContent = prev.content + delta;
      return {
        ...prev,
        content: newContent,
        renderedContent: prev.content,
        deltaContent: delta,
        cursorPosition: newContent.length,
        tokenCount: prev.tokenCount + delta.split(/\s+/).filter(Boolean).length,
        lastUpdate: Date.now(),
      };
    });

    // Immediate parse for small content, debounced for large
    if (delta.length < fullConfig.minChunkSize) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      parseAndUpdateContent(previousContentRef.current + delta);
    }, fullConfig.debounceMs);
  }, [fullConfig.debounceMs, fullConfig.minChunkSize, parseAndUpdateContent]);

  // ─────────────────────────────────────────────────────────────
  // SYNC WITH EXTERNAL STREAMING STATE
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isStreaming && !state.isActive) {
      startStreaming();
    } else if (!isStreaming && state.isActive) {
      stopStreaming();
    }
  }, [isStreaming, state.isActive, startStreaming, stopStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      stopCursorAnimation();
    };
  }, [stopCursorAnimation]);

  // ─────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────

  const metrics = useMemo(() => ({
    totalUpdates: metricsRef.current.totalUpdates,
    averageUpdateTime: metricsRef.current.totalUpdates > 0
      ? metricsRef.current.totalTime / metricsRef.current.totalUpdates
      : 0,
    lastUpdateTime: metricsRef.current.lastUpdateTime,
  }), [state.lastUpdate]);

  return {
    state,
    parsedContent,
    cursorOpacity,
    showCursor: fullConfig.showCursor && state.isActive,
    startStreaming,
    stopStreaming,
    updateContent,
    appendContent,
    reset,
    metrics,
  };
}

export default useStreamingRenderer;