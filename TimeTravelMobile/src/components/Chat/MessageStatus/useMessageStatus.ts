/**
 * 📊 USE MESSAGE STATUS HOOK
 * ==========================
 * Production-grade hook for managing message status state
 * Handles animations, retry logic, and real-time updates
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence, Easing, interpolateColor, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  MessageStatusType,
  StatusIconConfig,
  ChatTheme,
  StatusMetadata,
  GroupStatusSummary,
  RetryConfig,
  RetryState,
  TimeDisplayFormat,
  STATUS_PRIORITY,
} from './types';

import {
  getStatusIcon,
  getStatusColor,
  getStatusLabel,
  getStatusAccessibilityLabel,
  formatTime,
  formatTimeRelative,
  calculateBackoffDelay,
  calculateGroupSummary,
  isPendingStatus,
  isErrorStatus,
  isValidTransition,
  TIME,
} from './statusUtils';

// ─────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  debounceMs: 500,
};

// ─────────────────────────────────────────────────────────────
// HOOK INTERFACE
// ─────────────────────────────────────────────────────────────

interface UseMessageStatusOptions {
  status: MessageStatusType;
  timestamp: number;
  isUser: boolean;
  theme: ChatTheme;
  metadata?: StatusMetadata;
  
  // Time formatting
  timeFormat?: TimeDisplayFormat;
  locale?: string;
  
  // Retry
  onRetry?: () => Promise<void> | void;
  retryConfig?: Partial<RetryConfig>;
  
  // Group chat
  isGroupChat?: boolean;
  totalParticipants?: number;
  
  // Visual customization
  customIcons?: Partial<Record<MessageStatusType, StatusIconConfig>>;
  customColors?: Partial<Record<MessageStatusType, { primary: string }>>;
  
  // Animation
  enableAnimations?: boolean;
  animationDuration?: number;
  
  // Haptic feedback
  enableHaptics?: boolean;
}

interface UseMessageStatusReturn {
  // Computed visual values
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
  
  // Status predicates
  isPending: boolean;
  isComplete: boolean;
  isError: boolean;
  canRetry: boolean;
  
  // Animation styles
  animatedIconStyle: ReturnType<typeof useAnimatedStyle>;
  animatedContainerStyle: ReturnType<typeof useAnimatedStyle>;
  
  // Actions
  resetRetryState: () => void;
  
  // Internal state for component
  showRetryButton: boolean;
  isAnimating: boolean;
}

// ─────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────

export const useMessageStatus = (options: UseMessageStatusOptions): UseMessageStatusReturn => {
  const {
    status,
    timestamp,
    isUser,
    theme,
    metadata,
    timeFormat = 'smart',
    locale = 'en-US',
    onRetry,
    retryConfig: customRetryConfig,
    isGroupChat = false,
    totalParticipants = 0,
    customIcons,
    customColors,
    enableAnimations = true,
    animationDuration = 300,
    enableHaptics = true,
  } = options;

  // Merge retry config with defaults
  const retryConfig = useMemo(() => ({
    ...DEFAULT_RETRY_CONFIG,
    ...customRetryConfig,
  }), [customRetryConfig]);

  // ───────────────────────────────────────────────────────────
  // STATE
  // ───────────────────────────────────────────────────────────

  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    currentAttempt: metadata?.retryCount ?? 0,
    nextRetryIn: 0,
    canRetry: (metadata?.retryCount ?? 0) < retryConfig.maxRetries,
    lastError: metadata?.errorMessage,
  });

  const [isAnimating, setIsAnimating] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Refs for debounce and cleanup
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRetryRef = useRef<number>(0);
  const prevStatusRef = useRef<MessageStatusType>(status);

  // ───────────────────────────────────────────────────────────
  // REANIMATED VALUES
  // ───────────────────────────────────────────────────────────

  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const colorProgress = useSharedValue(0);

  // ───────────────────────────────────────────────────────────
  // COMPUTED VALUES (Memoized for performance)
  // ───────────────────────────────────────────────────────────

  const icon = useMemo(() => getStatusIcon(status, customIcons), [status, customIcons]);
  
  const color = useMemo(() => getStatusColor(status, theme, customColors), [status, theme, customColors]);
  
  const label = useMemo(() => getStatusLabel(status), [status]);
  
  const formattedTime = useMemo(() => formatTime(timestamp, timeFormat, locale), [timestamp, timeFormat, locale]);
  
  const relativeTime = useMemo(() => formatTimeRelative(timestamp, locale), [timestamp, locale]);
  
  const accessibilityLabel = useMemo(() => 
    getStatusAccessibilityLabel(status, timestamp, formattedTime, metadata?.readBy),
    [status, timestamp, formattedTime, metadata?.readBy]
  );

  // Status predicates
  const isPending = useMemo(() => isPendingStatus(status), [status]);
  const isError = useMemo(() => isErrorStatus(status), [status]);
  const isComplete = useMemo(() => STATUS_PRIORITY[status] >= STATUS_PRIORITY.delivered, [status]);
  const canRetry = useMemo(() => isError && retryState.canRetry && !retryState.isRetrying, [isError, retryState]);

  // Show retry button only for failed status
  const showRetryButton = useMemo(() => status === 'failed' && !!onRetry, [status, onRetry]);

  // Group status summary
  const groupSummary = useMemo(() => {
    if (!isGroupChat || totalParticipants <= 1) return null;
    return calculateGroupSummary(totalParticipants, metadata?.readBy, metadata?.deliveredTo);
  }, [isGroupChat, totalParticipants, metadata?.readBy, metadata?.deliveredTo]);

  // ───────────────────────────────────────────────────────────
  // ANIMATIONS
  // ───────────────────────────────────────────────────────────

  // Trigger haptic feedback
  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') => {
    if (!enableHaptics) return;
    
    try {
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
      }
    } catch {
      // Haptics not available
    }
  }, [enableHaptics]);

  // Handle status change animations
  useEffect(() => {
    if (!enableAnimations) return;
    
    const prevStatus = prevStatusRef.current;
    if (prevStatus === status) return;
    
    // Validate transition
    if (!isValidTransition(prevStatus, status)) {
      console.warn(`Invalid status transition: ${prevStatus} -> ${status}`);
    }

    // Animate based on transition
    const animationComplete = () => {
      setIsAnimating(false);
    };

    setIsAnimating(true);

    switch (status) {
      case 'sending':
      case 'uploading':
        // Fade out slightly
        opacity.value = withTiming(0.7, { duration: animationDuration });
        // Rotate for loading effect (continuous, handled in component)
        break;

      case 'sent':
        // Fade back in from sending
        opacity.value = withTiming(1, { duration: animationDuration });
        // Quick scale pulse
        scale.value = withSequence(
          withTiming(1.2, { duration: animationDuration / 2 }),
          withTiming(1, { duration: animationDuration / 2 })
        );
        runOnJS(triggerHaptic)('light');
        runOnJS(animationComplete)();
        break;

      case 'delivered':
        // Scale animation
        scale.value = withSequence(
          withTiming(1.3, { duration: animationDuration / 2 }),
          withSpring(1, { damping: 10, stiffness: 300 })
        );
        runOnJS(triggerHaptic)('light');
        runOnJS(animationComplete)();
        break;

      case 'read':
        // Color transition + scale
        colorProgress.value = withTiming(1, { duration: animationDuration });
        scale.value = withSequence(
          withTiming(1.2, { duration: animationDuration / 3 }),
          withSpring(1, { damping: 8, stiffness: 200 })
        );
        runOnJS(triggerHaptic)('success');
        runOnJS(animationComplete)();
        break;

      case 'failed':
        // Shake animation
        scale.value = withSequence(
          withTiming(0.9, { duration: 50 }),
          withTiming(1.1, { duration: 50 }),
          withTiming(0.95, { duration: 50 }),
          withTiming(1.05, { duration: 50 }),
          withTiming(1, { duration: 100 })
        );
        rotation.value = withSequence(
          withTiming(-5, { duration: 50 }),
          withTiming(5, { duration: 50 }),
          withTiming(-3, { duration: 50 }),
          withTiming(3, { duration: 50 }),
          withTiming(0, { duration: 100 })
        );
        runOnJS(triggerHaptic)('error');
        runOnJS(animationComplete)();
        break;

      default:
        opacity.value = withTiming(1, { duration: animationDuration });
        runOnJS(animationComplete)();
    }

    prevStatusRef.current = status;
  }, [status, enableAnimations, animationDuration, opacity, scale, rotation, colorProgress, triggerHaptic]);

  // Animated styles
  const animatedIconStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotateZ: `${rotation.value}deg` },
    ],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // ───────────────────────────────────────────────────────────
  // RETRY HANDLING
  // ───────────────────────────────────────────────────────────

  const handleRetry = useCallback(async () => {
    if (!onRetry || retryState.isRetrying) return;
    
    // Debounce check
    const now = Date.now();
    if (now - lastRetryRef.current < retryConfig.debounceMs) return;
    lastRetryRef.current = now;

    // Clear any existing timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const nextAttempt = retryState.currentAttempt + 1;
    
    // Check if we can retry
    if (nextAttempt > retryConfig.maxRetries) {
      setRetryState(prev => ({
        ...prev,
        canRetry: false,
      }));
      return;
    }

    // Set retrying state
    setRetryState(prev => ({
      ...prev,
      isRetrying: true,
      currentAttempt: nextAttempt,
    }));

    try {
      await onRetry();
      
      // Success - reset state
      setRetryState({
        isRetrying: false,
        currentAttempt: 0,
        nextRetryIn: 0,
        canRetry: true,
        lastError: undefined,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Calculate backoff delay
      const delay = calculateBackoffDelay(
        nextAttempt,
        retryConfig.initialDelayMs,
        retryConfig.maxDelayMs,
        retryConfig.backoffMultiplier
      );

      // Update state with error
      setRetryState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: errorMessage,
        nextRetryIn: delay,
        canRetry: nextAttempt < retryConfig.maxRetries,
      }));

      // Schedule automatic retry if configured
      if (nextAttempt < retryConfig.maxRetries) {
        retryTimeoutRef.current = setTimeout(() => {
          handleRetry();
        }, delay);
      }

      // Trigger haptic for error
      await triggerHaptic('error');
    }
  }, [onRetry, retryState, retryConfig, triggerHaptic]);

  const resetRetryState = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    setRetryState({
      isRetrying: false,
      currentAttempt: 0,
      nextRetryIn: 0,
      canRetry: true,
      lastError: undefined,
    });
  }, []);

  // ───────────────────────────────────────────────────────────
  // TIME AUTO-UPDATE
  // ───────────────────────────────────────────────────────────

  useEffect(() => {
    // Update relative time every minute
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, TIME.MINUTE);

    return () => clearInterval(interval);
  }, []);

  // ───────────────────────────────────────────────────────────
  // CLEANUP
  // ───────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // ───────────────────────────────────────────────────────────
  // RETURN
  // ───────────────────────────────────────────────────────────

  return {
    // Computed visual values
    icon,
    color,
    label,
    accessibilityLabel,
    
    // Time formatting
    formattedTime,
    relativeTime,
    
    // Retry handling
    retryState,
    handleRetry,
    
    // Group status
    groupSummary,
    
    // Status predicates
    isPending,
    isComplete,
    isError,
    canRetry,
    
    // Animation styles
    animatedIconStyle,
    animatedContainerStyle,
    
    // Actions
    resetRetryState,
    
    // Internal state
    showRetryButton,
    isAnimating,
  };
};

export default useMessageStatus;