/**
 * 📝 MARKDOWN PARSER ENGINE
 * ==========================
 * Production-grade AST-based markdown parser with incremental parsing support
 * 
 * @version 2.0.0
 */

import {
  MarkdownNode,
  MarkdownNodeType,
  ParsedContent,
  ParseError,
} from '../types';

// ─────────────────────────────────────────────────────────────
// ID GENERATOR FOR STABLE KEYS
// ─────────────────────────────────────────────────────────────

let idCounter = 0;

const generateId = (prefix: string = 'node'): string => {
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}_${idCounter}_${Date.now().toString(36)}`;
};

const resetIdCounter = (): void => {
  idCounter = 0;
};

// ─────────────────────────────────────────────────────────────
// HASH UTILITY FOR CACHING
// ─────────────────────────────────────────────────────────────

/**
 * Simple hash function for content deduplication
 */
const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// ─────────────────────────────────────────────────────────────
// BLOCK PARSERS
// ─────────────────────────────────────────────────────────────

/**
 * Parses a code block
 */
const parseCodeBlock = (
  lines: string[],
  startIndex: number
): { node: MarkdownNode; endIndex: number } => {
  const firstLine = lines[startIndex];
  const language = firstLine.slice(3).trim() || 'plaintext';
  const content: string[] = [];
  let endIndex = startIndex + 1;

  while (endIndex < lines.length && !lines[endIndex].startsWith('```')) {
    content.push(lines[endIndex]);
    endIndex++;
  }

  return {
    node: {
      id: generateId('codeblock'),
      type: 'codeblock',
      language,
      content: content.join('\n'),
    },
    endIndex: endIndex + 1,
  };
};

/**
 * Parses a heading
 */
const parseHeading = (line: string): MarkdownNode | null => {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;

  const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
  const content = match[2].trim();

  return {
    id: generateId('heading'),
    type: 'heading',
    level,
    children: parseInline(content),
  };
};

/**
 * Parses a blockquote
 */
const parseBlockquote = (line: string): MarkdownNode | null => {
  const match = line.match(/^>\s*(.*)$/);
  if (!match) return null;

  return {
    id: generateId('blockquote'),
    type: 'blockquote',
    children: parseInline(match[1]),
  };
};

/**
 * Parses a list (handles both ordered and unordered)
 */
const parseList = (
  lines: string[],
  startIndex: number
): { node: MarkdownNode; endIndex: number } => {
  const items: MarkdownNode[] = [];
  let endIndex = startIndex;
  let isOrdered: boolean | null = null;

  while (endIndex < lines.length) {
    const line = lines[endIndex];
    const unorderedMatch = line.match(/^[\*\-\+]\s+(.*)$/);
    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);

    if (unorderedMatch) {
      if (isOrdered === null) isOrdered = false;
      if (isOrdered === true) break; // Mixed list types not supported

      items.push({
        id: generateId('listitem'),
        type: 'listItem',
        children: parseInline(unorderedMatch[1]),
      });
      endIndex++;
    } else if (orderedMatch) {
      if (isOrdered === null) {
        isOrdered = true;
      }
      if (isOrdered === false) break; // Mixed list types not supported

      items.push({
        id: generateId('listitem'),
        type: 'listItem',
        children: parseInline(orderedMatch[2]),
      });
      endIndex++;
    } else if (line.match(/^\s{2,}/) && items.length > 0) {
      // Continuation line for list item
      const lastItem = items[items.length - 1];
      if (lastItem.children) {
        lastItem.children.push(...parseInline(line.trim()));
      }
      endIndex++;
    } else {
      break;
    }
  }

  return {
    node: {
      id: generateId('list'),
      type: 'list',
      ordered: isOrdered ?? false,
      children: items,
    },
    endIndex,
  };
};

/**
 * Parses a table
 */
const parseTable = (
  lines: string[],
  startIndex: number
): { node: MarkdownNode; endIndex: number } | null => {
  const rows: MarkdownNode[][] = [];
  let endIndex = startIndex;
  let alignments: Array<'left' | 'center' | 'right' | null> = [];

  // Check if it's a table
  const firstLine = lines[startIndex];
  if (!firstLine.includes('|')) return null;

  // Parse first row
  const firstRowCells = parseTableRow(firstLine);
  if (firstRowCells.length === 0) return null;

  // Check for alignment row
  if (endIndex + 1 < lines.length) {
    const alignmentLine = lines[endIndex + 1];
    const alignmentMatch = alignmentLine.match(/^\|?[\s\-:|]+\|?$/);
    
    if (alignmentMatch) {
      // Parse alignments
      const cells = alignmentLine.split('|').filter(c => c.trim());
      alignments = cells.map(cell => {
        const trimmed = cell.trim();
        if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
        if (trimmed.endsWith(':')) return 'right';
        return 'left';
      });
      endIndex += 2;
      rows.push(firstRowCells);
    } else {
      endIndex++;
      rows.push(firstRowCells);
    }
  } else {
    endIndex++;
    rows.push(firstRowCells);
  }

  // Parse remaining rows
  while (endIndex < lines.length) {
    const line = lines[endIndex];
    if (!line.includes('|')) break;
    
    const rowCells = parseTableRow(line);
    if (rowCells.length === 0) break;
    
    rows.push(rowCells);
    endIndex++;
  }

  // Build table node
  const tableRows: MarkdownNode[] = rows.map((cells, rowIndex) => ({
    id: generateId('tablerow'),
    type: 'tableRow',
    children: cells.map((cell, colIndex) => ({
      id: generateId('tablecell'),
      type: 'tableCell',
      align: alignments[colIndex] || 'left',
      children: cell.children || [],
    })),
  }));

  return {
    node: {
      id: generateId('table'),
      type: 'table',
      align: alignments,
      children: tableRows,
    },
    endIndex,
  };
};

/**
 * Parses a single table row
 */
const parseTableRow = (line: string): MarkdownNode[] => {
  const cells = line.split('|').filter((c, i, arr) => {
    // Remove empty cells at start and end
    if (i === 0 && !c.trim()) return false;
    if (i === arr.length - 1 && !c.trim()) return false;
    return true;
  });

  return cells.map(cell => ({
    id: generateId('tablecell'),
    type: 'tableCell',
    children: parseInline(cell.trim()),
  }));
};

/**
 * Parses a horizontal rule
 */
const parseHorizontalRule = (line: string): MarkdownNode | null => {
  const match = line.match(/^(\*\*\*|---|___)\s*$/);
  if (!match) return null;

  return {
    id: generateId('hr'),
    type: 'hr',
  };
};

// ─────────────────────────────────────────────────────────────
// INLINE PARSERS
// ─────────────────────────────────────────────────────────────

interface InlineMatch {
  type: MarkdownNodeType;
  match: RegExpMatchArray;
  content: string;
  extra?: Record<string, unknown>;
}

/**
 * Parses inline markdown elements
 */
const parseInline = (text: string): MarkdownNode[] => {
  const nodes: MarkdownNode[] = [];
  
  if (!text || !text.trim()) {
    return nodes;
  }

  // Find all inline matches
  const matches: InlineMatch[] = [];
  
  // Bold: **text** or __text__
  let match: RegExpMatchArray | null;
  const boldRegex = /\*\*(.+?)\*\*|__(.+?)__/g;
  while ((match = boldRegex.exec(text)) !== null) {
    matches.push({
      type: 'bold',
      match,
      content: match[1] || match[2],
    });
  }

  // Italic: *text* or _text_
  const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    matches.push({
      type: 'italic',
      match,
      content: match[1] || match[2],
    });
  }

  // Strikethrough: ~~text~~
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    matches.push({
      type: 'strikethrough',
      match,
      content: match[1],
    });
  }

  // Inline code: `code`
  const codeRegex = /`([^`]+)`/g;
  while ((match = codeRegex.exec(text)) !== null) {
    matches.push({
      type: 'code',
      match,
      content: match[1],
    });
  }

  // Link: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = linkRegex.exec(text)) !== null) {
    matches.push({
      type: 'link',
      match,
      content: match[1],
      extra: { href: match[2] },
    });
  }

  // Image: ![alt](src)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = imageRegex.exec(text)) !== null) {
    matches.push({
      type: 'image',
      match,
      content: match[1] || '',
      extra: { src: match[2], alt: match[1] || '' },
    });
  }

  // Sort matches by position
  matches.sort((a, b) => a.match.index! - b.match.index!);

  // Build nodes with text between matches
  let lastEnd = 0;
  const processedPositions = new Set<number>();

  for (const inlineMatch of matches) {
    const { type, match: m, content, extra } = inlineMatch;
    const start = m.index!;
    const end = start + m[0].length;

    // Skip overlapping matches
    if (start < lastEnd) continue;

    // Add text before match
    if (start > lastEnd) {
      const textContent = text.slice(lastEnd, start);
      if (textContent) {
        nodes.push({
          id: generateId('text'),
          type: 'text',
          content: textContent,
        });
      }
    }

    // Add matched node
    const node: MarkdownNode = {
      id: generateId(type),
      type,
      ...(type === 'image' || type === 'code' ? { content } : { children: parseInline(content) }),
      ...extra,
    };

    nodes.push(node);
    lastEnd = end;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    const remaining = text.slice(lastEnd);
    if (remaining) {
      nodes.push({
        id: generateId('text'),
        type: 'text',
        content: remaining,
      });
    }
  }

  return nodes.length > 0 ? nodes : [{ id: generateId('text'), type: 'text', content: text }];
};

// ─────────────────────────────────────────────────────────────
// MAIN PARSER
// ─────────────────────────────────────────────────────────────

export interface ParseOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Previous content for incremental parsing */
  previousContent?: string;
  /** Previous parsed content for cache */
  previousParsed?: ParsedContent;
}

/**
 * Parses markdown text into an AST
 */
export function parseMarkdown(
  text: string,
  options: ParseOptions = {}
): ParsedContent {
  const startTime = performance?.now?.() || Date.now();
  const { debug, previousContent, previousParsed } = options;

  // Check for cached result
  if (previousContent && previousParsed && previousContent === text) {
    return previousParsed;
  }

  // Reset ID counter for consistent IDs
  resetIdCounter();

  // Split into lines
  const lines = text.split('\n');
  const children: MarkdownNode[] = [];

  let i = 0;
  let inParagraph = false;
  let paragraphContent: string[] = [];

  const flushParagraph = () => {
    if (paragraphContent.length > 0) {
      children.push({
        id: generateId('paragraph'),
        type: 'paragraph',
        children: parseInline(paragraphContent.join(' ')),
      });
      paragraphContent = [];
      inParagraph = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (!line.trim()) {
      flushParagraph();
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      flushParagraph();
      const { node, endIndex } = parseCodeBlock(lines, i);
      children.push(node);
      i = endIndex;
      continue;
    }

    // Heading
    const heading = parseHeading(line);
    if (heading) {
      flushParagraph();
      children.push(heading);
      i++;
      continue;
    }

    // Blockquote
    const blockquote = parseBlockquote(line);
    if (blockquote) {
      flushParagraph();
      children.push(blockquote);
      i++;
      continue;
    }

    // Horizontal rule
    const hr = parseHorizontalRule(line);
    if (hr) {
      flushParagraph();
      children.push(hr);
      i++;
      continue;
    }

    // Table
    if (line.includes('|')) {
      const tableResult = parseTable(lines, i);
      if (tableResult) {
        flushParagraph();
        children.push(tableResult.node);
        i = tableResult.endIndex;
        continue;
      }
    }

    // List
    if (line.match(/^[\*\-\+]\s+/) || line.match(/^\d+\.\s+/)) {
      flushParagraph();
      const { node, endIndex } = parseList(lines, i);
      children.push(node);
      i = endIndex;
      continue;
    }

    // Regular text - collect into paragraphs
    paragraphContent.push(line);
    inParagraph = true;
    i++;
  }

  // Flush any remaining paragraph
  flushParagraph();

  // Build root node
  const root: MarkdownNode = {
    id: generateId('root'),
    type: 'root',
    children,
  };

  // Calculate stats
  const plainText = extractPlainText(root);
  const charCount = plainText.length;
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const hash = hashString(text);
  const parseTime = (performance?.now?.() || Date.now()) - startTime;

  if (debug) {
    console.log(`[MarkdownParser] Parsed ${charCount} chars in ${parseTime.toFixed(2)}ms`);
  }

  return {
    root,
    plainText,
    charCount,
    wordCount,
    hash,
    parseTime,
  };
}

/**
 * Extracts plain text from AST
 */
export function extractPlainText(node: MarkdownNode): string {
  if (node.content) {
    return node.content;
  }
  
  if (node.children) {
    return node.children.map(extractPlainText).join(' ');
  }
  
  return '';
}

// ─────────────────────────────────────────────────────────────
// INCREMENTAL PARSER
// ─────────────────────────────────────────────────────────────

export interface IncrementalParseResult {
  /** Full parsed content */
  parsed: ParsedContent;
  /** New nodes that were added */
  newNodes: MarkdownNode[];
  /** Whether this was a full re-parse */
  fullReparse: boolean;
}

/**
 * Incrementally parses markdown, only processing new content
 */
export function parseMarkdownIncremental(
  newContent: string,
  previousContent: string,
  previousParsed: ParsedContent | null
): IncrementalParseResult {
  // If no previous content or content is shorter, do full parse
  if (!previousContent || !previousParsed || newContent.length < previousContent.length) {
    return {
      parsed: parseMarkdown(newContent),
      newNodes: [],
      fullReparse: true,
    };
  }

  // Check if content was appended
  if (newContent.startsWith(previousContent)) {
    const deltaContent = newContent.slice(previousContent.length);
    
    // If delta is small enough, parse just the new content
    if (deltaContent.length < 1000) {
      const deltaParsed = parseMarkdown(deltaContent);
      
      // Merge nodes
      const newNodes = deltaParsed.root.children || [];
      const mergedChildren = [
        ...(previousParsed.root.children || []),
        ...newNodes,
      ];

      const mergedRoot: MarkdownNode = {
        id: previousParsed.root.id,
        type: 'root',
        children: mergedChildren,
      };

      return {
        parsed: {
          root: mergedRoot,
          plainText: previousParsed.plainText + ' ' + deltaParsed.plainText,
          charCount: previousParsed.charCount + deltaParsed.charCount,
          wordCount: previousParsed.wordCount + deltaParsed.wordCount,
          hash: hashString(newContent),
        },
        newNodes,
        fullReparse: false,
      };
    }
  }

  // Fall back to full parse
  return {
    parsed: parseMarkdown(newContent),
    newNodes: [],
    fullReparse: true,
  };
}

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export default {
  parseMarkdown,
  parseMarkdownIncremental,
  extractPlainText,
  generateId,
  hashString,
};