/**
 * ✅ MESSAGE STATUS COMPONENT
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ChatTheme, MessageStatus as StatusType } from './types';

interface MessageStatusProps {
  status: StatusType;
  timestamp: number;
  isUser: boolean;
  theme: ChatTheme;
  onRetry?: () => void;
}

const formatTime = (ts: number): string => {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

const getStatusIcon = (status: StatusType): 'clock-outline' | 'check' | 'check-all' | 'alert-circle' => {
  switch (status) {
    case 'sending': return 'clock-outline';
    case 'sent': return 'check';
    case 'delivered': return 'check-all';
    case 'read': return 'check-all';
    case 'failed': return 'alert-circle';
    default: return 'check';
  }
};

const MessageStatus = memo(({ status, timestamp, isUser, theme, onRetry }: MessageStatusProps) => {
  const timeStr = useMemo(() => formatTime(timestamp), [timestamp]);
  
  return (
    <View style={styles.container}>
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

const styles = StyleSheet.create({
  container: {
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

export default MessageStatus;