/**
 * 👤 MESSAGE AVATAR COMPONENT
 */

import React, { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ChatTheme, ChatUser } from './types';

interface MessageAvatarProps {
  user: ChatUser;
  isUser?: boolean;
  size?: number;
  showOnline?: boolean;
  theme: ChatTheme;
}

const MessageAvatar = memo(({ 
  user, 
  isUser = false,
  size = 32, 
  showOnline = false,
  theme 
}: MessageAvatarProps) => {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: isUser ? theme.primaryColor : `${theme.primaryColor}15`,
  };
  
  return (
    <View style={[styles.container, containerStyle]}>
      {user.avatar ? (
        <Image 
          source={{ uri: user.avatar }} 
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} 
        />
      ) : (
        <MaterialCommunityIcons 
          name={isUser ? 'account' : 'robot-excited'} 
          size={size * 0.625} 
          color={isUser ? '#FFF' : theme.primaryColor} 
        />
      )}
      
      {showOnline && user.isOnline && (
        <View style={[styles.onlineDot, { borderColor: theme.backgroundColor }]} />
      )}
    </View>
  );
});

MessageAvatar.displayName = 'MessageAvatar';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
  },
});

export default MessageAvatar;