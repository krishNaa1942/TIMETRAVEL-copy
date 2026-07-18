/**
 * 📝 MESSAGE TEXT MODULE
 * =======================
 * Production-grade message rendering system
 * 
 * @module MessageText
 * @version 2.0.0
 */

// Main Component (default export)
export { default } from './MessageText';
export { default as MessageText } from './MessageText';

// Types
export type {
  MessageTextProps,
  MessageTextTheme,
  MessageContent,
  TextContent,
  ImageContent,
  VideoContent,
  LinkContent,
  AICardContent,
  MarkdownNode,
  ParsedContent,
  RendererProps,
  StreamingConfig,
  StreamingState,
} from './types';

// Hooks
export { useStreamingRenderer } from './hooks/useStreamingRenderer';
export type { StreamingRendererResult } from './hooks/useStreamingRenderer';

// Utilities
export { parseMarkdown, parseMarkdownIncremental } from './utils/markdownParser';
export { validateURL, sanitizeURL, openLinkSafely } from './utils/urlValidator';