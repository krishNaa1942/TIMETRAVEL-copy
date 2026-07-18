/**
 * 📨 USE MESSAGE QUEUE HOOK
 * Manages message queue with optimistic updates
 */

import { useState, useCallback, useRef } from 'react';
import { Message } from '../types';

interface QueueItem {
  message: Message;
  retryCount: number;
}

export function useMessageQueue(maxRetries: number = 3) {
  const [messages, setMessages] = useState<Message[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
    
    if (message.status === 'sending') {
      queueRef.current.push({ message, retryCount: 0 });
    }
  }, []);
  
  const updateMessageStatus = useCallback((id: string, status: Message['status']) => {
    setMessages(prev => prev.map(m => 
      m.id === id ? { ...m, status } : m
    ));
  }, []);
  
  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    queueRef.current = queueRef.current.filter(item => item.message.id !== id);
  }, []);
  
  const retryMessage = useCallback((id: string) => {
    const item = queueRef.current.find(i => i.message.id === id);
    if (item && item.retryCount < maxRetries) {
      item.retryCount++;
      updateMessageStatus(id, 'sending');
      return true;
    }
    updateMessageStatus(id, 'failed');
    return false;
  }, [maxRetries, updateMessageStatus]);
  
  const clearQueue = useCallback(() => {
    queueRef.current = [];
  }, []);
  
  return {
    messages,
    addMessage,
    updateMessageStatus,
    removeMessage,
    retryMessage,
    clearQueue,
  };
}