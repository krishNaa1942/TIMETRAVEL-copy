/**
 * 📝 MESSAGE TEXT COMPONENT
 * ==========================
 * Production-grade message rendering engine with:
 * - Full markdown AST-based rendering
 * - Streaming optimization
 * - Security hardening
 * - Accessibility support
 * - Performance optimizations
 *
 * @version 2.0.0
 */

import React, {
  memo,
  useMemo,
  useCallback,
  useState,
  createElement,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  AccessibilityInfo,
  findNodeHandle,
  Animated as RNAnimated,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {
  MessageTextProps,
  MarkdownNode,
  RendererProps,
  MessageTextTheme,
  MessageContent,
  TextContent,
} from "./types";
import { parseMarkdown } from "./utils/markdownParser";
import { validateURL, openLinkSafely } from "./utils/urlValidator";

// ─────────────────────────────────────────────────────────────
// DEFAULT THEME
// ─────────────────────────────────────────────────────────────

const DEFAULT_THEME: MessageTextTheme = {
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textMuted: "#999999",
  linkColor: "#0066cc",
  codeBackground: "#f5f5f5",
  codeTextColor: "#333333",
  blockquoteBorderColor: "#ddd",
  blockquoteBackground: "#f9f9f9",
  surfaceColor: "#ffffff",
  borderColor: "#e0e0e0",
  primaryColor: "#0066cc",
  errorColor: "#cc0000",
  successColor: "#00cc00",
};

// ─────────────────────────────────────────────────────────────
// STREAMING CURSOR COMPONENT
// ─────────────────────────────────────────────────────────────

interface StreamingCursorProps {
  opacity: RNAnimated.Value;
  color: string;
}

const StreamingCursor: React.FC<StreamingCursorProps> = memo(
  ({ opacity, color }) => {
    return (
      <RNAnimated.Text
        style={[styles.cursor, { color, opacity }]}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      >
        ▋
      </RNAnimated.Text>
    );
  },
);

StreamingCursor.displayName = "StreamingCursor";

// ─────────────────────────────────────────────────────────────
// NODE RENDERERS
// ─────────────────────────────────────────────────────────────

/**
 * Creates text style based on node type
 */
const getNodeStyle = (
  node: MarkdownNode,
  theme: MessageTextTheme,
  isUser: boolean,
): object => {
  const baseStyle = {
    color: isUser ? theme.textPrimary : theme.textPrimary,
  };

  switch (node.type) {
    case "heading":
      const level = (node.level as number) || 1;
      const fontSizes = { 1: 28, 2: 24, 3: 20, 4: 18, 5: 16, 6: 14 };
      return {
        ...baseStyle,
        fontSize: fontSizes[level as keyof typeof fontSizes] || 16,
        fontWeight: "700" as const,
        marginTop: 12,
        marginBottom: 6,
      };
    case "bold":
      return { ...baseStyle, fontWeight: "700" as const };
    case "italic":
      return { ...baseStyle, fontStyle: "italic" as const };
    case "strikethrough":
      return { ...baseStyle, textDecorationLine: "line-through" as const };
    case "code":
      return {
        ...baseStyle,
        fontFamily: Platform.select({
          ios: "Menlo",
          android: "monospace",
          default: "monospace",
        }),
        fontSize: 13,
        backgroundColor: theme.codeBackground,
        color: theme.codeTextColor,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
      };
    case "link":
      return {
        ...baseStyle,
        color: theme.linkColor,
        textDecorationLine: "underline" as const,
      };
    default:
      return baseStyle;
  }
};

/**
 * Renders a single markdown node
 */
const RenderNode: React.FC<RendererProps & { depth?: number }> = memo(
  ({
    node,
    isUser,
    theme,
    onLinkPress,
    onImagePress,
    selectable,
    testID,
    depth = 0,
  }) => {
    // Prevent infinite recursion
    if (depth > 20) {
      return null;
    }

    const handleLinkPress = useCallback(() => {
      if (node.type === "link" && node.href) {
        if (onLinkPress) {
          onLinkPress(node.href as string);
        } else {
          openLinkSafely(node.href as string, { confirmExternal: false });
        }
      }
    }, [node.type, node.href, onLinkPress]);

    // Render based on node type
    switch (node.type) {
      case "root":
      case "paragraph":
        return (
          <View style={styles.paragraph}>
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                onImagePress={onImagePress}
                selectable={selectable}
                testID={testID}
                depth={depth + 1}
              />
            ))}
          </View>
        );

      case "heading":
        return (
          <Text
            style={getNodeStyle(node, theme, isUser)}
            accessibilityRole="header"
          >
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                selectable={selectable}
                depth={depth + 1}
              />
            ))}
          </Text>
        );

      case "text":
        return (
          <Text
            style={getNodeStyle(node, theme, isUser)}
            selectable={selectable}
          >
            {node.content as string}
          </Text>
        );

      case "bold":
        return (
          <Text style={getNodeStyle(node, theme, isUser)}>
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                selectable={selectable}
                depth={depth + 1}
              />
            ))}
          </Text>
        );

      case "italic":
        return (
          <Text style={getNodeStyle(node, theme, isUser)}>
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                selectable={selectable}
                depth={depth + 1}
              />
            ))}
          </Text>
        );

      case "strikethrough":
        return (
          <Text style={getNodeStyle(node, theme, isUser)}>
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                selectable={selectable}
                depth={depth + 1}
              />
            ))}
          </Text>
        );

      case "code":
        return (
          <Text style={getNodeStyle(node, theme, isUser)}>
            {node.content as string}
          </Text>
        );

      case "codeblock": {
        const language =
          typeof node.language === "string" ? node.language.trim() : "";
        return (
          <View
            style={[
              styles.codeBlock,
              { backgroundColor: theme.codeBackground },
            ]}
          >
            {language ? (
              <View style={styles.codeHeader}>
                <Text style={[styles.codeLanguage, { color: theme.textMuted }]}>
                  {language}
                </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => {
                    // Copy to clipboard functionality would go here
                  }}
                  accessibilityLabel="Copy code"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="content-copy"
                    size={14}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.codeContent}
            >
              <Text
                style={[styles.codeText, { color: theme.codeTextColor }]}
                selectable={selectable}
              >
                {node.content as string}
              </Text>
            </ScrollView>
          </View>
        );
      }

      case "link":
        return (
          <Text
            style={getNodeStyle(node, theme, isUser)}
            onPress={handleLinkPress}
            accessibilityRole="link"
            accessibilityHint={`Opens ${node.href}`}
          >
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                selectable={false}
                depth={depth + 1}
              />
            ))}
          </Text>
        );

      case "image":
        const altText =
          typeof node.alt === "string" && node.alt.trim().length > 0
            ? node.alt
            : "Image";
        return (
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={() => onImagePress?.(node.src as string)}
            accessibilityRole="image"
            accessibilityLabel={altText}
          >
            <Text style={[styles.imagePlaceholder, { color: theme.textMuted }]}>
              🖼️ {altText}
            </Text>
          </TouchableOpacity>
        );

      case "list":
        const ordered = node.ordered as boolean;
        return (
          <View style={styles.list}>
            {node.children?.map((item, index) => (
              <View
                key={item.id || `${node.id}-${index}`}
                style={styles.listItem}
              >
                <Text style={[styles.bullet, { color: theme.textPrimary }]}>
                  {ordered ? `${index + 1}.` : "•"}
                </Text>
                <View style={styles.listContent}>
                  <RenderNode
                    node={item}
                    isUser={isUser}
                    theme={theme}
                    onLinkPress={onLinkPress}
                    onImagePress={onImagePress}
                    selectable={selectable}
                    depth={depth + 1}
                  />
                </View>
              </View>
            ))}
          </View>
        );

      case "listItem":
        return (
          <View>
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                onImagePress={onImagePress}
                selectable={selectable}
                depth={depth + 1}
              />
            ))}
          </View>
        );

      case "blockquote":
        return (
          <View
            style={[
              styles.blockquote,
              {
                borderLeftColor: theme.blockquoteBorderColor,
                backgroundColor: theme.blockquoteBackground,
              },
            ]}
          >
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                onImagePress={onImagePress}
                selectable={selectable}
                depth={depth + 1}
              />
            ))}
          </View>
        );

      case "hr":
        return (
          <View style={[styles.hr, { backgroundColor: theme.borderColor }]} />
        );

      case "table":
        return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              {node.children?.map((row, index) => (
                <RenderNode
                  key={row.id || `${node.id}-${index}`}
                  node={row}
                  isUser={isUser}
                  theme={theme}
                  onLinkPress={onLinkPress}
                  selectable={selectable}
                  depth={depth + 1}
                />
              ))}
            </View>
          </ScrollView>
        );

      case "tableRow":
        return (
          <View style={styles.tableRow}>
            {node.children?.map((cell, index) => (
              <RenderNode
                key={cell.id || `${node.id}-${index}`}
                node={cell}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                selectable={selectable}
                depth={depth + 1}
              />
            ))}
          </View>
        );

      case "tableCell":
        return (
          <View style={[styles.tableCell, { borderColor: theme.borderColor }]}>
            {node.children?.map((child, index) => (
              <RenderNode
                key={child.id || `${node.id}-${index}`}
                node={child}
                isUser={isUser}
                theme={theme}
                onLinkPress={onLinkPress}
                selectable={selectable}
                depth={depth + 1}
              />
            ))}
          </View>
        );

      default:
        return null;
    }
  },
);

RenderNode.displayName = "RenderNode";

// ─────────────────────────────────────────────────────────────
// CONTENT TYPE RENDERERS
// ─────────────────────────────────────────────────────────────

const renderImageContent = (
  content: MessageContent,
  theme: MessageTextTheme,
) => {
  const imageContent = content as Extract<MessageContent, { type: "image" }>;
  return (
    <View style={styles.mediaContainer}>
      <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
        📷 Image: {imageContent.caption || "Image"}
      </Text>
    </View>
  );
};

const renderVideoContent = (
  content: MessageContent,
  theme: MessageTextTheme,
) => {
  const videoContent = content as Extract<MessageContent, { type: "video" }>;
  return (
    <View style={styles.mediaContainer}>
      <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
        🎬 Video ({Math.round(videoContent.duration / 60)}m)
      </Text>
    </View>
  );
};

const renderLinkContent = (
  content: MessageContent,
  theme: MessageTextTheme,
) => {
  const linkContent = content as Extract<MessageContent, { type: "link" }>;
  return (
    <View style={[styles.linkPreview, { borderColor: theme.borderColor }]}>
      {linkContent.preview?.image && (
        <Text style={styles.placeholderText}>
          🖼️ {linkContent.preview.title}
        </Text>
      )}
      <Text style={[styles.linkTitle, { color: theme.textPrimary }]}>
        {linkContent.preview?.title || linkContent.url}
      </Text>
      {linkContent.preview?.description && (
        <Text style={[styles.linkDesc, { color: theme.textSecondary }]}>
          {linkContent.preview.description}
        </Text>
      )}
    </View>
  );
};

const renderAICardContent = (
  content: MessageContent,
  theme: MessageTextTheme,
) => {
  const cardContent = content as Extract<MessageContent, { type: "ai_card" }>;
  return (
    <View
      style={[
        styles.aiCard,
        { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor },
      ]}
    >
      {cardContent.image && (
        <Text style={styles.placeholderText}>🖼️ {cardContent.title}</Text>
      )}
      <Text style={[styles.aiCardTitle, { color: theme.textPrimary }]}>
        {cardContent.title}
      </Text>
      {cardContent.subtitle && (
        <Text style={[styles.aiCardSubtitle, { color: theme.textSecondary }]}>
          {cardContent.subtitle}
        </Text>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

const MessageText: React.FC<MessageTextProps> = memo(
  ({
    content,
    isUser,
    theme: propTheme,
    isStreaming = false,
    streamingContent,
    onLinkPress,
    onImagePress,
    selectable = true,
    customRenderers,
    maxHeight,
    debug = false,
    testID = "message-text",
    accessibilityLabel,
  }) => {
    // Merge theme with defaults
    const theme = useMemo(
      () => ({ ...DEFAULT_THEME, ...propTheme }),
      [propTheme],
    );

    // Get text content
    const text = useMemo(() => {
      if (content.type === "text" || content.type === "markdown") {
        return isStreaming && streamingContent
          ? streamingContent
          : (content as TextContent).text;
      }
      return "";
    }, [content, isStreaming, streamingContent]);

    // Parse markdown (memoized for performance)
    const parsedContent = useMemo(() => {
      if (!text) return null;
      return parseMarkdown(text, { debug });
    }, [text, debug]);

    // Handle rich content types
    const renderContent = useMemo(() => {
      switch (content.type) {
        case "image":
          return renderImageContent(content, theme);
        case "video":
          return renderVideoContent(content, theme);
        case "link":
          return renderLinkContent(content, theme);
        case "ai_card":
          return renderAICardContent(content, theme);
        default:
          return null;
      }
    }, [content, theme]);

    // Accessibility
    const computedAccessibilityLabel = useMemo(() => {
      if (accessibilityLabel) return accessibilityLabel;
      if (parsedContent?.plainText) {
        return isStreaming
          ? `Streaming: ${parsedContent.plainText}`
          : parsedContent.plainText;
      }
      return "Message content";
    }, [accessibilityLabel, parsedContent, isStreaming]);

    // If rich content type, render it
    if (renderContent) {
      return (
        <View
          testID={testID}
          accessibilityLabel={computedAccessibilityLabel}
          accessibilityRole="text"
        >
          {renderContent}
        </View>
      );
    }

    // Default text/markdown rendering
    return (
      <View
        style={[styles.container, maxHeight ? { maxHeight } : undefined]}
        testID={testID}
        accessibilityLabel={computedAccessibilityLabel}
        accessibilityRole="text"
      >
        {parsedContent?.root.children?.map((node, index) => (
          <RenderNode
            key={node.id || `node-${index}`}
            node={node}
            isUser={isUser}
            theme={theme}
            onLinkPress={onLinkPress}
            onImagePress={onImagePress}
            selectable={selectable}
            testID={`${testID}-node-${index}`}
          />
        ))}
        {isStreaming && (
          <StreamingCursor
            opacity={new RNAnimated.Value(1)}
            color={isUser ? theme.textPrimary : theme.primaryColor}
          />
        )}
      </View>
    );
  },
);

MessageText.displayName = "MessageText";

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },

  paragraph: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginVertical: 2,
  },

  // Code
  codeBlock: {
    borderRadius: 8,
    marginVertical: 8,
    overflow: "hidden",
  },
  codeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  codeLanguage: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  copyButton: {
    padding: 4,
  },
  codeContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  codeText: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 13,
    lineHeight: 20,
  },

  // List
  list: {
    marginVertical: 4,
  },
  listItem: {
    flexDirection: "row",
    marginVertical: 2,
  },
  bullet: {
    width: 20,
    fontSize: 14,
  },
  listContent: {
    flex: 1,
  },

  // Blockquote
  blockquote: {
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 4,
  },

  // Horizontal rule
  hr: {
    height: 1,
    marginVertical: 12,
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 4,
    marginVertical: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  tableCell: {
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: "rgba(0,0,0,0.1)",
    minWidth: 80,
  },

  // Image
  imageContainer: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  imagePlaceholder: {
    fontSize: 13,
  },

  // Link preview
  linkPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  linkDesc: {
    fontSize: 13,
    marginTop: 4,
  },

  // Media
  mediaContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 4,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  placeholderText: {
    fontSize: 13,
  },

  // AI Card
  aiCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  aiCardSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },

  // Streaming cursor
  cursor: {
    fontSize: 16,
    fontWeight: "700",
  },
});

export default MessageText;
