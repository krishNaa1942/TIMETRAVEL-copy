/**
 * 🛡️ APP ERROR - BASE ERROR CLASS
 * ================================
 * Abstract base class for all application errors
 * Provides structured error handling with categorization
 */

import type { ErrorCategory, ErrorSeverity, ErrorContext, ErrorInfo } from '../types';

/**
 * Base application error class
 * All custom errors should extend this class
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  abstract readonly retryable: boolean;

  readonly severity: ErrorSeverity = 'medium';
  readonly timestamp: number;
  readonly context: ErrorContext;
  readonly originalError?: Error;

  constructor(
    message: string,
    options?: {
      context?: ErrorContext;
      cause?: Error;
      severity?: ErrorSeverity;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.timestamp = Date.now();
    this.context = options?.context ?? {};
    this.originalError = options?.cause;
    if (options?.severity) {
      this.severity = options.severity;
    }

    // Maintains proper stack trace for where error was thrown (only in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to plain object for logging/serialization
   */
  toJSON(): ErrorInfo {
    return {
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      retryable: this.retryable,
      timestamp: this.timestamp,
      context: this.sanitizeContext(this.context),
      stack: this.stack,
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.message;
  }

  /**
   * Check if error is of a specific type
   */
  is<T extends AppError>(errorClass: new (...args: unknown[]) => T): this is T {
    return this instanceof errorClass;
  }

  /**
   * Sanitize context for logging (remove sensitive data)
   */
  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}