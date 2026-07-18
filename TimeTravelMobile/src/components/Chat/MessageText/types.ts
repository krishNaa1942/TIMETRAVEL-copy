/**
 * 📝 MESSAGE TEXT TYPES
 * ======================
 * Production-grade type definitions for the message rendering engine
 * 
 * @version 2.0.0
 */

import { TextStyle, ViewStyle, ColorValue } from 'react-native';

// ─────────────────────────────────────────────────────────────
// MARKDOWN AST NODE TYPES
// ─────────────────────────────────────────────────────────────

export type MarkdownNodeType =
  | 'root'
  | 'paragraph'
  | 'heading'
  | 'text'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'underline'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'image'
  | 'list'
  | 'listItem'
  | 'blockquote'
  | 'hr'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'emoji'
  | 'mention'
  | 'hashtag'
  | 'custom';

export interface MarkdownNode {
  /** Unique identifier for the node */
  id: string;
  /** Type of markdown node */
  type: MarkdownNodeType;
  /** Text content for leaf nodes */
  content?: string;
  /** Child nodes */
  children?: MarkdownNode[];
  /** Additional properties based on node type */
  [key: string]: unknown;
}

export interface HeadingNode extends MarkdownNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: MarkdownNode[];
}

export interface CodeBlockNode extends MarkdownNode {
  type: 'codeblock';
  language: string;
  content: string;
  filename?: string;
}

export interface InlineCodeNode extends MarkdownNode {
  type: 'code';
  content: string;
}

export interface LinkNode extends MarkdownNode {
  type: 'link';
  href: string;
  title?: string;
  children: MarkdownNode[];
}

export interface ImageNode extends MarkdownNode {
  type: 'image';
  src: string;
  alt: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface ListNode extends MarkdownNode {
  type: 'list';
  ordered: boolean;
  start?: number;
  children: ListItemNode[];
}

export interface ListItemNode extends MarkdownNode {
  type: 'listItem';
  checked?: boolean;
  children: MarkdownNode[];
}

export interface BlockquoteNode extends MarkdownNode {
  type: 'blockquote';
  children: MarkdownNode[];
}

export interface TableNode extends MarkdownNode {
  type: 'table';
  align?: Array<'left' | 'center' | 'right' | null>;
  children: TableRowNode[];
}

export interface TableRowNode extends MarkdownNode {
  type: 'tableRow';
  children: TableCellNode[];
}

export interface TableCellNode extends MarkdownNode {
  type: 'tableCell';
  align?: 'left' | 'center' | 'right';
  children: MarkdownNode[];
}

export interface TextNode extends MarkdownNode {
  type: 'text';
  content: string;
}

export interface BoldNode extends MarkdownNode {
  type: 'bold';
  children: MarkdownNode[];
}

export interface ItalicNode extends MarkdownNode {
  type: 'italic';
  children: MarkdownNode[];
}

export interface StrikethroughNode extends MarkdownNode {
  type: 'strikethrough';
  children: MarkdownNode[];
}

export interface EmojiNode extends MarkdownNode {
  type: 'emoji';
  emoji: string;
  name?: string;
}

export interface MentionNode extends MarkdownNode {
  type: 'mention';
  userId: string;
  username: string;
}

export interface HashtagNode extends MarkdownNode {
  type: 'hashtag';
  tag: string;
}

export interface HorizontalRuleNode extends MarkdownNode {
  type: 'hr';
}

export interface CustomNode extends MarkdownNode {
  type: 'custom';
  kind: string;
  data: Record<string, unknown>;
  render?: (node: CustomNode, props: RendererProps) => React.ReactNode;
}

// ─────────────────────────────────────────────────────────────
// PARSED CONTENT TYPES
// ─────────────────────────────────────────────────────────────

export interface ParsedContent {
  /** Root node of the AST */
  root: MarkdownNode;
  /** Plain text version */
  plainText: string;
  /** Number of characters */
  charCount: number;
  /** Number of words */
  wordCount: number;
  /** Hash for cache invalidation */
  hash: string;
  /** Parse time in ms */
  parseTime?: number;
}

// ─────────────────────────────────────────────────────────────
// STREAMING TYPES
// ─────────────────────────────────────────────────────────────

export interface StreamingState {
  /** Whether currently streaming */
  isActive: boolean;
  /** Current streamed content */
  content: string;
  /** Content that was already rendered (cached) */
  renderedContent: string;
  /** New content to be rendered */
  deltaContent: string;
  /** Cursor position in content */
  cursorPosition: number;
  /** Token count for rate limiting */
  tokenCount: number;
  /** Streaming started at */
  startedAt?: number;
  /** Last update time */
  lastUpdate?: number;
}

export interface StreamingConfig {
  /** Minimum chars before updating */
  minChunkSize: number;
  /** Debounce time for updates (ms) */
  debounceMs: number;
  /** Show cursor animation */
  showCursor: boolean;
  /** Cursor animation speed (ms) */
  cursorSpeed: number;
  /** Auto-scroll to bottom */
  autoScroll: boolean;
  /** Batch updates for performance */
  batchUpdates: boolean;
  /** Maximum batch size */
  maxBatchSize: number;
}

// ─────────────────────────────────────────────────────────────
// RENDERER TYPES
// ─────────────────────────────────────────────────────────────

export interface RendererProps {
  /** Current node to render */
  node: MarkdownNode;
  /** Whether message is from user */
  isUser: boolean;
  /** Theme colors */
  theme: MessageTextTheme;
  /** Link press handler */
  onLinkPress?: (url: string) => void;
  /** Image press handler */
  onImagePress?: (src: string) => void;
  /** Custom renderers */
  customRenderers?: Map<string, NodeRenderer>;
  /** Selection enabled */
  selectable?: boolean;
  /** Test ID prefix */
  testID?: string;
}

export type NodeRenderer = (
  node: MarkdownNode,
  props: RendererProps
) => React.ReactNode;

// ─────────────────────────────────────────────────────────────
// THEME TYPES
// ─────────────────────────────────────────────────────────────

export interface MessageTextTheme {
  /** Primary text color */
  textPrimary: string;
  /** Secondary text color */
  textSecondary: string;
  /** Muted text color */
  textMuted: string;
  /** Link color */
  linkColor: string;
  /** Code background */
  codeBackground: string;
  /** Code text color */
  codeTextColor: string;
  /** Blockquote border color */
  blockquoteBorderColor: string;
  /** Blockquote background */
  blockquoteBackground: string;
  /** Surface color for cards */
  surfaceColor: string;
  /** Border color */
  borderColor: string;
  /** Primary brand color */
  primaryColor: string;
  /** Error color */
  errorColor: string;
  /** Success color */
  successColor: string;
}

// ─────────────────────────────────────────────────────────────
// MESSAGE CONTENT TYPES
// ─────────────────────────────────────────────────────────────

export type MessageContentType =
  | 'text'
  | 'markdown'
  | 'html'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'link'
  | 'ai_card'
  | 'location'
  | 'contact';

export interface BaseContent {
  type: MessageContentType;
}

export interface TextContent extends BaseContent {
  type: 'text' | 'markdown';
  text: string;
}

export interface ImageContent extends BaseContent {
  type: 'image';
  uri: string;
  width?: number;
  height?: number;
  caption?: string;
  blurHash?: string;
}

export interface VideoContent extends BaseContent {
  type: 'video';
  uri: string;
  thumbnail?: string;
  duration: number;
  width?: number;
  height?: number;
}

export interface AudioContent extends BaseContent {
  type: 'audio';
  uri: string;
  duration: number;
  title?: string;
  artist?: string;
}

export interface FileContent extends BaseContent {
  type: 'file';
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface LinkContent extends BaseContent {
  type: 'link';
  url: string;
  preview?: {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    favicon?: string;
  };
}

export interface AICardContent extends BaseContent {
  type: 'ai_card';
  title: string;
  subtitle?: string;
  image?: string;
  data: Record<string, unknown>;
  cardType: 'destination' | 'hotel' | 'flight' | 'weather' | 'recommendation' | 'custom';
}

export interface LocationContent extends BaseContent {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactContent extends BaseContent {
  type: 'contact';
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
}

export type MessageContent =
  | TextContent
  | ImageContent
  | VideoContent
  | AudioContent
  | FileContent
  | LinkContent
  | AICardContent
  | LocationContent
  | ContactContent;

// ─────────────────────────────────────────────────────────────
// COMPONENT PROPS
// ─────────────────────────────────────────────────────────────

export interface MessageTextProps {
  /** Message content */
  content: MessageContent;
  /** Whether message is from user */
  isUser: boolean;
  /** Theme colors */
  theme: MessageTextTheme;
  /** Streaming state */
  isStreaming?: boolean;
  /** Streaming content override */
  streamingContent?: string;
  /** Link press handler */
  onLinkPress?: (url: string) => void;
  /** Image press handler */
  onImagePress?: (src: string) => void;
  /** Enable text selection */
  selectable?: boolean;
  /** Custom renderers */
  customRenderers?: Map<string, NodeRenderer>;
  /** Maximum height before virtualization */
  maxHeight?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Test ID for testing */
  testID?: string;
  /** Accessibility label */
  accessibilityLabel?: string;
}

// ─────────────────────────────────────────────────────────────
// CACHE TYPES
// ─────────────────────────────────────────────────────────────

export interface ParseCache {
  /** Cached parsed content by hash */
  entries: Map<string, ParsedContent>;
  /** Maximum cache size */
  maxSize: number;
  /** Cache hit count */
  hits: number;
  /** Cache miss count */
  misses: number;
}

export interface RenderCache {
  /** Cached rendered elements by node hash */
  elements: Map<string, React.ReactNode>;
  /** Maximum cache size */
  maxSize: number;
}

// ─────────────────────────────────────────────────────────────
// UTILITY TYPES
// ─────────────────────────────────────────────────────────────

export interface URLValidationResult {
  valid: boolean;
  sanitized?: string;
  error?: string;
  isExternal?: boolean;
  protocol?: string;
  domain?: string;
}

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  loading?: boolean;
  error?: string;
}

export interface CodeHighlightResult {
  tokens: SyntaxToken[];
  language: string;
  lineCount: number;
}

export interface SyntaxToken {
  type: string;
  content: string;
  line: number;
  column: number;
}

// ─────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────

export class MessageTextError extends Error {
  constructor(
    message: string,
    public code: string,
    public node?: MarkdownNode
  ) {
    super(message);
    this.name = 'MessageTextError';
  }
}

export class ParseError extends MessageTextError {
  constructor(message: string, node?: MarkdownNode) {
    super(message, 'PARSE_ERROR', node);
    this.name = 'ParseError';
  }
}

export class RenderError extends MessageTextError {
  constructor(message: string, node?: MarkdownNode) {
    super(message, 'RENDER_ERROR', node);
    this.name = 'RenderError';
  }
}

export class SecurityError extends MessageTextError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
  }
}