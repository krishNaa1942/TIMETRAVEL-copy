/**
 * 🔒 URL VALIDATOR UTILITY
 * =========================
 * Security-focused URL validation and sanitization
 * 
 * @version 2.0.0
 */

import { URLValidationResult, SecurityError } from '../types';

// ─────────────────────────────────────────────────────────────
// ALLOWED PROTOCOLS
// ─────────────────────────────────────────────────────────────

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
  'blob:',
];

// ─────────────────────────────────────────────────────────────
// BLOCKED PATTERNS
// ─────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /javascript:/i,
  /vbscript:/i,
  /data:text\/html/i,
  /on\w+\s*=/i, // Event handlers like onclick=
  /<script/i,
  /<\/script>/i,
  /eval\s*\(/i,
  /expression\s*\(/i,
];

// ─────────────────────────────────────────────────────────────
// KNOWN SAFE DOMAINS (whitelist for internal links)
// ─────────────────────────────────────────────────────────────

const INTERNAL_DOMAINS: string[] = [
  // Add your app's domains here
  'localhost',
  '127.0.0.1',
];

// ─────────────────────────────────────────────────────────────
// URL VALIDATION FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Validates and sanitizes a URL
 */
export function validateURL(url: string): URLValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Trim and normalize
  const trimmedUrl = url.trim();

  // Check for empty string
  if (!trimmedUrl) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  // Check for dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmedUrl)) {
      return { valid: false, error: 'URL contains blocked content' };
    }
  }

  // Handle relative URLs
  if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('./')) {
    return {
      valid: true,
      sanitized: trimmedUrl,
      isExternal: false,
    };
  }

  // Handle anchor links
  if (trimmedUrl.startsWith('#')) {
    return {
      valid: true,
      sanitized: trimmedUrl,
      isExternal: false,
    };
  }

  // Handle mailto and tel links
  if (trimmedUrl.startsWith('mailto:') || trimmedUrl.startsWith('tel:')) {
    const protocol = trimmedUrl.split(':')[0] + ':';
    return {
      valid: true,
      sanitized: trimmedUrl,
      isExternal: true,
      protocol,
    };
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    // Add protocol if missing
    const urlWithProtocol = trimmedUrl.match(/^https?:\/\//)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    parsedUrl = new URL(urlWithProtocol);
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Check protocol
  if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
    return {
      valid: false,
      error: `Protocol "${parsedUrl.protocol}" is not allowed`,
    };
  }

  // Double-check for dangerous protocols
  if (DANGEROUS_PROTOCOLS.includes(parsedUrl.protocol)) {
    return {
      valid: false,
      error: 'Potentially dangerous protocol detected',
    };
  }

  const domain = parsedUrl.hostname;

  return {
    valid: true,
    sanitized: parsedUrl.href,
    isExternal: !INTERNAL_DOMAINS.includes(domain),
    protocol: parsedUrl.protocol,
    domain,
  };
}

/**
 * Sanitizes a URL by removing dangerous content
 */
export function sanitizeURL(url: string): string {
  const result = validateURL(url);
  return result.valid && result.sanitized ? result.sanitized : '';
}

/**
 * Checks if a URL is safe to open
 */
export function isURLSafe(url: string): boolean {
  return validateURL(url).valid;
}

/**
 * Extracts domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsedUrl.hostname;
  } catch {
    return null;
  }
}

/**
 * Checks if URL is external
 */
export function isExternalURL(url: string): boolean {
  const result = validateURL(url);
  return result.valid ? (result.isExternal ?? true) : false;
}

/**
 * Gets URL display text (truncates long URLs)
 */
export function getURLDisplayText(url: string, maxLength: number = 50): string {
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    const displayText = parsedUrl.hostname + parsedUrl.pathname;
    
    if (displayText.length <= maxLength) {
      return displayText;
    }
    
    return displayText.substring(0, maxLength - 3) + '...';
  } catch {
    return url.length > maxLength ? url.substring(0, maxLength - 3) + '...' : url;
  }
}

// ─────────────────────────────────────────────────────────────
// LINK VALIDATION HOOK HELPER
// ─────────────────────────────────────────────────────────────

export interface LinkValidationOptions {
  /** Whether to allow external links */
  allowExternal?: boolean;
  /** Whether to show confirmation for external links */
  confirmExternal?: boolean;
  /** Custom blocked domains */
  blockedDomains?: string[];
  /** Custom allowed domains */
  allowedDomains?: string[];
}

/**
 * Validates link with custom options
 */
export function validateLinkWithOptions(
  url: string,
  options: LinkValidationOptions = {}
): URLValidationResult & { shouldConfirm?: boolean } {
  const {
    allowExternal = true,
    confirmExternal = true,
    blockedDomains = [],
    allowedDomains = [],
  } = options;

  // Basic validation
  const result = validateURL(url);
  
  if (!result.valid) {
    return result;
  }

  // Check blocked domains
  if (result.domain && blockedDomains.length > 0) {
    if (blockedDomains.some(d => result.domain === d || result.domain?.endsWith(`.${d}`))) {
      return {
        valid: false,
        error: 'Domain is blocked',
      };
    }
  }

  // Check if external links are allowed
  if (!allowExternal && result.isExternal) {
    return {
      valid: false,
      error: 'External links are not allowed',
    };
  }

  // Check allowed domains whitelist (if specified)
  if (allowedDomains.length > 0 && result.domain) {
    const isAllowed = allowedDomains.some(
      d => result.domain === d || result.domain?.endsWith(`.${d}`)
    );
    if (!isAllowed) {
      return {
        valid: false,
        error: 'Domain is not in allowed list',
      };
    }
  }

  return {
    ...result,
    shouldConfirm: confirmExternal && result.isExternal,
  };
}

// ─────────────────────────────────────────────────────────────
// SAFE LINK HANDLER
// ─────────────────────────────────────────────────────────────

import { Linking, Alert, Platform } from 'react-native';

export interface OpenLinkOptions {
  /** Show confirmation dialog for external links */
  confirmExternal?: boolean;
  /** Custom confirmation message */
  confirmMessage?: string;
  /** Custom confirmation title */
  confirmTitle?: string;
  /** Callback on successful open */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Safely opens a URL with validation and optional confirmation
 */
export async function openLinkSafely(
  url: string,
  options: OpenLinkOptions = {}
): Promise<boolean> {
  const {
    confirmExternal = true,
    confirmMessage = 'This link will open in your browser. Continue?',
    confirmTitle = 'Open External Link',
    onSuccess,
    onError,
  } = options;

  // Validate URL
  const validation = validateURL(url);
  
  if (!validation.valid) {
    const error = new SecurityError(`Invalid URL: ${validation.error}`);
    onError?.(error);
    console.warn('Blocked unsafe URL:', url, validation.error);
    return false;
  }

  const sanitizedURL = validation.sanitized!;

  // Check if confirmation is needed
  if (confirmExternal && validation.isExternal) {
    return new Promise((resolve) => {
      Alert.alert(
        confirmTitle,
        confirmMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Open',
            style: 'default',
            onPress: async () => {
              try {
                const canOpen = await Linking.canOpenURL(sanitizedURL);
                if (canOpen) {
                  await Linking.openURL(sanitizedURL);
                  onSuccess?.();
                  resolve(true);
                } else {
                  throw new Error('Cannot open URL');
                }
              } catch (error) {
                onError?.(error as Error);
                resolve(false);
              }
            },
          },
        ],
        { cancelable: true }
      );
    });
  }

  // Open directly
  try {
    const canOpen = await Linking.canOpenURL(sanitizedURL);
    if (canOpen) {
      await Linking.openURL(sanitizedURL);
      onSuccess?.();
      return true;
    } else {
      throw new Error('Cannot open URL');
    }
  } catch (error) {
    onError?.(error as Error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export default {
  validateURL,
  sanitizeURL,
  isURLSafe,
  extractDomain,
  isExternalURL,
  getURLDisplayText,
  validateLinkWithOptions,
  openLinkSafely,
};