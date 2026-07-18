/**
 * 🌐 NETWORK ERROR
 * ================
 * Handles all network-related errors
 * Supports offline detection, timeout, and retry logic
 */

import { AppError } from './AppError';
import type { ErrorContext } from '../types';

/**
 * Network-specific error codes
 */
export type NetworkErrorCode =
  | 'NETWORK_OFFLINE'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_REQUEST_FAILED'
  | 'NETWORK_CONNECTION_REFUSED'
  | 'NETWORK_DNS_FAILED'
  | 'NETWORK_SSL_ERROR'
  | 'NETWORK_UNKNOWN';

/**
 * NetworkError - For all network-related failures
 */
export class NetworkError extends AppError {
  readonly code: NetworkErrorCode;
  readonly category = 'network' as const;
  readonly retryable: boolean;
  readonly httpStatus?: number;

  constructor(
    message: string,
    options?: {
      code?: NetworkErrorCode;
      httpStatus?: number;
      context?: ErrorContext;
      cause?: Error;
      retryable?: boolean;
    }
  ) {
    super(message, options);
    this.code = options?.code ?? 'NETWORK_UNKNOWN';
    this.httpStatus = options?.httpStatus;
    this.retryable = options?.retryable ?? this.determineRetryable();
  }

  /**
   * Create offline error
   */
  static offline(context?: ErrorContext): NetworkError {
    return new NetworkError(
      'You appear to be offline. Please check your connection and try again.',
      {
        code: 'NETWORK_OFFLINE',
        context,
        retryable: true,
      }
    );
  }

  /**
   * Create timeout error
   */
  static timeout(url: string, timeout: number, context?: ErrorContext): NetworkError {
    return new NetworkError(
      `Request timed out after ${timeout}ms`,
      {
        code: 'NETWORK_TIMEOUT',
        context: { url, timeout, ...context },
        retryable: true,
      }
    );
  }

  /**
   * Create request failed error
   */
  static requestFailed(
    url: string,
    reason: string,
    context?: ErrorContext
  ): NetworkError {
    return new NetworkError(
      `Request failed: ${reason}`,
      {
        code: 'NETWORK_REQUEST_FAILED',
        context: { url, reason, ...context },
        retryable: true,
      }
    );
  }

  /**
   * Create server error from HTTP status
   */
  static fromHttpStatus(status: number, message?: string, context?: ErrorContext): NetworkError {
    const code = this.getStatusErrorCode(status);
    const retryable = status >= 500 || status === 429;

    return new NetworkError(
      message ?? `Server returned status ${status}`,
      {
        code,
        httpStatus: status,
        context,
        retryable,
      }
    );
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    switch (this.code) {
      case 'NETWORK_OFFLINE':
        return 'You appear to be offline. Please check your connection.';
      case 'NETWORK_TIMEOUT':
        return 'The request took too long. Please try again.';
      case 'NETWORK_CONNECTION_REFUSED':
        return 'Unable to connect to the server. Please try again later.';
      case 'NETWORK_DNS_FAILED':
        return 'Could not find the server. Please check the URL.';
      case 'NETWORK_SSL_ERROR':
        return 'Secure connection failed. Please try again.';
      default:
        return 'A network error occurred. Please try again.';
    }
  }

  /**
   * Determine if error is retryable based on code
   */
  private determineRetryable(): boolean {
    const nonRetryableCodes: NetworkErrorCode[] = [
      'NETWORK_SSL_ERROR',
      'NETWORK_DNS_FAILED',
    ];
    return !nonRetryableCodes.includes(this.code);
  }

  /**
   * Map HTTP status to error code
   */
  private static getStatusErrorCode(status: number): NetworkErrorCode {
    if (status === 429) return 'NETWORK_REQUEST_FAILED';
    if (status >= 500) return 'NETWORK_REQUEST_FAILED';
    if (status === 408) return 'NETWORK_TIMEOUT';
    return 'NETWORK_REQUEST_FAILED';
  }
}

/**
 * Type guard for NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}