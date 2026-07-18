/**
 * 🎯 MESSAGE ACTIONS COMPONENT
 * Swipe gestures and long-press actions
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ChatTheme, Message } from './types';

interface MessageActionsProps {
  message: Message;
  theme: ChatTheme;
  onCopy?: () => void;
  onReply?: () => void;
  onDelete?: () => void;
  onForward?: () => void;
}

interface Action {
  icon: 'content-copy' | 'reply' | 'delete' | 'share';
  label: string;
  onPress: () => void;
  color: string;
}

const MessageActions = memo(({ 
  message, 
  theme, 
  onCopy, 
  onReply, 
  onDelete,
  onForward 
}: MessageActionsProps) => {
  const [visible, setVisible] = useState(false);
  
  const actions: Action[] = [
    { icon: 'content-copy' as const, label: 'Copy', onPress: onCopy || (() => {}), color: theme.textSecondary },
    { icon: 'reply' as const, label: 'Reply', onPress: onReply || (() => {}), color: theme.primaryColor },
    { icon: 'share' as const, label: 'Forward', onPress: onForward || (() => {}), color: theme.textSecondary },
    { icon: 'delete' as const, label: 'Delete', onPress: onDelete || (() => {}), color: theme.errorColor },
  ].filter((_, i) => message.sender === 'user' || i < 3); // User sees all, bot can't delete
  
  const toggleActions = useCallback(() => {
    setVisible(v => !v);
  }, []);
  
  if (!visible) return null;
  
  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceColor }]}>
      {actions.map((action, index) => (
        <Pressable 
          key={action.label}
          onPress={() => { action.onPress(); setVisible(false); }}
          style={[styles.action, index < actions.length - 1 && styles.actionBorder, { borderColor: theme.borderColor }]}
        >
          <MaterialCommunityIcons name={action.icon} size={20} color={action.color} />
          <Text style={[styles.label, { color: action.color }]}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
});

MessageActions.displayName = 'MessageActions';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  actionBorder: {
    borderRightWidth: 1,
  },
  label: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default MessageActions;