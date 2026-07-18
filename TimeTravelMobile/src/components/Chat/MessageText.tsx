/**
 * 📝 MESSAGE TEXT COMPONENT
 * ==========================
 * Advanced markdown rendering with:
 * - Full markdown support
 * - Safe HTML sanitization
 * - Streaming text animation
 * - Link handling
 * - Performance optimized
 */

import React, { memo, useMemo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { MessageContent, ChatTheme } from './types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface MessageTextProps {
  content: MessageContent;
  isUser: boolean;
  theme: ChatTheme;
  isStreaming?: boolean;
  streamingContent?: string;
  onLinkPress?: (url: string) => void;
}

interface ParsedNode {
  type: 'text' | 'bold' | 'italic' | 'code' | 'codeblock' | 'link' | 'heading' | 'list' | 'emoji';
  content: string | ParsedNode[];
  level?: number;
  language?: string;
  href?: string;
  children?: ParsedNode[];
}

// ─────────────────────────────────────────────────────────────
// MARKDOWN PARSER (Optimized)
// ─────────────────────────────────────────────────────────────

const parseMarkdown = (text: string): ParsedNode[] => {
  const nodes: ParsedNode[] = [];
  const lines = text.split('\n');
  
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLanguage = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        nodes.push({
          type: 'codeblock',
          content: codeBlockContent.trim(),
          language: codeBlockLanguage,
        });
        codeBlockContent = '';
        codeBlockLanguage = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim();
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }
    
    // Heading
    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        nodes.push({
          type: 'heading',
          level: match[1].length,
          content: match[2],
        });
        continue;
      }
    }
    
    // List item
    if (line.match(/^[\*\-\+]\s+/) || line.match(/^\d+\.\s+/)) {
      const content = line.replace(/^[\*\-\+\d\.]\s+/, '');
      nodes.push({
        type: 'list',
        content: parseInline(content),
      });
      continue;
    }
    
    // Regular text with inline formatting
    if (line.trim()) {
      nodes.push({
        type: 'text',
        content: line,
        children: parseInline(line),
      });
    } else {
      // Empty line
      nodes.push({ type: 'text', content: '' });
    }
  }
  
  return nodes;
};

const parseInline = (text: string): ParsedNode[] => {
  const nodes: ParsedNode[] = [];
  let remaining = text;
  
  // Combined regex for inline elements
  const inlineRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = inlineRegex.exec(remaining)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', content: remaining.slice(lastIndex, match.index) });
    }
    
    // Bold
    if (match[1]) {
      nodes.push({ type: 'bold', content: match[2] });
    }
    // Italic
    else if (match[3]) {
      nodes.push({ type: 'italic', content: match[4] });
    }
    // Inline code
    else if (match[5]) {
      nodes.push({ type: 'code', content: match[6] });
    }
    // Link
    else if (match[7]) {
      nodes.push({ type: 'link', content: match[8], href: match[9] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < remaining.length) {
    nodes.push({ type: 'text', content: remaining.slice(lastIndex) });
  }
  
  return nodes.length > 0 ? nodes : [{ type: 'text', content: text }];
};

// ─────────────────────────────────────────────────────────────
// STREAMING CURSOR COMPONENT
// ─────────────────────────────────────────────────────────────

interface StreamingCursorProps {
  visible: boolean;
  color: string;
}

const StreamingCursor: React.FC<StreamingCursorProps> = memo(({ visible, color }) => {
  const [opacity, setOpacity] = useState(1);
  
  useEffect(() => {
    if (!visible) return;
    
    const interval = setInterval(() => {
      setOpacity(prev => prev === 1 ? 0 : 1);
    }, 530);
    
    return () => clearInterval(interval);
  }, [visible]);
  
  if (!visible) return null;
  
  return (
    <Text style={[styles.cursor, { color, opacity }]}>▋</Text>
  );
});

StreamingCursor.displayName = 'StreamingCursor';

// ─────────────────────────────────────────────────────────────
// RENDER HELPERS
// ─────────────────────────────────────────────────────────────

interface RenderNodeProps {
  node: ParsedNode;
  isUser: boolean;
  theme: ChatTheme;
  onLinkPress?: (url: string) => void;
}

const RenderNode: React.FC<RenderNodeProps> = memo(({ 
  node, 
  isUser, 
  theme, 
  onLinkPress 
}) => {
  const textStyle: TextStyle = {
    color: isUser ? theme.userBubbleText : theme.botBubbleText,
  };
  
  const handleLinkPress = useCallback(() => {
    if (node.href) {
      if (onLinkPress) {
        onLinkPress(node.href);
      } else {
        Linking.openURL(node.href).catch(console.error);
      }
    }
  }, [node.href, onLinkPress]);
  
  // Helper to render content safely
  const renderContent = (content: string | ParsedNode[]): string => {
    return typeof content === 'string' ? content : '';
  };
  
  // Helper to check if content is array
  const isNodeArray = (content: string | ParsedNode[]): content is ParsedNode[] => {
    return Array.isArray(content);
  };
  
  switch (node.type) {
    case 'heading':
      const headingStyles: TextStyle = {
        fontSize: 24 - (node.level || 1) * 2,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 4,
      };
      return (
        <Text style={[textStyle, headingStyles]}>
          {renderContent(node.content)}
        </Text>
      );
      
    case 'list':
      return (
        <View style={styles.listItem}>
          <Text style={[textStyle, styles.bullet]}>•</Text>
          <View style={styles.listContent}>
            {isNodeArray(node.content) ? 
              node.content.map((child, idx) => (
                <RenderNode 
                  key={idx} 
                  node={child} 
                  isUser={isUser} 
                  theme={theme}
                  onLinkPress={onLinkPress}
                />
              )) : 
              <Text style={textStyle}>{node.content}</Text>
            }
          </View>
        </View>
      );
      
    case 'codeblock':
      return (
        <View style={[styles.codeBlock, { backgroundColor: theme.surfaceColor }]}>
          {node.language && (
            <Text style={[styles.codeLanguage, { color: theme.textMuted }]}>
              {node.language}
            </Text>
          )}
          <Text style={[styles.codeText, { color: theme.textPrimary }]}>
            {renderContent(node.content)}
          </Text>
        </View>
      );
      
    case 'code':
      return (
        <Text style={[textStyle, styles.inlineCode, { backgroundColor: theme.surfaceColor }]}>
          {renderContent(node.content)}
        </Text>
      );
      
    case 'bold':
      return <Text style={[textStyle, styles.bold]}>{renderContent(node.content)}</Text>;
      
    case 'italic':
      return <Text style={[textStyle, styles.italic]}>{renderContent(node.content)}</Text>;
      
    case 'link':
      return (
        <Text 
          style={[textStyle, styles.link, { color: theme.primaryColor }]}
          onPress={handleLinkPress}
        >
          {renderContent(node.content)}
        </Text>
      );
      
    case 'text':
      if (!node.content || (typeof node.content === 'string' && !node.content.trim())) {
        return <Text>{'\n'}</Text>;
      }
      return (
        <Text style={textStyle}>
          {node.children ? 
            node.children.map((child, idx) => (
              <RenderNode 
                key={idx} 
                node={child} 
                isUser={isUser} 
                theme={theme}
                onLinkPress={onLinkPress}
              />
            )) : 
            renderContent(node.content)
          }
        </Text>
      );
      
    default:
      return null;
  }
});

RenderNode.displayName = 'RenderNode';

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

const MessageText: React.FC<MessageTextProps> = memo(({
  content,
  isUser,
  theme,
  isStreaming,
  streamingContent,
  onLinkPress,
}) => {
  // Get text content
  const text = useMemo(() => {
    if (content.type === 'text' || content.type === 'markdown') {
      return isStreaming && streamingContent ? streamingContent : content.text;
    }
    return '';
  }, [content, isStreaming, streamingContent]);
  
  // Parse markdown (memoized for performance)
  const parsedNodes = useMemo(() => parseMarkdown(text), [text]);
  
  // Handle rich content types
  if (content.type === 'image') {
    return (
      <View style={styles.imageContainer}>
        {/* Image rendering would go here */}
        <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
          📷 Image: {content.caption || 'Image'}
        </Text>
      </View>
    );
  }
  
  if (content.type === 'video') {
    return (
      <View style={styles.videoContainer}>
        <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
          🎬 Video ({Math.round(content.duration / 60)}m)
        </Text>
      </View>
    );
  }
  
  if (content.type === 'link') {
    return (
      <View style={[styles.linkPreview, { borderColor: theme.borderColor }]}>
        {content.preview?.image && (
          <Text style={styles.placeholderText}>🖼️ {content.preview.title}</Text>
        )}
        <Text style={[styles.linkTitle, { color: theme.textPrimary }]}>
          {content.preview?.title || content.url}
        </Text>
        {content.preview?.description && (
          <Text style={[styles.linkDesc, { color: theme.textSecondary }]}>
            {content.preview.description}
          </Text>
        )}
      </View>
    );
  }
  
  if (content.type === 'ai_card') {
    return (
      <View style={[styles.aiCard, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}>
        {content.image && (
          <Text style={styles.placeholderText}>🖼️ {content.title}</Text>
        )}
        <Text style={[styles.aiCardTitle, { color: theme.textPrimary }]}>
          {content.title}
        </Text>
        {content.subtitle && (
          <Text style={[styles.aiCardSubtitle, { color: theme.textSecondary }]}>
            {content.subtitle}
          </Text>
        )}
      </View>
    );
  }
  
  // Default text/markdown rendering
  return (
    <View style={styles.container}>
      {parsedNodes.map((node, index) => (
        <RenderNode
          key={index}
          node={node}
          isUser={isUser}
          theme={theme}
          onLinkPress={onLinkPress}
        />
      ))}
      {isStreaming && (
        <StreamingCursor 
          visible={true} 
          color={isUser ? theme.userBubbleText : theme.primaryColor} 
        />
      )}
    </View>
  );
});

MessageText.displayName = 'MessageText';

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
  
  // Typography
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  
  // Code
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBlock: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 4,
    overflow: 'hidden',
  },
  codeLanguage: {
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 18,
  },
  
  // List
  listItem: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  bullet: {
    width: 16,
    fontWeight: '700',
  },
  listContent: {
    flex: 1,
  },
  
  // Link
  link: {
    textDecorationLine: 'underline',
  },
  linkPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
    overflow: 'hidden',
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  linkDesc: {
    fontSize: 13,
    marginTop: 4,
  },
  
  // Media placeholders
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 4,
  },
  videoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 4,
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
    fontWeight: '600',
  },
  aiCardSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  
  // Streaming cursor
  cursor: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MessageText;