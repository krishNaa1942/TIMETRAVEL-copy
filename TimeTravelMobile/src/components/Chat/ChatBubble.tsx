/**
 * 💬 CHAT BUBBLE - PRODUCTION COMPONENT
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Message, ChatTheme, MessageStatus as Status } from './types';
import MessageText from './MessageText';
import { lightTheme } from './theme';
import { colors } from '@/theme/colors';

// ─────────────────────────────────────────────────────────────
// TIME FORMATTER
// ─────────────────────────────────────────────────────────────

const formatTime = (ts: number): string => {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

const getStatusIcon = (status: Status): 'clock-outline' | 'check' | 'check-all' | 'alert-circle' => {
  switch (status) {
    case 'sending': return 'clock-outline';
    case 'sent': return 'check';
    case 'delivered': return 'check-all';
    case 'read': return 'check-all';
    case 'failed': return 'alert-circle';
    default: return 'check';
  }
};

// ─────────────────────────────────────────────────────────────
// AVATAR COMPONENT
// ─────────────────────────────────────────────────────────────

interface AvatarProps {
  isUser: boolean;
  theme: ChatTheme;
}

const Avatar = memo(({ isUser, theme }: AvatarProps) => (
  <View style={[styles.avatar, isUser && styles.avatarUser, { backgroundColor: isUser ? theme.primaryColor : `${theme.primaryColor}15` }]}>
    <MaterialCommunityIcons 
      name={isUser ? 'account' : 'robot-excited'} 
      size={20} 
      color={isUser ? '#FFF' : theme.primaryColor} 
    />
  </View>
));

Avatar.displayName = 'Avatar';

// ─────────────────────────────────────────────────────────────
// STATUS COMPONENT
// ─────────────────────────────────────────────────────────────

interface StatusProps {
  status: Status;
  timestamp: number;
  isUser: boolean;
  theme: ChatTheme;
  onRetry?: () => void;
}

const MessageStatus = memo(({ status, timestamp, isUser, theme, onRetry }: StatusProps) => {
  const timeStr = useMemo(() => formatTime(timestamp), [timestamp]);
  
  return (
    <View style={styles.footer}>
      <Text style={[styles.timestamp, isUser ? { color: theme.userBubbleTimestamp } : { color: theme.botBubbleTimestamp }]}>
        {timeStr}
      </Text>
      
      {isUser && status !== 'failed' && (
        <MaterialCommunityIcons 
          name={getStatusIcon(status)} 
          size={14} 
          color={status === 'read' ? theme.successColor : theme.userBubbleTimestamp}
        />
      )}
      
      {status === 'failed' && onRetry && (
        <Pressable onPress={onRetry} style={styles.retryBtn}>
          <MaterialCommunityIcons name="refresh" size={14} color={theme.errorColor} />
          <Text style={[styles.retryText, { color: theme.errorColor }]}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
});

MessageStatus.displayName = 'MessageStatus';

// ─────────────────────────────────────────────────────────────
// MAIN CHAT BUBBLE
// ─────────────────────────────────────────────────────────────

interface ChatBubbleProps {
  message: Message;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  theme?: ChatTheme;
  onRetry?: () => void;
  isStreaming?: boolean;
  streamingContent?: string;
}

const ChatBubble = memo(({
  message,
  showAvatar = true,
  showTimestamp = true,
  theme = lightTheme,
  onRetry,
  isStreaming,
  streamingContent,
}: ChatBubbleProps) => {
  const isUser = message.sender === 'user';
  const isError = message.status === 'failed';
  
  const bubbleStyle = useMemo(() => [
    styles.bubble,
    isUser ? { backgroundColor: theme.userBubbleBackground } : { backgroundColor: theme.botBubbleBackground, borderColor: theme.botBubbleBorder },
    isError && { backgroundColor: `${theme.errorColor}10`, borderColor: theme.errorColor },
    isUser ? styles.bubbleUser : styles.bubbleBot,
  ], [isUser, isError, theme]);
  
  return (
    <View style={[styles.container, isUser && styles.containerUser]}>
      {!isUser && showAvatar && <Avatar isUser={false} theme={theme} />}
      
      <View style={bubbleStyle}>
        <MessageText 
          content={message.content}
          isUser={isUser}
          theme={theme}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
        />
        
        {showTimestamp && (
          <MessageStatus 
            status={message.status}
            timestamp={message.timestamp}
            isUser={isUser}
            theme={theme}
            onRetry={onRetry}
          />
        )}
      </View>
      
      {isUser && showAvatar && <Avatar isUser={true} theme={theme} />}
    </View>
  );
});

ChatBubble.displayName = 'ChatBubble';

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  containerUser: {
    justifyContent: 'flex-end',
  },
  
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarUser: {
    marginRight: 0,
    marginLeft: 8,
  },
  
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bubbleUser: {
    borderBottomRightRadius: 6,
  },
  bubbleBot: {
    borderBottomLeftRadius: 6,
  },
  
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ChatBubble;