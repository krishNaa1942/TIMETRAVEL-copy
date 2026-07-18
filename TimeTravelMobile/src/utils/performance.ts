/**
 * Performance Utilities
 * =====================
 * 
 * Production-grade performance optimization utilities
 * for smooth 60 FPS experience.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────
// DEBOUNCE HOOK
// ─────────────────────────────────────────────────────────────

/**
 * Debounces a value with cleanup
 * Prevents excessive API calls / computations
 */
export function useDebouncedValue<T>(
  value: T,
  delay: number = 300
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─────────────────────────────────────────────────────────────
// THROTTLE HOOK
// ─────────────────────────────────────────────────────────────

/**
 * Throttles a callback function
 * Limits execution rate for scroll/map events
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 100
): T {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRun.current;

      if (timeSinceLastRun >= limit) {
        lastRun.current = now;
        callback(...args);
      } else {
        // Schedule remaining execution
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastRun.current = Date.now();
          callback(...args);
        }, limit - timeSinceLastRun);
      }
    }) as T,
    [callback, limit]
  );
}

// ─────────────────────────────────────────────────────────────
// STABLE CALLBACK
// ─────────────────────────────────────────────────────────────

/**
 * Creates a stable callback reference
 * Prevents re-renders from inline functions
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef<T>(callback);

  // Always update ref to latest callback
  callbackRef.current = callback;

  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  );
}

// ─────────────────────────────────────────────────────────────
// MEMOIZED SELECTOR
// ─────────────────────────────────────────────────────────────

/**
 * Creates a memoized selector with deep comparison
 * Prevents unnecessary re-computations
 */
export function useDeepMemo<T>(factory: () => T, deps: any[]): T {
  const ref = useRef<{ value: T; deps: any[] } | null>(null);

  if (!ref.current || !shallowEqual(ref.current.deps, deps)) {
    ref.current = { value: factory(), deps };
  }

  return ref.current.value;
}

function shallowEqual(arr1: any[], arr2: any[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// INTERSECTION OBSERVER HOOK (for lazy loading)
// ─────────────────────────────────────────────────────────────

/**
 * Tracks element visibility for lazy loading
 * Reduces initial render cost
 */
export function useIntersectionObserver(
  options: { threshold?: number; rootMargin?: string } = {}
): { ref: (node: HTMLElement | null) => void; isIntersecting: boolean } {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          setIsIntersecting(entry.isIntersecting);
        },
        {
          threshold: options.threshold ?? 0.1,
          rootMargin: options.rootMargin ?? '100px',
        }
      );

      observerRef.current.observe(node);
    },
    [options.threshold, options.rootMargin]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { ref, isIntersecting };
}

// ─────────────────────────────────────────────────────────────
// RUNTIME PERFORMANCE MONITOR
// ─────────────────────────────────────────────────────────────

/**
 * Measures component render time
 * Use in development to identify slow renders
 */
export function useRenderTime(componentName: string): void {
  if (__DEV__) {
    const startTime = useRef(Date.now());

    useEffect(() => {
      const renderTime = Date.now() - startTime.current;
      if (renderTime > 16) {
        console.warn(`[Performance] ${componentName} took ${renderTime}ms (> 16ms frame budget)`);
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// IDLE CALLBACK UTILITY
// ─────────────────────────────────────────────────────────────

/**
 * Schedules work during browser idle periods
 * Prevents main thread blocking
 */
export const scheduleIdleWork = (
  callback: () => void,
  options: { timeout?: number } = {}
): void => {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(callback, { timeout: options.timeout ?? 2000 });
  } else {
    // Fallback for environments without requestIdleCallback
    setTimeout(callback, 1);
  }
};

// ─────────────────────────────────────────────────────────────
// BATCH UPDATES UTILITY
// ─────────────────────────────────────────────────────────────

/**
 * Batches multiple state updates
 * Prevents multiple re-renders
 */
export function useBatchedUpdates<T extends Record<string, any>>(
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState<T>(initialState);

  const batchUpdate = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return [state, batchUpdate];
}

// ─────────────────────────────────────────────────────────────
// LIST VIRTUALIZATION HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Estimates item size for FlashList
 */
export const LIST_ITEM_ESTIMATED_SIZE = {
  destinationCard: 280,
  itineraryItem: 120,
  chatMessage: 80,
  listItem: 64,
  sectionHeader: 48,
};

/**
 * Key extractors for stable keys
 */
export const createKeyExtractor = (prefix: string) => 
  <T extends { id: string }>(item: T) => `${prefix}-${item.id}`;

// ─────────────────────────────────────────────────────────────
// MEMORY MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Cleanup effect helper
 * Ensures all resources are cleaned up on unmount
 */
export function useCleanup(cleanup: () => void): void {
  useEffect(() => cleanup, []);
}

/**
 * Timer with automatic cleanup
 */
export function useTimer(
  callback: () => void,
  delay: number | null
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

// ─────────────────────────────────────────────────────────────
// REFERENCE UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Creates a stable object reference
 * Prevents re-renders from new object/array creation
 */
export function useStableReference<T>(value: T): T {
  const ref = useRef(value);
  ref.current = useMemo(() => value, [JSON.stringify(value)]);
  return ref.current;
}

// No default export needed - use named exports
