/**
 * ChatBubble - Premium Chat Message Component
 * Features: animations, markdown rendering, actionable content, timestamp
 */

import React, { memo, useMemo } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { PressableScale } from "@/components/UI/PressableScale";
import { colors, spacing } from "@/theme/colors";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface ChatBubbleProps {
  text: string;
  isUser: boolean;
  timestamp: number;
  isStreaming?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString("en-US", { 
    hour: "numeric", 
    minute: "2-digit",
    hour12: true 
  });
}

interface FormattedLine {
  key: number;
  text: string;
  isBullet: boolean;
}

function formatMarkdown(text: string): FormattedLine[] {
  // Simple markdown parsing for bold and bullet points
  const lines = text.split("\n");
  
  return lines.map((line, idx) => {
    // Bold text: **text**
    let formattedLine = line.replace(/\*\*(.*?)\*\*/g, "%%BOLD%%$1%%ENDBOLD%%");
    
    // Check for bullet points
    const isBullet = line.trim().startsWith("• ");
    
    return {
      key: idx,
      text: formattedLine,
      isBullet,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

interface MessageTextProps {
  text: string;
  isUser: boolean;
}

const MessageText = memo(({ text, isUser }: MessageTextProps) => {
  const lines = useMemo(() => formatMarkdown(text), [text]);
  
  return (
    <View style={styles.textContainer}>
      {lines.map(({ key, text: line, isBullet }) => {
        // Split by bold markers
        const parts = line.split(/%%BOLD%%|%%ENDBOLD%%/);
        
        return (
          <View key={key} style={[styles.lineRow, isBullet && styles.bulletRow]}>
            {isBullet && (
              <View style={styles.bulletDot}>
                <MaterialCommunityIcons 
                  name="circle" 
                  size={4} 
                  color={isUser ? "rgba(255,255,255,0.7)" : colors.primary} 
                />
              </View>
            )}
            <Text style={[styles.messageText, isUser && styles.userMessageText]}>
              {parts.map((part, i) => 
                i % 2 === 1 ? (
                  <Text key={i} style={styles.boldText}>{part}</Text>
                ) : (
                  part
                )
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

MessageText.displayName = "MessageText";

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

const ChatBubble = memo(({ 
  text, 
  isUser, 
  timestamp, 
  isStreaming,
  isError,
  onRetry 
}: ChatBubbleProps) => {
  const timeStr = useMemo(() => formatTime(timestamp), [timestamp]);

  return (
    <View style={[styles.container, isUser && styles.containerUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <MaterialCommunityIcons 
            name="robot-excited" 
            size={20} 
            color={colors.primary} 
          />
        </View>
      )}
      
      <View style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleBot,
        isError && styles.bubbleError,
      ]}>
        <MessageText text={text} isUser={isUser} />
        
        {isStreaming && (
          <View style={styles.streamingIndicator}>
            <Text style={styles.streamingDots}>...</Text>
          </View>
        )}
        
        {/* Footer with time and status */}
        <View style={styles.footer}>
          <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
            {timeStr}
          </Text>
          
          {isUser && (
            <MaterialCommunityIcons 
              name="check-all" 
              size={14} 
              color="rgba(255,255,255,0.7)" 
            />
          )}
          
          {isError && onRetry && (
            <PressableScale style={styles.retryBtn} onPress={onRetry}>
              <MaterialCommunityIcons 
                name="refresh" 
                size={14} 
                color={colors.error} 
              />
              <Text style={styles.retryText}>Retry</Text>
            </PressableScale>
          )}
        </View>
      </View>
      
      {isUser && (
        <View style={[styles.avatar, styles.avatarUser]}>
          <MaterialCommunityIcons 
            name="account" 
            size={20} 
            color="#FFF" 
          />
        </View>
      )}
    </View>
  );
});

ChatBubble.displayName = "ChatBubble";

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: "flex-end",
  },
  containerUser: {
    justifyContent: "flex-end",
  },
  
  // Avatar
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarUser: {
    backgroundColor: colors.primary,
    marginRight: 0,
    marginLeft: 8,
  },
  
  // Bubble
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleBot: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleError: {
    backgroundColor: `${colors.error}10`,
    borderColor: colors.error,
  },
  
  // Text
  textContainer: {
    flexShrink: 1,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bulletRow: {
    marginLeft: -4,
  },
  bulletDot: {
    width: 12,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 3,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  userMessageText: {
    color: "#FFF",
  },
  boldText: {
    fontWeight: "700",
  },
  
  // Streaming
  streamingIndicator: {
    marginTop: 4,
  },
  streamingDots: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 2,
  },
  
  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 6,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    color: colors.gray,
  },
  timestampUser: {
    color: "rgba(255,255,255,0.7)",
  },
  
  // Retry
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  retryText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: "600",
  },
});

export default ChatBubble;