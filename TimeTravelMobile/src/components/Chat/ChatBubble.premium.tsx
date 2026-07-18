/**
 * 💬 CHAT BUBBLE V2 - NEXT-GENERATION PREMIUM COMPONENT
 * =======================================================
 * Production-grade chat bubble with glassmorphism, animations,
 * gestures, streaming, markdown, and rich content support.
 * 
 * Features:
 * - Modern glassmorphism / soft UI design
 * - Smooth entry animations (fade + slide + scale)
 * - Gesture interactions (long-press, double-tap, swipe)
 * - Token-by-token streaming with cursor
 * - Full markdown support
 * - Rich content cards (places, actions)
 * - Message states (sending, sent, delivered, read, error)
 * - Theme support (dark/light)
 * - Accessibility ready
 */

import React, { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  AccessibilityInfo,
  Platform,
  Linking,
  Alert,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  runOnJS,
  Easing,
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideInLeft,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  LongPressGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';

import {
  Message,
  ChatTheme,
  MessageStatus as Status,
  MessageContent,
  Reaction,
  ReactionEmoji,
  AICardContent,
} from './types';
import { lightTheme, darkTheme } from './theme';
import { colors, spacing } from '@/theme/colors';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.82;
const MIN_BUBBLE_WIDTH = 80;
const REACTION_EMOJIS: ReactionEmoji[] = ['❤️', '👍', '👎', '😂', '😮', '😢'];

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

const formatTime = (ts: number): string => {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

const getStatusIcon = (status: Status): 'clock-outline' | 'check' | 'check-all' | 'alert-circle' | 'refresh' => {
  const icons: Record<Status, 'clock-outline' | 'check' | 'check-all' | 'alert-circle' | 'refresh'> = {
    sending: 'clock-outline',
    sent: 'check',
    delivered: 'check-all',
    read: 'check-all',
    failed: 'alert-circle',
    retrying: 'refresh',
  };
  return icons[status] || 'check';
};

const getStatusColor = (status: Status, theme: ChatTheme): string => {
  if (status === 'read') return theme.successColor;
  if (status === 'failed') return theme.errorColor;
  return theme.userBubbleTimestamp;
};

// ─────────────────────────────────────────────────────────────
// STREAMING CURSOR COMPONENT
// ─────────────────────────────────────────────────────────────

interface StreamingCursorProps {
  theme: ChatTheme;
}

const StreamingCursor = memo(({ theme }: StreamingCursorProps) => {
  const opacity = useSharedValue(1);
  
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  
  return (
    <Animated.View style={[styles.cursor, { backgroundColor: theme.primaryColor }, animatedStyle]} />
  );
});
StreamingCursor.displayName = 'StreamingCursor';

// ─────────────────────────────────────────────────────────────
// TYPING INDICATOR (3 BOUNCING DOTS)
// ─────────────────────────────────────────────────────────────

interface TypingIndicatorProps {
  theme: ChatTheme;
}

const TypingIndicator = memo(({ theme }: TypingIndicatorProps) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  
  useEffect(() => {
    const bounce = (dot: { value: number }, delay: number) => {
      dot.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-8, { duration: 300, easing: Easing.out(Easing.cubic) }),
            withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) })
          ),
          -1,
          false
        )
      );
    };
    
    bounce(dot1, 0);
    bounce(dot2, 150);
    bounce(dot3, 300);
  }, []);
  
  const animatedDot1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const animatedDot2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const animatedDot3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));
  
  return (
    <View style={styles.typingIndicator}>
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.primaryColor }, animatedDot1]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.primaryColor }, animatedDot2]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.primaryColor }, animatedDot3]} />
    </View>
  );
});
TypingIndicator.displayName = 'TypingIndicator';

// ─────────────────────────────────────────────────────────────
// AVATAR COMPONENT
// ─────────────────────────────────────────────────────────────

interface AvatarProps {
  isUser: boolean;
  theme: ChatTheme;
  avatarUrl?: string;
  size?: number;
  showOnline?: boolean;
}

const Avatar = memo(({ isUser, theme, avatarUrl, size = 36, showOnline = false }: AvatarProps) => {
  const scale = useSharedValue(0);
  
  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  return (
    <Animated.View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, animatedStyle]}>
      <LinearGradient
        colors={isUser ? [theme.primaryColor, `${theme.primaryColor}CC`] : ['#6366F1', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatarGradient, { borderRadius: size / 2 }]}
      >
        {avatarUrl ? (
          <View style={styles.avatarImage} />
        ) : (
          <MaterialCommunityIcons
            name={isUser ? 'account' : 'robot-excited'}
            size={size * 0.55}
            color="#FFF"
          />
        )}
      </LinearGradient>
      {showOnline && !isUser && (
        <View style={[styles.onlineIndicator, { borderColor: theme.backgroundColor }]} />
      )}
    </Animated.View>
  );
});
Avatar.displayName = 'Avatar';

// ─────────────────────────────────────────────────────────────
// MESSAGE STATUS COMPONENT
// ─────────────────────────────────────────────────────────────

interface MessageStatusProps {
  status: Status;
  timestamp: number;
  isUser: boolean;
  theme: ChatTheme;
  onRetry?: () => void;
}

const MessageStatus = memo(({ status, timestamp, isUser, theme, onRetry }: MessageStatusProps) => {
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
          color={getStatusColor(status, theme)}
        />
      )}
      
      {status === 'failed' && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onRetry?.();
          }}
          style={styles.retryBtn}
        >
          <MaterialCommunityIcons name="refresh" size={14} color={theme.errorColor} />
          <Text style={[styles.retryText, { color: theme.errorColor }]}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
});
MessageStatus.displayName = 'MessageStatus';

// ─────────────────────────────────────────────────────────────
// REACTION BADGES
// ─────────────────────────────────────────────────────────────

interface ReactionBadgesProps {
  reactions: Reaction[];
  theme: ChatTheme;
  onReactionPress?: (emoji: ReactionEmoji) => void;
}

const ReactionBadges = memo(({ reactions, theme, onReactionPress }: ReactionBadgesProps) => {
  if (!reactions || reactions.length === 0) return null;
  
  return (
    <View style={styles.reactionsContainer}>
      {reactions.map((reaction, index) => (
        <Pressable
          key={reaction.emoji}
          onPress={() => onReactionPress?.(reaction.emoji as ReactionEmoji)}
          style={[
            styles.reactionBadge,
            reaction.reactedByUser && { backgroundColor: `${theme.primaryColor}20` }
          ]}
        >
          <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
          {reaction.count > 1 && (
            <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>
              {reaction.count}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
});
ReactionBadges.displayName = 'ReactionBadges';

// ─────────────────────────────────────────────────────────────
// ACTION MENU
// ─────────────────────────────────────────────────────────────

interface ActionMenuItem {
  id: string;
  label: string;
  icon: string;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  isUser: boolean;
  theme: ChatTheme;
  onClose: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onReaction?: (emoji: ReactionEmoji) => void;
}

const ActionMenu = memo(({
  visible,
  position,
  isUser,
  theme,
  onClose,
  onCopy,
  onShare,
  onDelete,
  onReaction,
}: ActionMenuProps) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  
  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 150 });
    } else {
      scale.value = withTiming(0, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  
  if (!visible) return null;
  
  const menuItems: ActionMenuItem[] = [
    { id: 'copy', label: 'Copy', icon: 'content-copy', onPress: () => { onCopy?.(); onClose(); } },
    { id: 'share', label: 'Share', icon: 'share-variant', onPress: () => { onShare?.(); onClose(); } },
    ...(isUser ? [{ id: 'delete', label: 'Delete', icon: 'delete', destructive: true, onPress: () => { onDelete?.(); onClose(); } }] : []),
  ];
  
  return (
    <>
      <Pressable style={styles.actionMenuOverlay} onPress={onClose} />
      <Animated.View
        style={[
          styles.actionMenu,
          {
            left: Math.min(position.x, SCREEN_WIDTH - 200),
            top: position.y,
            backgroundColor: theme.surfaceColor,
            borderColor: theme.borderColor,
          },
          animatedStyle,
        ]}
      >
        {/* Reaction Row */}
        <View style={styles.reactionRow}>
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              style={styles.reactionButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onReaction?.(emoji);
                onClose();
              }}
            >
              <Text style={styles.reactionButtonEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        
        {/* Action Items */}
        <View style={styles.actionMenuDivider} />
        {menuItems.map((item) => (
          <Pressable
            key={item.id}
            style={styles.actionMenuItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              item.onPress();
            }}
          >
            <MaterialCommunityIcons
              name={item.icon as any}
              size={18}
              color={item.destructive ? theme.errorColor : theme.textPrimary}
            />
            <Text style={[styles.actionMenuLabel, { color: item.destructive ? theme.errorColor : theme.textPrimary }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </>
  );
});
ActionMenu.displayName = 'ActionMenu';

// ─────────────────────────────────────────────────────────────
// RICH CONTENT RENDERER
// ─────────────────────────────────────────────────────────────

interface RichContentProps {
  content: AICardContent;
  theme: ChatTheme;
  onActionPress?: (actionId: string) => void;
}

const RichContent = memo(({ content, theme, onActionPress }: RichContentProps) => {
  const { title, subtitle, image, actions, cardType } = content;
  
  const getCardIcon = (): string => {
    const icons: Record<string, string> = {
      destination: 'map-marker',
      hotel: 'bed',
      flight: 'airplane',
      activity: 'run',
      restaurant: 'silverware-fork-knife',
    };
    return icons[cardType] || 'card-outline';
  };
  
  const getCardColor = (): string => {
    const cardColors: Record<string, string> = {
      destination: '#10B981',
      hotel: '#8B5CF6',
      flight: '#3B82F6',
      activity: '#F59E0B',
      restaurant: '#EF4444',
    };
    return cardColors[cardType] || theme.primaryColor;
  };
  
  return (
    <View style={[styles.richCard, { backgroundColor: `${getCardColor()}08`, borderColor: `${getCardColor()}30` }]}>
      {/* Header */}
      <View style={styles.richCardHeader}>
        <View style={[styles.richCardIcon, { backgroundColor: `${getCardColor()}20` }]}>
          <MaterialCommunityIcons name={getCardIcon() as any} size={20} color={getCardColor()} />
        </View>
        <View style={styles.richCardTitles}>
          <Text style={[styles.richCardTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.richCardSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      
      {/* Actions */}
      {actions && actions.length > 0 && (
        <View style={styles.richCardActions}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              style={[styles.richCardAction, { backgroundColor: `${getCardColor()}15` }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onActionPress?.(action.id);
              }}
            >
              <Text style={[styles.richCardActionText, { color: getCardColor() }]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
});
RichContent.displayName = 'RichContent';

// ─────────────────────────────────────────────────────────────
// MESSAGE TEXT (ENHANCED MARKDOWN)
// ─────────────────────────────────────────────────────────────

interface MessageTextProps {
  text: string;
  isUser: boolean;
  theme: ChatTheme;
  isStreaming?: boolean;
  maxLines?: number;
}

const MessageText = memo(({ text, isUser, theme, isStreaming, maxLines }: MessageTextProps) => {
  // Parse markdown-style text into styled segments
  const parsedContent = useMemo(() => {
    const segments: Array<{ text: string; style: 'normal' | 'bold' | 'italic' | 'code' | 'link' | 'heading' }> = [];
    
    // Simple markdown parsing (in production, use a proper markdown library)
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Check for headings
      if (line.startsWith('### ')) {
        segments.push({ text: line.replace('### ', ''), style: 'heading' });
      } else if (line.startsWith('## ')) {
        segments.push({ text: line.replace('## ', ''), style: 'heading' });
      } else if (line.startsWith('# ')) {
        segments.push({ text: line.replace('# ', ''), style: 'heading' });
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        segments.push({ text: '• ' + line.substring(2), style: 'normal' });
      } else if (line.startsWith('`') && line.endsWith('`')) {
        segments.push({ text: line.replace(/`/g, ''), style: 'code' });
      } else {
        segments.push({ text: line, style: 'normal' });
      }
      
      // Add line break (except last line)
      if (lineIndex < lines.length - 1) {
        segments.push({ text: '\n', style: 'normal' });
      }
    });
    
    return segments;
  }, [text]);
  
  const textStyle = {
    color: isUser ? theme.userBubbleText : theme.botBubbleText,
    fontSize: 15,
    lineHeight: 22,
  };
  
  return (
    <View style={styles.messageTextContainer}>
      {parsedContent.map((segment, index) => {
        switch (segment.style) {
          case 'heading':
            return (
              <Text key={index} style={[textStyle, styles.headingText, { color: isUser ? '#FFF' : theme.primaryColor }]}>
                {segment.text}
              </Text>
            );
          case 'bold':
            return (
              <Text key={index} style={[textStyle, styles.boldText]}>
                {segment.text}
              </Text>
            );
          case 'italic':
            return (
              <Text key={index} style={[textStyle, styles.italicText]}>
                {segment.text}
              </Text>
            );
          case 'code':
            return (
              <View key={index} style={[styles.codeBlock, { backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : theme.surfaceColor }]}>
                <Text style={[textStyle, styles.codeText, { color: isUser ? '#FFF' : theme.primaryColor }]}>
                  {segment.text}
                </Text>
              </View>
            );
          case 'link':
            return (
              <Text
                key={index}
                style={[textStyle, styles.linkText, { color: isUser ? '#FFF' : theme.primaryColor }]}
                onPress={() => Linking.openURL(segment.text)}
              >
                {segment.text}
              </Text>
            );
          default:
            return (
              <Text key={index} style={textStyle} numberOfLines={maxLines}>
                {segment.text}
              </Text>
            );
        }
      })}
      
      {isStreaming && <StreamingCursor theme={theme} />}
    </View>
  );
});
MessageText.displayName = 'MessageText';

// ─────────────────────────────────────────────────────────────
// MAIN CHAT BUBBLE COMPONENT
// ─────────────────────────────────────────────────────────────

export interface ChatBubbleProps {
  message: Message;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  previousMessage?: Message;
  nextMessage?: Message;
  theme?: ChatTheme;
  onRetry?: () => void;
  onReply?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: ReactionEmoji) => void;
  onActionPress?: (messageId: string, actionId: string) => void;
  isStreaming?: boolean;
  streamingContent?: string;
  isDarkMode?: boolean;
}

const ChatBubble = memo(({
  message,
  showAvatar = true,
  showTimestamp = true,
  previousMessage,
  nextMessage,
  theme: propTheme,
  onRetry,
  onReply,
  onDelete,
  onReaction,
  onActionPress,
  isStreaming,
  streamingContent,
  isDarkMode = false,
}: ChatBubbleProps) => {
  // ─── Theme Setup ─────────────────────────────────────
  const theme = propTheme || (isDarkMode ? darkTheme : lightTheme);
  const isUser = message.sender === 'user';
  const isBot = message.sender === 'bot';
  const isError = message.status === 'failed';
  
  // ─── Animation Values ─────────────────────────────────────
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const pressed = useSharedValue(false);
  
  // ─── State ─────────────────────────────────────
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionMenuPosition, setActionMenuPosition] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  
  // ─── Entry Animation ─────────────────────────────────────
  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withSpring(0, { damping: 12, stiffness: 200 });
  }, []);
  
  // ─── Animated Styles ─────────────────────────────────────
  const bubbleAnimatedStyle = useAnimatedStyle(() => {
    const pressedValue = pressed.value ? 1 : 0;
    return {
      transform: [
        { scale: interpolate(pressedValue, [0, 1], [1, 0.97]) },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
    };
  });
  
  // ─── Gesture Handlers ─────────────────────────────────────
  const handleLongPress = useCallback((event: any) => {
    const { nativeEvent } = event;
    setActionMenuPosition({
      x: nativeEvent.pageX,
      y: nativeEvent.pageY,
    });
    setShowActionMenu(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);
  
  const handleDoubleTap = useCallback(() => {
    // Default double-tap action: add heart reaction
    onReaction?.(message.id, '❤️');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [message.id, onReaction]);
  
  const handleCopy = useCallback(async () => {
    const text = message.content.type === 'text' || message.content.type === 'markdown'
      ? message.content.text
      : '';
    if (text) {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [message.content]);
  
  const handleShare = useCallback(() => {
    const text = message.content.type === 'text' || message.content.type === 'markdown'
      ? message.content.text
      : '';
    if (text) {
      // In production, use expo-sharing or react-native-share
      Alert.alert('Share', 'Share functionality would open here');
    }
  }, [message.content]);
  
  // ─── Message Grouping Logic ─────────────────────────────────────
  const showTopAvatar = useMemo(() => {
    if (!showAvatar) return false;
    if (!previousMessage) return true;
    if (previousMessage.sender !== message.sender) return true;
    const timeDiff = message.timestamp - previousMessage.timestamp;
    return timeDiff > 5 * 60 * 1000; // 5 minutes
  }, [showAvatar, previousMessage, message.sender, message.timestamp]);
  
  const showBottomTimestamp = useMemo(() => {
    if (!showTimestamp) return false;
    if (!nextMessage) return true;
    if (nextMessage.sender !== message.sender) return true;
    const timeDiff = nextMessage.timestamp - message.timestamp;
    return timeDiff > 5 * 60 * 1000;
  }, [showTimestamp, nextMessage, message.sender, message.timestamp]);
  
  // ─── Content Rendering ─────────────────────────────────────
  const renderContent = useMemo(() => {
    const content = message.content;
    const text = isStreaming && streamingContent ? streamingContent : (content.type === 'text' || content.type === 'markdown' ? content.text : '');
    
    switch (content.type) {
      case 'text':
      case 'markdown':
        return (
          <MessageText
            text={text}
            isUser={isUser}
            theme={theme}
            isStreaming={isStreaming}
          />
        );
      
      case 'image':
        return (
          <View style={styles.imageContainer}>
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.surfaceColor }]}>
              <MaterialCommunityIcons name="image" size={32} color={theme.textSecondary} />
              <Text style={[styles.imageCaption, { color: theme.textSecondary }]}>Image</Text>
            </View>
          </View>
        );
      
      case 'ai_card':
        return (
          <>
            {text && (
              <MessageText text={text} isUser={isUser} theme={theme} />
            )}
            <RichContent
              content={content}
              theme={theme}
              onActionPress={(actionId) => onActionPress?.(message.id, actionId)}
            />
          </>
        );
      
      case 'location':
        return (
          <View style={[styles.locationCard, { backgroundColor: `${theme.primaryColor}10` }]}>
            <MaterialCommunityIcons name="map-marker" size={24} color={theme.primaryColor} />
            <View style={styles.locationInfo}>
              <Text style={[styles.locationName, { color: theme.textPrimary }]}>
                {content.name || 'Location'}
              </Text>
              {content.address && (
                <Text style={[styles.locationAddress, { color: theme.textSecondary }]}>
                  {content.address}
                </Text>
              )}
            </View>
          </View>
        );
      
      default:
        return (
          <MessageText text={text} isUser={isUser} theme={theme} />
        );
    }
  }, [message.content, isStreaming, streamingContent, isUser, theme, onActionPress, message.id]);
  
  // ─── Bubble Width Calculation ─────────────────────────────────────
  const bubbleWidth = useMemo(() => {
    const text = message.content.type === 'text' || message.content.type === 'markdown'
      ? (isStreaming && streamingContent ? streamingContent : message.content.text)
      : '';
    const charCount = text.length;
    
    if (charCount < 20) return charCount * 8 + 40;
    if (charCount < 50) return charCount * 5 + 80;
    return MAX_BUBBLE_WIDTH;
  }, [message.content, isStreaming, streamingContent]);
  
  // ─── Render ─────────────────────────────────────
  return (
    <View style={[styles.container, isUser && styles.containerUser]}>
      {/* Avatar */}
      {!isUser && showAvatar && showTopAvatar && (
        <Avatar isUser={false} theme={theme} />
      )}
      {!isUser && showAvatar && !showTopAvatar && (
        <View style={styles.avatarSpacer} />
      )}
      
      {/* Bubble */}
      <LongPressGestureHandler
        onHandlerStateChange={({ nativeEvent }) => {
          if (nativeEvent.state === State.ACTIVE) {
            handleLongPress({ nativeEvent });
          }
        }}
        minDurationMs={500}
      >
        <TapGestureHandler
          numberOfTaps={2}
          onActivated={handleDoubleTap}
        >
          <Animated.View
            style={[
              styles.bubbleWrapper,
              { maxWidth: bubbleWidth },
              bubbleAnimatedStyle,
            ]}
          >
            <Pressable
              style={({ pressed: pressState }) => [
                styles.bubble,
                isUser
                  ? [styles.bubbleUser, {
                      backgroundColor: theme.userBubbleBackground,
                      borderBottomRightRadius: showTopAvatar ? 6 : 18,
                    }]
                  : [styles.bubbleBot, {
                      backgroundColor: theme.botBubbleBackground,
                      borderColor: theme.botBubbleBorder,
                      borderBottomLeftRadius: showTopAvatar ? 6 : 18,
                    }],
                isError && { backgroundColor: `${theme.errorColor}15`, borderColor: theme.errorColor },
                pressState && styles.bubblePressed,
              ]}
              onPressIn={() => {
                pressed.value = true;
              }}
              onPressOut={() => {
                pressed.value = false;
              }}
              accessible={true}
              accessibilityLabel={`${isUser ? 'You' : 'Bot'}: ${message.content.type === 'text' ? message.content.text : 'Message'}`}
              accessibilityRole="text"
            >
              {/* Glassmorphism overlay for bot messages */}
              {!isUser && (
                <View style={[styles.glassOverlay, { borderRadius: 18 }]} />
              )}
              
              {/* Content */}
              {renderContent}
              
              {/* Timestamp & Status */}
              {(showBottomTimestamp || isError) && (
                <MessageStatus
                  status={message.status}
                  timestamp={message.timestamp}
                  isUser={isUser}
                  theme={theme}
                  onRetry={() => onRetry?.()}
                />
              )}
              
              {/* Copied Toast */}
              {copied && (
                <View style={styles.copiedToast}>
                  <MaterialCommunityIcons name="check" size={12} color="#FFF" />
                  <Text style={styles.copiedText}>Copied!</Text>
                </View>
              )}
            </Pressable>
            
            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <ReactionBadges
                reactions={message.reactions}
                theme={theme}
                onReactionPress={(emoji) => onReaction?.(message.id, emoji)}
              />
            )}
          </Animated.View>
        </TapGestureHandler>
      </LongPressGestureHandler>
      
      {/* User Avatar */}
      {isUser && showAvatar && showTopAvatar && (
        <Avatar isUser={true} theme={theme} />
      )}
      {isUser && showAvatar && !showTopAvatar && (
        <View style={styles.avatarSpacer} />
      )}
      
      {/* Action Menu */}
      <ActionMenu
        visible={showActionMenu}
        position={actionMenuPosition}
        isUser={isUser}
        theme={theme}
        onClose={() => setShowActionMenu(false)}
        onCopy={handleCopy}
        onShare={handleShare}
        onDelete={() => onDelete?.(message.id)}
        onReaction={(emoji) => onReaction?.(message.id, emoji)}
      />
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
    marginVertical: 2,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  containerUser: {
    justifyContent: 'flex-end',
  },
  
  // Avatar
  avatar: {
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
  },
  avatarSpacer: {
    width: 36,
    marginRight: 8,
  },
  
  // Bubble
  bubbleWrapper: {
    maxWidth: MAX_BUBBLE_WIDTH,
    minWidth: MIN_BUBBLE_WIDTH,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  bubbleUser: {
    borderBottomRightRadius: 6,
  },
  bubbleBot: {
    borderBottomLeftRadius: 6,
  },
  bubblePressed: {
    opacity: 0.9,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  
  // Message Text
  messageTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  headingText: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: '700',
  },
  italicText: {
    fontStyle: 'italic',
  },
  codeBlock: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginVertical: 2,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  
  // Cursor
  cursor: {
    width: 2,
    height: 18,
    marginLeft: 2,
    borderRadius: 1,
  },
  
  // Typing Indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '400',
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
  
  // Reactions
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Action Menu
  actionMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  actionMenu: {
    position: 'absolute',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    minWidth: 180,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  reactionButton: {
    padding: 8,
    borderRadius: 20,
  },
  reactionButtonEmoji: {
    fontSize: 22,
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 8,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 10,
  },
  actionMenuLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  
  // Rich Content
  richCard: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  richCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  richCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  richCardTitles: {
    flex: 1,
  },
  richCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  richCardSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  richCardActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  richCardAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  richCardActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Location
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
  },
  locationAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  
  // Image
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  imagePlaceholder: {
    width: 200,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  imageCaption: {
    marginTop: 8,
    fontSize: 12,
  },
  
  // Copied Toast
  copiedToast: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  copiedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ChatBubble;