/**
 * 📊 MESSAGE STATUS COMPONENT
 * ===========================
 * Production-grade message status component
 * WhatsApp/Telegram/iMessage level features
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useMessageStatus } from './useMessageStatus';
import {
  MessageStatusType,
  StatusMetadata,
  ChatTheme,
  TimeDisplayFormat,
  GroupStatusSummary,
  GroupStatusDisplay,
  RetryConfig,
  StatusIconConfig,
  DEFAULT_GROUP_DISPLAY_CONFIG,
} from './types';
import { getGroupStatusText, getTopReadByUsers } from './statusUtils';

// ─────────────────────────────────────────────────────────────
// COMPONENT PROPS
// ─────────────────────────────────────────────────────────────

export interface MessageStatusProps {
  // Core props
  status: MessageStatusType;
  timestamp: number;
  isUser: boolean;
  theme: ChatTheme;

  // Optional metadata
  metadata?: StatusMetadata;

  // Group chat props
  isGroupChat?: boolean;
  totalParticipants?: number;
  groupDisplayConfig?: Partial<GroupStatusDisplay>;

  // Time display
  timeFormat?: TimeDisplayFormat;
  locale?: string;
  hideTime?: boolean;
  showRelativeTime?: boolean;

  // Retry handling
  onRetry?: () => Promise<void> | void;
  retryConfig?: Partial<RetryConfig>;

  // Visual customization
  customIcons?: Partial<Record<MessageStatusType, StatusIconConfig>>;
  customColors?: Partial<Record<MessageStatusType, { primary: string }>>;
  compact?: boolean;

  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;

  // Animation control
  enableAnimations?: boolean;
  animationDuration?: number;

  // Test ID
  testID?: string;
}

// ─────────────────────────────────────────────────────────────
// STATUS ICON COMPONENT
// ─────────────────────────────────────────────────────────────

interface StatusIconComponentProps {
  icon: StatusIconConfig;
  color: string;
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  isPending: boolean;
  uploadProgress?: number;
}

const StatusIconComponent = memo<StatusIconComponentProps>(({
  icon,
  color,
  animatedStyle,
  isPending,
  uploadProgress,
}) => {
  // Show loading spinner for pending states
  if (isPending && icon.animated) {
    return (
      <View style={styles.iconContainer}>
        <ActivityIndicator size="small" color={color} />
        {uploadProgress !== undefined && (
          <Text style={[styles.progressText, { color }]}>
            {Math.round(uploadProgress)}%
          </Text>
        )}
      </View>
    );
  }

  return (
    <Animated.View style={[styles.iconContainer, animatedStyle]}>
      <MaterialCommunityIcons
        name={icon.name as any}
        size={icon.size}
        color={color}
      />
    </Animated.View>
  );
});

StatusIconComponent.displayName = 'StatusIconComponent';

// ─────────────────────────────────────────────────────────────
// GROUP STATUS AVATARS COMPONENT
// ─────────────────────────────────────────────────────────────

interface GroupStatusAvatarsProps {
  groupSummary: GroupStatusSummary;
  displayConfig: GroupStatusDisplay;
  theme: ChatTheme;
}

const GroupStatusAvatars = memo<GroupStatusAvatarsProps>(({
  groupSummary,
  displayConfig,
  theme,
}) => {
  if (!displayConfig.showReadAvatars || groupSummary.readCount === 0) {
    return null;
  }

  const topUsers = getTopReadByUsers(groupSummary.readByUsers, displayConfig.maxAvatarsToShow);
  const remaining = groupSummary.readCount - topUsers.length;

  return (
    <View style={styles.avatarsContainer}>
      {topUsers.map((user, index) => (
        <View
          key={user.userId}
          style={[
            styles.avatar,
            {
              width: displayConfig.avatarSize,
              height: displayConfig.avatarSize,
              borderRadius: displayConfig.avatarSize / 2,
              borderColor: theme.surfaceColor,
              zIndex: topUsers.length - index,
              marginLeft: index > 0 ? -displayConfig.avatarSize / 3 : 0,
            },
          ]}
        >
          {user.userAvatar ? (
            <Text style={styles.avatarText}>
              {user.userName.charAt(0).toUpperCase()}
            </Text>
          ) : (
            <Text style={styles.avatarText}>
              {user.userName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      ))}
      {remaining > 0 && (
        <Text style={[styles.remainingText, { color: theme.textMuted }]}>
          +{remaining}
        </Text>
      )}
    </View>
  );
});

GroupStatusAvatars.displayName = 'GroupStatusAvatars';

// ─────────────────────────────────────────────────────────────
// RETRY BUTTON COMPONENT
// ─────────────────────────────────────────────────────────────

interface RetryButtonProps {
  onRetry: () => Promise<void>;
  isRetrying: boolean;
  theme: ChatTheme;
}

const RetryButton = memo<RetryButtonProps>(({
  onRetry,
  isRetrying,
  theme,
}) => {
  return (
    <Pressable
      onPress={onRetry}
      disabled={isRetrying}
      style={({ pressed }) => [
        styles.retryButton,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Retry sending message"
      accessibilityHint="Tap to try sending the message again"
    >
      {isRetrying ? (
        <ActivityIndicator size="small" color={theme.errorColor} />
      ) : (
        <MaterialCommunityIcons
          name="refresh"
          size={14}
          color={theme.errorColor}
        />
      )}
    </Pressable>
  );
});

RetryButton.displayName = 'RetryButton';

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

const MessageStatusComponent: React.FC<MessageStatusProps> = (props) => {
  const {
    status,
    timestamp,
    isUser,
    theme,
    metadata,
    isGroupChat = false,
    totalParticipants = 0,
    groupDisplayConfig,
    timeFormat = 'smart',
    locale = 'en-US',
    hideTime = false,
    showRelativeTime = false,
    onRetry,
    retryConfig,
    customIcons,
    customColors,
    compact = false,
    accessibilityLabel: customAccessibilityLabel,
    accessibilityHint,
    enableAnimations = true,
    animationDuration = 300,
    testID,
  } = props;

  // Use the hook for all logic
  const {
    icon,
    color,
    label,
    accessibilityLabel: generatedAccessibilityLabel,
    formattedTime,
    relativeTime,
    retryState,
    handleRetry,
    groupSummary,
    isPending,
    isComplete,
    isError,
    canRetry,
    animatedIconStyle,
    animatedContainerStyle,
    showRetryButton,
  } = useMessageStatus({
    status,
    timestamp,
    isUser,
    theme,
    metadata,
    timeFormat,
    locale,
    onRetry,
    retryConfig,
    isGroupChat,
    totalParticipants,
    customIcons,
    customColors,
    enableAnimations,
    animationDuration,
  });

  // Merge group display config
  const groupConfig: GroupStatusDisplay = {
    ...DEFAULT_GROUP_DISPLAY_CONFIG,
    ...groupDisplayConfig,
  };

  // Don't render for non-user messages in some cases
  if (!isUser && status !== 'edited') {
    return null;
  }

  const displayTime = showRelativeTime ? relativeTime : formattedTime;
  const accessibilityLabelToUse = customAccessibilityLabel || generatedAccessibilityLabel;

  return (
    <Animated.View
      style={[
        styles.container,
        compact && styles.containerCompact,
        animatedContainerStyle,
      ]}
      testID={testID}
      accessible={true}
      accessibilityLabel={accessibilityLabelToUse}
      accessibilityHint={accessibilityHint}
      accessibilityRole="text"
    >
      {/* Time display */}
      {!hideTime && (
        <Text
          style={[
            styles.timeText,
            { color: isUser ? theme.userBubbleTimestamp : theme.botBubbleTimestamp },
            compact && styles.timeTextCompact,
          ]}
        >
          {displayTime}
        </Text>
      )}

      {/* Status icon for user messages */}
      {isUser && (
        <StatusIconComponent
          icon={icon}
          color={color}
          animatedStyle={animatedIconStyle}
          isPending={isPending}
          uploadProgress={metadata?.uploadProgress}
        />
      )}

      {/* Edited indicator */}
      {status === 'edited' && (
        <Text style={[styles.editedText, { color: theme.textMuted }]}>
          edited
        </Text>
      )}

      {/* Retry button for failed messages */}
      {showRetryButton && onRetry && (
        <RetryButton
          onRetry={handleRetry}
          isRetrying={retryState.isRetrying}
          theme={theme}
        />
      )}

      {/* Group chat status */}
      {isGroupChat && groupSummary && (
        <View style={styles.groupStatusContainer}>
          <GroupStatusAvatars
            groupSummary={groupSummary}
            displayConfig={groupConfig}
            theme={theme}
          />
          {groupConfig.showDeliveredCount && !isComplete && (
            <Text style={[styles.groupStatusText, { color: theme.textMuted }]}>
              {getGroupStatusText(groupSummary)}
            </Text>
          )}
        </View>
      )}

      {/* Error message */}
      {isError && metadata?.errorMessage && (
        <Text style={[styles.errorText, { color: theme.errorColor }]}>
          {metadata.errorMessage}
        </Text>
      )}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  containerCompact: {
    marginTop: 1,
    gap: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '400',
  },
  timeTextCompact: {
    fontSize: 10,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '500',
  },
  editedText: {
    fontSize: 10,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  retryButton: {
    padding: 4,
    marginLeft: 4,
  },
  groupStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderWidth: 1.5,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  remainingText: {
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '500',
  },
  groupStatusText: {
    fontSize: 10,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 10,
    marginLeft: 4,
    fontStyle: 'italic',
  },
});

// ─────────────────────────────────────────────────────────────
// EXPORT WITH MEMO
// ─────────────────────────────────────────────────────────────

export const MessageStatus = memo(MessageStatusComponent);
MessageStatus.displayName = 'MessageStatus';

export default MessageStatus;