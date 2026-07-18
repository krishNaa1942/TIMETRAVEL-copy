/**
 * 📊 MESSAGE STATUS - EXAMPLE USAGE
 * =================================
 * Production-grade example integration
 * Shows how to use the MessageStatus system in a chat application
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView } from 'react-native';

// Import from the MessageStatus module
import {
  MessageStatus,
  MessageStatusType,
  StatusMetadata,
  ChatTheme,
  ReadReceipt,
  DeliveryReceipt,
  useMessageStatus,
  formatTime,
  isValidTransition,
  STATUS_PRIORITY,
} from './index';

// ─────────────────────────────────────────────────────────────
// EXAMPLE THEME CONFIGURATION
// ─────────────────────────────────────────────────────────────

const LIGHT_THEME: ChatTheme = {
  mode: 'light',
  userBubbleBackground: '#007AFF',
  userBubbleText: '#FFFFFF',
  userBubbleTimestamp: 'rgba(255, 255, 255, 0.7)',
  botBubbleBackground: '#F2F2F7',
  botBubbleText: '#000000',
  botBubbleTimestamp: 'rgba(0, 0, 0, 0.5)',
  botBubbleBorder: '#E5E5EA',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#FFFFFF',
  borderColor: '#E5E5EA',
  primaryColor: '#007AFF',
  errorColor: '#FF3B30',
  successColor: '#34C759',
  statusReadColor: '#007AFF',
  textPrimary: '#000000',
  textSecondary: '#8E8E93',
  textMuted: '#C7C7CC',
};

const DARK_THEME: ChatTheme = {
  mode: 'dark',
  userBubbleBackground: '#0A84FF',
  userBubbleText: '#FFFFFF',
  userBubbleTimestamp: 'rgba(255, 255, 255, 0.7)',
  botBubbleBackground: '#2C2C2E',
  botBubbleText: '#FFFFFF',
  botBubbleTimestamp: 'rgba(255, 255, 255, 0.5)',
  botBubbleBorder: '#3A3A3C',
  backgroundColor: '#000000',
  surfaceColor: '#1C1C1E',
  borderColor: '#3A3A3C',
  primaryColor: '#0A84FF',
  errorColor: '#FF453A',
  successColor: '#32D74B',
  statusReadColor: '#0A84FF',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textMuted: '#48484A',
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE MESSAGE TYPE
// ─────────────────────────────────────────────────────────────

interface ExampleMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  status: MessageStatusType;
  metadata?: StatusMetadata;
}

// ─────────────────────────────────────────────────────────────
// EXAMPLE 1: BASIC USAGE IN MESSAGE BUBBLE
// ─────────────────────────────────────────────────────────────

/**
 * Simple message bubble with status
 */
export const SimpleMessageBubble: React.FC<{
  message: ExampleMessage;
  theme: ChatTheme;
}> = ({ message, theme }) => {
  return (
    <View style={[
      styles.bubble,
      {
        backgroundColor: message.isUser
          ? theme.userBubbleBackground
          : theme.botBubbleBackground,
      }
    ]}>
      <Text style={{
        color: message.isUser ? theme.userBubbleText : theme.botBubbleText,
      }}>
        {message.text}
      </Text>
      
      {/* Status Component */}
      <MessageStatus
        status={message.status}
        timestamp={message.timestamp}
        isUser={message.isUser}
        theme={theme}
        metadata={message.metadata}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE 2: MESSAGE WITH RETRY FUNCTIONALITY
// ─────────────────────────────────────────────────────────────

/**
 * Message bubble with retry support for failed messages
 */
export const MessageBubbleWithRetry: React.FC<{
  message: ExampleMessage;
  theme: ChatTheme;
  onRetry: (messageId: string) => Promise<void>;
}> = ({ message, theme, onRetry }) => {
  const handleRetry = useCallback(async () => {
    await onRetry(message.id);
  }, [message.id, onRetry]);

  return (
    <View style={[
      styles.bubble,
      {
        backgroundColor: message.isUser
          ? theme.userBubbleBackground
          : theme.botBubbleBackground,
      }
    ]}>
      <Text style={{
        color: message.isUser ? theme.userBubbleText : theme.botBubbleText,
      }}>
        {message.text}
      </Text>
      
      <MessageStatus
        status={message.status}
        timestamp={message.timestamp}
        isUser={message.isUser}
        theme={theme}
        metadata={message.metadata}
        onRetry={handleRetry}
        retryConfig={{
          maxRetries: 3,
          initialDelayMs: 1000,
          debounceMs: 500,
        }}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE 3: GROUP CHAT MESSAGE
// ─────────────────────────────────────────────────────────────

/**
 * Message bubble for group chat with read receipts
 */
export const GroupChatMessage: React.FC<{
  message: ExampleMessage;
  theme: ChatTheme;
  totalParticipants: number;
}> = ({ message, theme, totalParticipants }) => {
  return (
    <View style={[
      styles.bubble,
      {
        backgroundColor: message.isUser
          ? theme.userBubbleBackground
          : theme.botBubbleBackground,
      }
    ]}>
      <Text style={{
        color: message.isUser ? theme.userBubbleText : theme.botBubbleText,
      }}>
        {message.text}
      </Text>
      
      <MessageStatus
        status={message.status}
        timestamp={message.timestamp}
        isUser={message.isUser}
        theme={theme}
        metadata={message.metadata}
        isGroupChat={true}
        totalParticipants={totalParticipants}
        groupDisplayConfig={{
          showReadAvatars: true,
          maxAvatarsToShow: 3,
          showDeliveredCount: true,
        }}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE 4: CUSTOM ICONS AND COLORS
// ─────────────────────────────────────────────────────────────

/**
 * Message with custom status icons and colors
 */
export const CustomStyledMessage: React.FC<{
  message: ExampleMessage;
  theme: ChatTheme;
}> = ({ message, theme }) => {
  return (
    <View style={[
      styles.bubble,
      {
        backgroundColor: message.isUser
          ? theme.userBubbleBackground
          : theme.botBubbleBackground,
      }
    ]}>
      <Text style={{
        color: message.isUser ? theme.userBubbleText : theme.botBubbleText,
      }}>
        {message.text}
      </Text>
      
      <MessageStatus
        status={message.status}
        timestamp={message.timestamp}
        isUser={message.isUser}
        theme={theme}
        metadata={message.metadata}
        customIcons={{
          read: {
            name: 'check-all',
            type: 'material',
            size: 16,
            animated: true,
          },
        }}
        customColors={{
          read: { primary: '#00D084' }, // WhatsApp green
          delivered: { primary: '#666666' },
        }}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE 5: MESSAGE WITH UPLOAD PROGRESS
// ─────────────────────────────────────────────────────────────

/**
 * Message with media upload progress
 */
export const MediaUploadMessage: React.FC<{
  message: ExampleMessage;
  theme: ChatTheme;
}> = ({ message, theme }) => {
  return (
    <View style={[
      styles.bubble,
      {
        backgroundColor: message.isUser
          ? theme.userBubbleBackground
          : theme.botBubbleBackground,
      }
    ]}>
      {/* Placeholder for media */}
      <View style={styles.mediaPlaceholder}>
        <Text style={{ color: theme.textSecondary }}>
          📷 Image
        </Text>
      </View>
      
      <Text style={{
        color: message.isUser ? theme.userBubbleText : theme.botBubbleText,
      }}>
        {message.text}
      </Text>
      
      <MessageStatus
        status={message.status}
        timestamp={message.timestamp}
        isUser={message.isUser}
        theme={theme}
        metadata={message.metadata}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE 6: USING THE HOOK DIRECTLY
// ─────────────────────────────────────────────────────────────

/**
 * Custom component using the hook directly for full control
 */
export const CustomStatusComponent: React.FC<{
  status: MessageStatusType;
  timestamp: number;
  theme: ChatTheme;
}> = ({ status, timestamp, theme }) => {
  const {
    icon,
    color,
    label,
    formattedTime,
    isPending,
    isError,
    animatedIconStyle,
  } = useMessageStatus({
    status,
    timestamp,
    isUser: true,
    theme,
    enableAnimations: true,
  });

  return (
    <View style={styles.customStatusContainer}>
      <Text style={[styles.timeText, { color: theme.textSecondary }]}>
        {formattedTime}
      </Text>
      <Text style={[styles.statusText, { color }]}>
        {label}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE 7: REAL-TIME STATUS UPDATES (WEBSOCKET)
// ─────────────────────────────────────────────────────────────

/**
 * Hook for managing real-time status updates from WebSocket
 */
export const useRealtimeStatus = (
  messageId: string,
  initialStatus: MessageStatusType,
  websocket: WebSocket | null
) => {
  const [status, setStatus] = useState<MessageStatusType>(initialStatus);
  const [metadata, setMetadata] = useState<StatusMetadata>({});

  useEffect(() => {
    if (!websocket) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.messageId !== messageId) return;

      switch (data.type) {
        case 'message_sent':
          if (isValidTransition(status, 'sent')) {
            setStatus('sent');
            setMetadata(prev => ({
              ...prev,
              sentAt: data.timestamp,
              serverMessageId: data.serverMessageId,
            }));
          }
          break;

        case 'message_delivered':
          if (isValidTransition(status, 'delivered')) {
            setStatus('delivered');
            setMetadata(prev => ({
              ...prev,
              deliveredAt: data.deliveredAt,
              deliveredTo: data.deliveredTo,
            }));
          }
          break;

        case 'message_read':
          if (isValidTransition(status, 'read')) {
            setStatus('read');
            setMetadata(prev => ({
              ...prev,
              readAt: data.readAt,
              readBy: data.readBy,
            }));
          }
          break;

        case 'message_failed':
          setStatus('failed');
          setMetadata(prev => ({
            ...prev,
            failedAt: Date.now(),
            errorCode: data.error.code,
            errorMessage: data.error.message,
          }));
          break;
      }
    };

    // Note: This is a simplified example
    // In production, you'd use a proper WebSocket event handler
    
    return () => {
      // Cleanup
    };
  }, [messageId, status, websocket]);

  return { status, metadata, setStatus, setMetadata };
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE 8: OFFLINE QUEUE INTEGRATION
// ─────────────────────────────────────────────────────────────

/**
 * Hook for offline message handling
 */
export const useOfflineStatus = (
  messageId: string,
  sendFunction: () => Promise<void>
) => {
  const [status, setStatus] = useState<MessageStatusType>('queued');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Listen to network state
    const unsubscribe = () => {
      // In production, use @react-native-community/netinfo
    };

    return unsubscribe;
  }, []);

  const sendWhenOnline = useCallback(async () => {
    if (!isOnline) {
      setStatus('queued');
      return;
    }

    try {
      setStatus('sending');
      await sendFunction();
      setStatus('sent');
    } catch (error) {
      setStatus('failed');
    }
  }, [isOnline, sendFunction]);

  useEffect(() => {
    if (isOnline && status === 'queued') {
      sendWhenOnline();
    }
  }, [isOnline, status, sendWhenOnline]);

  return { status, isOnline, retry: sendWhenOnline };
};

// ─────────────────────────────────────────────────────────────
// EXAMPLE 9: COMPLETE CHAT SCREEN
// ─────────────────────────────────────────────────────────────

/**
 * Complete example chat screen with all features
 */
export const ExampleChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<ExampleMessage[]>([
    {
      id: '1',
      text: 'Hello! How are you?',
      isUser: true,
      timestamp: Date.now() - 60000,
      status: 'read',
      metadata: {
        readBy: [
          { userId: 'user2', userName: 'John', readAt: Date.now() - 30000 },
        ],
      },
    },
    {
      id: '2',
      text: 'I am doing great, thanks!',
      isUser: false,
      timestamp: Date.now() - 30000,
      status: 'delivered',
    },
    {
      id: '3',
      text: 'This message is sending...',
      isUser: true,
      timestamp: Date.now() - 5000,
      status: 'sending',
    },
    {
      id: '4',
      text: 'This message failed to send',
      isUser: true,
      timestamp: Date.now() - 10000,
      status: 'failed',
      metadata: {
        errorMessage: 'Network error',
        retryCount: 2,
      },
    },
  ]);

  const [theme] = useState<ChatTheme>(LIGHT_THEME);

  const handleRetry = useCallback(async (messageId: string) => {
    // Update status to sending
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, status: 'sending' as MessageStatusType }
        : msg
    ));

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update status to sent
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: 'sent' as MessageStatusType }
          : msg
      ));
    } catch (error) {
      // Update status to failed
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              status: 'failed' as MessageStatusType,
              metadata: {
                ...msg.metadata,
                errorMessage: 'Failed to send',
                retryCount: (msg.metadata?.retryCount ?? 0) + 1,
              },
            }
          : msg
      ));
    }
  }, []);

  const renderMessage = useCallback(({ item }: { item: ExampleMessage }) => (
    <View style={[
      styles.messageRow,
      item.isUser ? styles.userMessageRow : styles.botMessageRow,
    ]}>
      <MessageBubbleWithRetry
        message={item}
        theme={theme}
        onRetry={handleRetry}
      />
    </View>
  ), [theme, handleRetry]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
      />
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    padding: 16,
  },
  messageRow: {
    marginBottom: 8,
    maxWidth: '80%',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
  },
  botMessageRow: {
    alignSelf: 'flex-start',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '100%',
  },
  mediaPlaceholder: {
    width: 200,
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  customStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 11,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default ExampleChatScreen;