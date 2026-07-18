/**
 * 🌊 USE CHAT STREAMING HOOK
 * Handles real-time message streaming
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Message } from '../types';

interface StreamingState {
  isStreaming: boolean;
  content: string;
  messageId: string | null;
}

export function useChatStreaming(onMessageComplete?: (message: Message) => void) {
  const [streaming, setStreaming] = useState<StreamingState>({
    isStreaming: false,
    content: '',
    messageId: null,
  });
  
  const streamBuffer = useRef<string>('');
  const streamTimer = useRef<NodeJS.Timeout | null>(null);
  
  const startStream = useCallback((messageId: string) => {
    setStreaming({
      isStreaming: true,
      content: '',
      messageId,
    });
    streamBuffer.current = '';
  }, []);
  
  const appendContent = useCallback((chunk: string) => {
    streamBuffer.current += chunk;
    setStreaming(prev => ({
      ...prev,
      content: streamBuffer.current,
    }));
  }, []);
  
  const endStream = useCallback(() => {
    if (streaming.messageId && onMessageComplete) {
      const message: Message = {
        id: streaming.messageId,
        content: { type: 'text', text: streamBuffer.current },
        sender: 'bot',
        timestamp: Date.now(),
        status: 'delivered',
        conversationId: 'default',
        senderId: 'bot',
      };
      onMessageComplete(message);
    }
    
    setStreaming({
      isStreaming: false,
      content: '',
      messageId: null,
    });
    streamBuffer.current = '';
  }, [streaming.messageId, onMessageComplete]);
  
  const cancelStream = useCallback(() => {
    setStreaming({
      isStreaming: false,
      content: '',
      messageId: null,
    });
    streamBuffer.current = '';
    if (streamTimer.current) {
      clearTimeout(streamTimer.current);
    }
  }, []);
  
  useEffect(() => {
    return () => {
      if (streamTimer.current) {
        clearTimeout(streamTimer.current);
      }
    };
  }, []);
  
  return {
    streaming,
    startStream,
    appendContent,
    endStream,
    cancelStream,
  };
}