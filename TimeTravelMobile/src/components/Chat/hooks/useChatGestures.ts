/**
 * 👆 USE CHAT GESTURES HOOK
 * Handles swipe and long-press gestures
 */

import { useCallback, useRef, useState } from 'react';
import { PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';

interface GestureState {
  isLongPress: boolean;
  swipeDirection: 'left' | 'right' | null;
}

interface GestureCallbacks {
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onReply?: () => void;
}

const SWIPE_THRESHOLD = 50;
const LONG_PRESS_DURATION = 500;

export function useChatGestures(callbacks: GestureCallbacks = {}) {
  const [state, setState] = useState<GestureState>({
    isLongPress: false,
    swipeDirection: null,
  });
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startX = useRef(0);
  
  const handleLongPress = useCallback(() => {
    setState(prev => ({ ...prev, isLongPress: true }));
    callbacks.onLongPress?.();
  }, [callbacks]);
  
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setState(prev => ({ ...prev, isLongPress: false }));
  }, []);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: (evt) => {
        startX.current = evt.nativeEvent.pageX;
        longPressTimer.current = setTimeout(handleLongPress, LONG_PRESS_DURATION);
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 20) {
          clearLongPress();
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        clearLongPress();
        
        const { dx } = gestureState;
        
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          if (dx > 0) {
            setState(prev => ({ ...prev, swipeDirection: 'right' }));
            callbacks.onSwipeRight?.();
            callbacks.onReply?.();
          } else {
            setState(prev => ({ ...prev, swipeDirection: 'left' }));
            callbacks.onSwipeLeft?.();
          }
        }
        
        setTimeout(() => {
          setState(prev => ({ ...prev, swipeDirection: null }));
        }, 200);
      },
      onPanResponderTerminate: () => {
        clearLongPress();
      },
    })
  ).current;
  
  return {
    ...state,
    panHandlers: panResponder.panHandlers,
    clearLongPress,
  };
}