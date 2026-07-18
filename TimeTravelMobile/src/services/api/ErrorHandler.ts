/**
 * ⚠️ ERROR HANDLER
 * Structured error classification and handling
 * 
 * Features:
 * - Structured error types (Auth, Network, Validation, Server)
 * - User-friendly messages
 * - Retry classification
 * - Error logging (production-safe)
 */

import { ErrorType, StructuredError } from './types';
import { AxiosError } from 'axios';

// ─────────────────────────────────────────────────────────────
// ERROR CLASSIFICATIONS
// ─────────────────────────────────────────────────────────────
const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT: 'Request took too long. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You don\'t have permission to access this.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again later.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

const STATUS_CODE_MAP: Record<number, ErrorType> = {
  400: 'VALIDATION',
  401: 'AUTH',
  403: 'AUTH',
  404: 'NETWORK',
  408: 'TIMEOUT',
  429: 'NETWORK',
  500: 'SERVER',
  502: 'SERVER',
  503: 'SERVER',
  504: 'TIMEOUT',
};

const RETRYABLE_TYPES: ErrorType[] = ['NETWORK', 'TIMEOUT', 'SERVER'];

// ─────────────────────────────────────────────────────────────
// ERROR HANDLER CLASS
// ─────────────────────────────────────────────────────────────
class ErrorHandler {
  private errorListeners: Set<(error: StructuredError) => void> = new Set();

  /**
   * Normalize any error to StructuredError
   */
  normalize(error: unknown): StructuredError {
    // Already structured
    if (this.isStructuredError(error)) {
      return error;
    }

    // Axios error
    if (this.isAxiosError(error)) {
      return this.normalizeAxiosError(error);
    }

    // Standard Error
    if (error instanceof Error) {
      return this.normalizeError(error);
    }

    // Unknown
    return {
      type: 'UNKNOWN',
      message: USER_FRIENDLY_MESSAGES.UNKNOWN,
      debugMessage: String(error),
      retryable: false,
    };
  }

  /**
   * Check if already structured
   */
  private isStructuredError(error: unknown): error is StructuredError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'message' in error &&
      'retryable' in error
    );
  }

  /**
   * Check if Axios error
   */
  private isAxiosError(error: unknown): error is AxiosError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error
    );
  }

  /**
   * Normalize Axios error
   */
  private normalizeAxiosError(error: AxiosError): StructuredError {
    const status = error.response?.status || 0;
    const responseData = error.response?.data as Record<string, unknown> | undefined;

    // Network error (no response)
    if (!error.response) {
      return {
        type: 'NETWORK',
        message: USER_FRIENDLY_MESSAGES.NETWORK_ERROR,
        debugMessage: error.message || 'Network error - no response',
        code: error.code,
        retryable: true,
      };
    }

    // Timeout
    if (error.code === 'ECONNABORTED' || status === 408) {
      return {
        type: 'TIMEOUT',
        message: USER_FRIENDLY_MESSAGES.TIMEOUT,
        debugMessage: 'Request timeout',
        status,
        retryable: true,
      };
    }

    // Determine type from status
    const type = STATUS_CODE_MAP[status] || 'UNKNOWN';
    const message = this.extractMessage(responseData) || USER_FRIENDLY_MESSAGES[type] || USER_FRIENDLY_MESSAGES.UNKNOWN;

    return {
      type,
      message,
      debugMessage: `${error.config?.method?.toUpperCase()} ${error.config?.url} - ${status}`,
      status,
      details: responseData,
      retryable: RETRYABLE_TYPES.includes(type),
    };
  }

  /**
   * Normalize standard Error
   */
  private normalizeError(error: Error): StructuredError {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('connect')) {
      return {
        type: 'NETWORK',
        message: USER_FRIENDLY_MESSAGES.NETWORK_ERROR,
        debugMessage: error.message,
        retryable: true,
      };
    }

    if (message.includes('timeout')) {
      return {
        type: 'TIMEOUT',
        message: USER_FRIENDLY_MESSAGES.TIMEOUT,
        debugMessage: error.message,
        retryable: true,
      };
    }

    return {
      type: 'UNKNOWN',
      message: USER_FRIENDLY_MESSAGES.UNKNOWN,
      debugMessage: error.message,
      retryable: false,
    };
  }

  /**
   * Extract message from response data
   */
  private extractMessage(data: Record<string, unknown> | undefined): string | null {
    if (!data) return null;

    if (typeof data.error === 'string') return data.error;
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.details)) return data.details.join('. ');

    return null;
  }

  /**
   * Subscribe to errors
   */
  subscribe(listener: (error: StructuredError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  notify(error: StructuredError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        this.logError('Listener error', e);
      }
    });
  }

  /**
   * Handle and log error
   */
  handle(error: unknown): StructuredError {
    const structured = this.normalize(error);
    
    // Log in development
    if (__DEV__) {
      console.error('⚠️ [ErrorHandler]', {
        type: structured.type,
        message: structured.message,
        debug: structured.debugMessage,
        retryable: structured.retryable,
      });
    }

    // Notify listeners (for analytics, crash reporting)
    this.notify(structured);

    return structured;
  }

  private logError(message: string, error: unknown): void {
    if (__DEV__) {
      console.error(`⚠️❌ [ErrorHandler] ${message}`, error);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────
export const errorHandler = new ErrorHandler();
export default errorHandler;