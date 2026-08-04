/**
 * ChatScreen - Flagship AI Travel Agent
 * A world-class conversational AI experience that combines:
 * - ChatGPT-level intelligence
 * - Google Assistant-like proactivity
 * - MakeMyTrip travel expertise
 */

import React, { memo, useCallback, useRef, useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Alert,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Text, Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import ChatBubble from "@/components/Features/ChatBubble";
import { useChatAgent, SmartSuggestion } from "@/hooks/useChatAgent";
import { PressableScale } from "@/components/UI/PressableScale";
import { chatService } from "@/services/chat";
import { ChatMessage } from "@/types";
import { RootStackParamList } from "@/navigation/types";
import { colors, spacing } from "@/theme/colors";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const QUICK_STARTERS = [
  { icon: "beach", label: "Plan a beach trip", message: "Plan a relaxing 4-day beach trip to Goa" },
  { icon: "image-filter-hdr", label: "Mountain adventure", message: "Suggest a mountain trek near Delhi for this weekend" },
  { icon: "wallet", label: "Budget help", message: "What's the budget for a 5-day Kerala trip?" },
  { icon: "food", label: "Food guide", message: "Best local foods to try in Jaipur" },
];

// ─────────────────────────────────────────────────────────────
// ANIMATED TYPING INDICATOR
// ─────────────────────────────────────────────────────────────

interface TypingIndicatorProps {
  visible: boolean;
}

const TypingIndicator = memo(({ visible }: TypingIndicatorProps) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    };

    Animated.parallel([
      animate(dot1, 0),
      animate(dot2, 150),
      animate(dot3, 300),
    ]).start();

    return () => {
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <MaterialCommunityIcons name="robot" size={16} color={colors.primary} />
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { transform: [{ scale: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.3]
                })}] },
                { opacity: dot },
              ]}
            />
          ))}
        </View>
        <Text style={styles.typingText}>AI Agent thinking</Text>
      </View>
    </View>
  );
});

TypingIndicator.displayName = "TypingIndicator";

// ─────────────────────────────────────────────────────────────
// SUGGESTION CHIPS
// ─────────────────────────────────────────────────────────────

interface SuggestionChipsProps {
  suggestions: SmartSuggestion[];
  onSuggestionPress: (suggestion: SmartSuggestion) => void;
}

const SuggestionChips = memo(({ suggestions, onSuggestionPress }: SuggestionChipsProps) => {
  if (suggestions.length === 0) return null;

  return (
    <View style={styles.suggestionsContainer}>
      <Text style={styles.suggestionsTitle}>Suggested actions</Text>
      <View style={styles.suggestionsRow}>
        {suggestions.map((s) => (
          <PressableScale
            key={s.id}
            style={styles.suggestionChip}
            onPress={() => onSuggestionPress(s)}
          >
            <MaterialCommunityIcons name={s.icon as any} size={16} color={colors.primary} />
            <Text style={styles.suggestionLabel}>{s.label}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
});

SuggestionChips.displayName = "SuggestionChips";

// ─────────────────────────────────────────────────────────────
// QUICK STARTER CHIPS
// ─────────────────────────────────────────────────────────────

interface QuickStartersProps {
  onSelect: (message: string) => void;
}

const QuickStarters = memo(({ onSelect }: QuickStartersProps) => (
  <View style={styles.startersContainer}>
    <Text style={styles.startersTitle}>💡 Try these</Text>
    <View style={styles.startersGrid}>
      {QUICK_STARTERS.map((item, idx) => (
        <PressableScale
          key={idx}
          style={styles.starterChip}
          onPress={() => onSelect(item.message)}
        >
          <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primary} />
          <Text style={styles.starterLabel}>{item.label}</Text>
        </PressableScale>
      ))}
    </View>
  </View>
));

QuickStarters.displayName = "QuickStarters";

// ─────────────────────────────────────────────────────────────
// CHAT INPUT BAR
// ─────────────────────────────────────────────────────────────

interface ChatInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled: boolean;
  destination: string | null;
  onDestinationChange: (dest: string | null) => void;
}

const ChatInputBar = memo(({
  value,
  onChangeText,
  onSend,
  disabled,
  destination,
  onDestinationChange,
}: ChatInputBarProps) => {
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <View style={styles.inputContainer}>
      {/* Destination Context */}
      {destination && (
        <View style={styles.contextTag}>
          <MaterialCommunityIcons name="map-marker" size={14} color={colors.primary} />
          <Text style={styles.contextText}>{destination}</Text>
          <PressableScale onPress={() => onDestinationChange(null)}>
            <MaterialCommunityIcons name="close-circle" size={16} color={colors.gray} />
          </PressableScale>
        </View>
      )}
      
      {/* Input Row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask anything about travel..."
          placeholderTextColor={colors.gray}
          multiline
          maxLength={2000}
          editable={!disabled}
          accessibilityLabel="Chat message input"
          accessibilityHint="Type your travel question and press send"
        />
        <PressableScale
          style={[styles.sendBtn, canSend && styles.sendBtnActive]}
          onPress={onSend}
          disabled={!canSend}
          accessibilityLabel={disabled ? "Waiting for response" : "Send message"}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
        >
          <MaterialCommunityIcons
            name={disabled ? "timer-sand" : "send"}
            size={20}
            color={canSend ? "#FFF" : colors.gray}
          />
        </PressableScale>
      </View>
    </View>
  );
});

ChatInputBar.displayName = "ChatInputBar";

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────

const EmptyState = memo(() => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <MaterialCommunityIcons name="robot-excited" size={48} color={colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>Your AI Travel Agent</Text>
    <Text style={styles.emptyMessage}>
      I can plan trips, estimate budgets, find places, and more. Start a conversation!
    </Text>
  </View>
));

EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const navigation = useNavigation<NavProp>();
  const listRef = useRef<FlatList>(null);
  const [input, setInput] = useState("");

  // Conversation history
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<
    Array<{
      session_id: string;
      count: number;
      preview: string;
      updated_at: string | null;
    }>
  >([]);

  const {
    messages,
    isTyping,
    error,
    detectedDestination,
    suggestions,
    sendMessage,
    retryLast,
    clearChat,
    restoreSession,
    setDestination,
  } = useChatAgent();

  const formatSessionDate = useCallback((iso: string | null) => {
    if (!iso) return "";
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }, []);

  const openHistory = useCallback(async () => {
    setHistoryVisible(true);
    setHistoryLoading(true);
    try {
      const response = await chatService.getHistory(30);
      setHistorySessions(response.sessions ?? []);
    } catch (historyError) {
      setHistorySessions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await chatService.getSessionMessages(sessionId);
        const restored: ChatMessage[] = (response.messages ?? []).map((msg) => ({
          id: String(msg.id),
          role: msg.role,
          text: msg.text,
          timestamp: msg.created_at ? Date.parse(msg.created_at) : Date.now(),
          intent: msg.intent ?? undefined,
          destination: msg.destination ?? null,
        }));
        if (restored.length > 0) {
          restoreSession(restored, sessionId);
        }
        setHistoryVisible(false);
      } catch (loadError) {
        Alert.alert("Couldn't load conversation", "Please try again.");
      }
    },
    [restoreSession],
  );

  // Scroll to bottom on new messages using requestAnimationFrame
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // Handle send
  const handleSend = useCallback(() => {
    if (input.trim()) {
      sendMessage(input.trim());
      setInput("");
    }
  }, [input, sendMessage]);

  // Handle suggestion press
  const handleSuggestionPress = useCallback((suggestion: SmartSuggestion) => {
    if (suggestion.action?.type === "navigate" && suggestion.action.screen) {
      const screen = suggestion.action.screen as
        | "Budget"
        | "Itinerary"
        | "Places"
        | "Compare";
      navigation.navigate(screen);
    } else if (suggestion.message) {
      sendMessage(suggestion.message);
    }
  }, [sendMessage, navigation]);

  // Handle quick starter
  const handleQuickStarter = useCallback((message: string) => {
    sendMessage(message);
  }, [sendMessage]);

  // Clear chat confirmation
  const handleClearChat = useCallback(() => {
    Alert.alert(
      "Clear Conversation",
      "Start a fresh conversation?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: clearChat },
      ]
    );
  }, [clearChat]);

  // Render message
  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => (
    <ChatBubble
      text={item.text}
      isUser={item.role === "user"}
      timestamp={item.timestamp}
      isError={item.text.startsWith("⚠️")}
      onRetry={item.text.startsWith("⚠️") ? retryLast : undefined}
      intent={item.intent}
      confidence={item.confidence}
      model={item.model}
      destination={item.destination}
    />
  ), [retryLast]);

  // Key extractor
  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // List footer - show suggestions after bot messages
  const ListFooter = useCallback(() => {
    const lastMessage = messages[messages.length - 1];
    const showSuggestions = lastMessage?.role === "bot" && suggestions.length > 0;
    const showStarters = messages.length <= 1;

    return (
      <View style={styles.listFooter}>
        {showSuggestions && (
          <SuggestionChips suggestions={suggestions} onSuggestionPress={handleSuggestionPress} />
        )}
        {showStarters && (
          <QuickStarters onSelect={handleQuickStarter} />
        )}
      </View>
    );
  }, [messages, suggestions, handleSuggestionPress, handleQuickStarter]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="robot-excited" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>AI Travel Agent</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.headerSub}>Online • AI Travel Assistant</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <PressableScale style={styles.clearBtn} onPress={openHistory} accessibilityLabel="Conversation history" accessibilityRole="button">
            <MaterialCommunityIcons name="history" size={22} color={colors.primary} />
          </PressableScale>
          <PressableScale style={styles.clearBtn} onPress={handleClearChat} accessibilityLabel="Clear conversation" accessibilityRole="button">
            <MaterialCommunityIcons name="broom" size={22} color={colors.gray} />
          </PressableScale>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Messages List */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={ListFooter}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          // Performance optimizations
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={21}
          // removeClippedSubviews removed — causes visual glitches
          // on iOS when messages are rapidly appended
        
        />

        {/* Typing Indicator */}
        <TypingIndicator visible={isTyping} />

        {/* Input Bar */}
        <ChatInputBar
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          disabled={isTyping}
          destination={detectedDestination}
          onDestinationChange={setDestination}
        />
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal
        visible={historyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.historyOverlay}>
          <View style={styles.historySheet}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Conversations</Text>
              <TouchableOpacity
                onPress={() => setHistoryVisible(false)}
                hitSlop={12}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.gray}
                />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.historyLoading}
              />
            ) : historySessions.length === 0 ? (
              <View style={styles.historyEmpty}>
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={40}
                  color={colors.gray}
                />
                <Text style={styles.historyEmptyText}>
                  No past conversations yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={historySessions}
                keyExtractor={(item) => item.session_id}
                contentContainerStyle={styles.historyList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyItem}
                    onPress={() => handleSelectSession(item.session_id)}
                  >
                    <View style={styles.historyItemIcon}>
                      <MaterialCommunityIcons
                        name="robot-outline"
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.historyItemBody}>
                      <Text
                        style={styles.historyItemPreview}
                        numberOfLines={2}
                      >
                        {item.preview || "Empty conversation"}
                      </Text>
                      <Text style={styles.historyItemMeta}>
                        {item.count} messages ·{" "}
                        {formatSessionDate(item.updated_at)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={colors.gray}
                    />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    marginLeft: spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  headerSub: {
    fontSize: 12,
    color: colors.gray,
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  // History modal
  historyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  historySheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  historyLoading: {
    paddingVertical: 48,
  },
  historyEmpty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  historyEmptyText: {
    fontSize: 13,
    color: colors.gray,
  },
  historyList: {
    paddingVertical: 8,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  historyItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  historyItemBody: {
    flex: 1,
  },
  historyItemPreview: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  historyItemMeta: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },

  // Messages
  messageList: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  listFooter: {
    paddingBottom: spacing.lg,
  },

  // Typing Indicator
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  typingText: {
    fontSize: 13,
    color: colors.gray,
    marginLeft: 4,
  },

  // Suggestions
  suggestionsContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  suggestionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.primary,
  },

  // Quick Starters
  startersContainer: {
    padding: spacing.md,
  },
  startersTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  startersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  starterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  starterLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },

  // Input
  inputContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contextTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
    gap: 6,
  },
  contextText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 120,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: colors.primary,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${colors.primary}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.gray,
    textAlign: "center",
    lineHeight: 20,
  },
});