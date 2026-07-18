/**
 * ⌨️ USE TYPING ANIMATION HOOK
 * =============================
 * Production-grade animation engine for typing indicator
 * 
 * Features:
 * - Memory leak prevention with proper cleanup
 * - Smooth mount/unmount animations
 * - AppState awareness (pause on background)
 * - Multiple animation variants
 * - Performance optimization
 * - Animation control (start/stop/pause/resume)
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { Animated, AppState, AppStateStatus, Platform } from 'react-native';
import {
  AnimationConfig,
  FadeConfig,
  TypingIndicatorVariant,
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_FADE_CONFIG,
  DEFAULT_WAVE_CONFIG,
  DEFAULT_PULSE_CONFIG,
  DEFAULT_TEXT_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
} from '../typingIndicator.constants';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface AnimationControls {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export interface AnimationState {
  isAnimating: boolean;
  isPaused: boolean;
  isMounted: boolean;
}

export interface UseTypingAnimationOptions {
  /** Whether the animation should be running */
  visible: boolean;
  /** Animation variant to use */
  variant?: TypingIndicatorVariant;
  /** Animation configuration */
  config?: Partial<AnimationConfig>;
  /** Fade animation configuration */
  fadeConfig?: Partial<FadeConfig>;
  /** Number of dots to animate */
  dotCount?: number;
  /** Whether to pause on app background */
  pauseOnBackground?: boolean;
  /** Whether to enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Callback when animation starts */
  onAnimationStart?: () => void;
  /** Callback when animation stops */
  onAnimationStop?: () => void;
  /** Debug mode */
  debug?: boolean;
}

export interface UseTypingAnimationReturn {
  /** Array of animated values for each dot */
  dotAnimations: Animated.Value[];
  /** Fade animation value for container */
  fadeAnimation: Animated.Value;
  /** Scale animation value for container */
  scaleAnimation: Animated.Value;
  /** Animation controls */
  controls: AnimationControls;
  /** Current animation state */
  state: AnimationState;
  /** Text animation state (for variant='text') */
  textState: string;
  /** Whether using simplified animation (low FPS fallback) */
  isLowPerformance: boolean;
}

// ─────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────

export const useTypingAnimation = (
  options: UseTypingAnimationOptions
): UseTypingAnimationReturn => {
  const {
    visible,
    variant = 'dots',
    config: userConfig,
    fadeConfig: userFadeConfig,
    dotCount = 3,
    pauseOnBackground = true,
    enablePerformanceMonitoring = false,
    onAnimationStart,
    onAnimationStop,
    debug = false,
  } = options;

  // Merge configs with defaults
  const config = { ...DEFAULT_ANIMATION_CONFIG, ...userConfig, dotCount };
  const fadeConfig = { ...DEFAULT_FADE_CONFIG, ...userFadeConfig };

  // ─────────────────────────────────────────────────────────
  // STATE & REFS
  // ─────────────────────────────────────────────────────────

  const [state, setState] = useState<AnimationState>({
    isAnimating: false,
    isPaused: false,
    isMounted: false,
  });

  const [isLowPerformance, setIsLowPerformance] = useState(false);
  const [textState, setTextState] = useState('');

  // Animation values - using refs to persist across renders
  const dotAnimationsRef = useRef<Animated.Value[]>([]);
  const fadeAnimationRef = useRef(new Animated.Value(fadeConfig.startOpacity));
  const scaleAnimationRef = useRef(new Animated.Value(fadeConfig.startScale));

  // Animation loop references for cleanup
  const animationLoopsRef = useRef<Animated.CompositeAnimation[]>([]);
  const textAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const fadeAnimationRef_current = useRef<Animated.CompositeAnimation | null>(null);

  // AppState listener ref
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const appStateSubscriptionRef = useRef<any>(null);

  // Performance monitoring
  const frameCountRef = useRef(0);
  const lastFpsCheckRef = useRef(Date.now());
  const fpsCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug logging
  const log = useCallback(
    (message: string, ...args: any[]) => {
      if (debug) {
        console.log(`[TypingAnimation] ${message}`, ...args);
      }
    },
    [debug]
  );

  // ─────────────────────────────────────────────────────────
  // INITIALIZE ANIMATION VALUES
  // ─────────────────────────────────────────────────────────

  // Initialize dot animations once
  if (dotAnimationsRef.current.length !== dotCount) {
    dotAnimationsRef.current = Array.from(
      { length: dotCount },
      () => new Animated.Value(0)
    );
  }

  // ─────────────────────────────────────────────────────────
  // ANIMATION CREATORS
  // ─────────────────────────────────────────────────────────

  const createDotAnimation = useCallback(
    (animValue: Animated.Value, delay: number): Animated.CompositeAnimation => {
      switch (variant) {
        case 'wave':
          // Wave: smooth sine-wave motion
          return Animated.loop(
            Animated.sequence([
              Animated.delay(delay),
              Animated.loop(
                Animated.sequence([
                  Animated.timing(animValue, {
                    toValue: 1,
                    duration: config.duration / 2,
                    useNativeDriver: DEFAULT_PERFORMANCE_CONFIG.useNativeDriver,
                  }),
                  Animated.timing(animValue, {
                    toValue: 0,
                    duration: config.duration / 2,
                    useNativeDriver: DEFAULT_PERFORMANCE_CONFIG.useNativeDriver,
                  }),
                ])
              ),
            ])
          );

        case 'pulse':
          // Pulse: scale pulse without translation
          return Animated.loop(
            Animated.sequence([
              Animated.delay(delay),
              Animated.loop(
                Animated.sequence([
                  Animated.timing(animValue, {
                    toValue: 1,
                    duration: DEFAULT_PULSE_CONFIG.duration / 2,
                    useNativeDriver: DEFAULT_PERFORMANCE_CONFIG.useNativeDriver,
                  }),
                  Animated.timing(animValue, {
                    toValue: 0,
                    duration: DEFAULT_PULSE_CONFIG.duration / 2,
                    useNativeDriver: DEFAULT_PERFORMANCE_CONFIG.useNativeDriver,
                  }),
                ])
              ),
            ])
          );

        case 'dots':
        default:
          // Dots: bounce with scale
          return Animated.loop(
            Animated.sequence([
              Animated.delay(delay),
              Animated.loop(
                Animated.sequence([
                  Animated.timing(animValue, {
                    toValue: 1,
                    duration: config.duration,
                    useNativeDriver: DEFAULT_PERFORMANCE_CONFIG.useNativeDriver,
                  }),
                  Animated.timing(animValue, {
                    toValue: 0,
                    duration: config.duration,
                    useNativeDriver: DEFAULT_PERFORMANCE_CONFIG.useNativeDriver,
                  }),
                ])
              ),
            ])
          );
      }
    },
    [variant, config.duration]
  );

  const createTextAnimation = useCallback(() => {
    const characters = DEFAULT_TEXT_CONFIG.characters;
    let currentIndex = 0;

    return Animated.loop(
      Animated.sequence(
        characters.map((_, index) =>
          Animated.sequence([
            Animated.delay(DEFAULT_TEXT_CONFIG.cycleDuration),
            Animated.timing(new Animated.Value(0), {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        )
      )
    );
  }, []);

  // ─────────────────────────────────────────────────────────
  // FADE ANIMATION
  // ─────────────────────────────────────────────────────────

  const animateFadeIn = useCallback(() => {
    log('Starting fade in');

    // Stop any existing fade animation
    if (fadeAnimationRef_current.current) {
      fadeAnimationRef_current.current.stop();
    }

    fadeAnimationRef_current.current = Animated.parallel([
      Animated.timing(fadeAnimationRef.current, {
        toValue: fadeConfig.endOpacity,
        duration: fadeConfig.fadeInDuration,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimationRef.current, {
        toValue: fadeConfig.endScale,
        duration: fadeConfig.fadeInDuration,
        useNativeDriver: true,
      }),
    ]);

    fadeAnimationRef_current.current.start(() => {
      setState(prev => ({ ...prev, isMounted: true }));
      log('Fade in complete');
    });
  }, [fadeConfig, log]);

  const animateFadeOut = useCallback(() => {
    log('Starting fade out');

    // Stop any existing fade animation
    if (fadeAnimationRef_current.current) {
      fadeAnimationRef_current.current.stop();
    }

    fadeAnimationRef_current.current = Animated.parallel([
      Animated.timing(fadeAnimationRef.current, {
        toValue: fadeConfig.startOpacity,
        duration: fadeConfig.fadeOutDuration,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimationRef.current, {
        toValue: fadeConfig.startScale,
        duration: fadeConfig.fadeOutDuration,
        useNativeDriver: true,
      }),
    ]);

    fadeAnimationRef_current.current.start(() => {
      setState(prev => ({ ...prev, isMounted: false }));
      log('Fade out complete');
    });
  }, [fadeConfig, log]);

  // ─────────────────────────────────────────────────────────
  // ANIMATION CONTROLS
  // ─────────────────────────────────────────────────────────

  const start = useCallback(() => {
    log('Starting animation');
    setState(prev => ({ ...prev, isAnimating: true, isPaused: false }));

    // Start fade in first
    animateFadeIn();

    // Create and start dot animations
    const animations = dotAnimationsRef.current.map((animValue, index) => {
      const delay = index * config.staggerDelay;
      return createDotAnimation(animValue, delay);
    });

    animationLoopsRef.current = animations;
    animations.forEach(anim => anim.start());

    onAnimationStart?.();
  }, [animateFadeIn, config.staggerDelay, createDotAnimation, log, onAnimationStart]);

  const stop = useCallback(() => {
    log('Stopping animation');

    // Stop all dot animations
    animationLoopsRef.current.forEach(anim => anim.stop());
    animationLoopsRef.current = [];

    // Stop text animation if exists
    if (textAnimationRef.current) {
      textAnimationRef.current.stop();
      textAnimationRef.current = null;
    }

    // Animate fade out
    animateFadeOut();

    setState(prev => ({ ...prev, isAnimating: false, isPaused: false }));
    onAnimationStop?.();
  }, [animateFadeOut, log, onAnimationStop]);

  const pause = useCallback(() => {
    log('Pausing animation');
    setState(prev => ({ ...prev, isPaused: true }));

    // Pause by stopping animations (they'll be restarted on resume)
    animationLoopsRef.current.forEach(anim => anim.stop());
  }, [log]);

  const resume = useCallback(() => {
    log('Resuming animation');
    setState(prev => ({ ...prev, isPaused: false }));

    // Restart animations from current state
    animationLoopsRef.current.forEach(anim => anim.start());
  }, [log]);

  const reset = useCallback(() => {
    log('Resetting animation');

    // Stop all animations
    stop();

    // Reset values
    dotAnimationsRef.current.forEach(anim => anim.setValue(0));
    fadeAnimationRef.current.setValue(fadeConfig.startOpacity);
    scaleAnimationRef.current.setValue(fadeConfig.startScale);

    setState({
      isAnimating: false,
      isPaused: false,
      isMounted: false,
    });
  }, [fadeConfig.startOpacity, fadeConfig.startScale, log, stop]);

  // ─────────────────────────────────────────────────────────
  // PERFORMANCE MONITORING
  // ─────────────────────────────────────────────────────────

  const startPerformanceMonitoring = useCallback(() => {
    if (!enablePerformanceMonitoring) return;

    fpsCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastFpsCheckRef.current;
      const fps = (frameCountRef.current / elapsed) * 1000;

      if (fps < DEFAULT_PERFORMANCE_CONFIG.minFPS && !isLowPerformance) {
        log('Low FPS detected, switching to simplified animation', fps);
        setIsLowPerformance(true);
      }

      frameCountRef.current = 0;
      lastFpsCheckRef.current = now;
    }, DEFAULT_PERFORMANCE_CONFIG.fpsCheckInterval);
  }, [enablePerformanceMonitoring, isLowPerformance, log]);

  const stopPerformanceMonitoring = useCallback(() => {
    if (fpsCheckIntervalRef.current) {
      clearInterval(fpsCheckIntervalRef.current);
      fpsCheckIntervalRef.current = null;
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // APP STATE HANDLING
  // ─────────────────────────────────────────────────────────

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (pauseOnBackground) {
        if (
          appStateRef.current === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          log('App going to background, pausing animation');
          pause();
        } else if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          log('App coming to foreground, resuming animation');
          if (visible && state.isAnimating) {
            resume();
          }
        }
      }
      appStateRef.current = nextAppState;
    },
    [pause, pauseOnBackground, resume, log, visible, state.isAnimating]
  );

  // ─────────────────────────────────────────────────────────
  // TEXT ANIMATION (for variant='text')
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (variant === 'text' && visible && state.isAnimating) {
      const characters = DEFAULT_TEXT_CONFIG.characters;
      let currentIndex = 0;

      const intervalId = setInterval(() => {
        setTextState(characters[currentIndex]);
        currentIndex = (currentIndex + 1) % characters.length;
      }, DEFAULT_TEXT_CONFIG.cycleDuration);

      return () => clearInterval(intervalId);
    } else {
      setTextState('');
    }
  }, [variant, visible, state.isAnimating]);

  // ─────────────────────────────────────────────────────────
  // MAIN VISIBILITY EFFECT
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    log('Visibility changed', visible);

    if (visible) {
      start();
      if (enablePerformanceMonitoring) {
        startPerformanceMonitoring();
      }
    } else {
      stop();
      stopPerformanceMonitoring();
    }

    return () => {
      stop();
      stopPerformanceMonitoring();
    };
  }, [visible, start, stop, enablePerformanceMonitoring, startPerformanceMonitoring, stopPerformanceMonitoring, log]);

  // ─────────────────────────────────────────────────────────
  // APP STATE SUBSCRIPTION
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (pauseOnBackground) {
      appStateSubscriptionRef.current = AppState.addEventListener(
        'change',
        handleAppStateChange
      );
    }

    return () => {
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove();
      }
    };
  }, [handleAppStateChange, pauseOnBackground]);

  // ─────────────────────────────────────────────────────────
  // CLEANUP ON UNMOUNT
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      log('Component unmounting, cleaning up');

      // Stop all dot animations
      animationLoopsRef.current.forEach(anim => {
        anim.stop();
      });
      animationLoopsRef.current = [];

      // Stop fade animation
      if (fadeAnimationRef_current.current) {
        fadeAnimationRef_current.current.stop();
      }

      // Stop text animation
      if (textAnimationRef.current) {
        textAnimationRef.current.stop();
      }

      // Stop performance monitoring
      stopPerformanceMonitoring();

      // Remove app state listener
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove();
      }
    };
  }, [log, stopPerformanceMonitoring]);

  // ─────────────────────────────────────────────────────────
  // RETURN VALUE
  // ─────────────────────────────────────────────────────────

  return {
    dotAnimations: dotAnimationsRef.current,
    fadeAnimation: fadeAnimationRef.current,
    scaleAnimation: scaleAnimationRef.current,
    controls: { start, stop, pause, resume, reset },
    state,
    textState,
    isLowPerformance,
  };
};

export default useTypingAnimation;