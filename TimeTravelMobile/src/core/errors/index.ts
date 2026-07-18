/**
 * 🛡️ ERROR SYSTEM - BARREL EXPORT
 * ===============================
 * Central export for all error types
 */

export { AppError } from './AppError';
export { NetworkError, isNetworkError } from './NetworkError';

// ─────────────────────────────────────────────────────────────
// Auth Error
// ─────────────────────────────────────────────────────────────

import { AppError } from './AppError';
import { NetworkError } from './NetworkError';
import type { ErrorContext, ErrorSeverity } from '../types';

export type AuthErrorCode =
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_USER_NOT_FOUND';

export class AuthError extends AppError {
  readonly code: AuthErrorCode;
  readonly category = 'auth' as const;
  readonly retryable = false;

  constructor(
    message: string,
    options?: {
      code?: AuthErrorCode;
      context?: ErrorContext;
      cause?: Error;
      severity?: ErrorSeverity;
    }
  ) {
    super(message, options);
    this.code = options?.code ?? 'AUTH_UNAUTHORIZED';
  }

  static tokenExpired(context?: ErrorContext): AuthError {
    return new AuthError('Your session has expired. Please log in again.', {
      code: 'AUTH_TOKEN_EXPIRED',
      context,
      severity: 'medium',
    });
  }

  static tokenInvalid(context?: ErrorContext): AuthError {
    return new AuthError('Invalid authentication token.', {
      code: 'AUTH_TOKEN_INVALID',
      context,
      severity: 'high',
    });
  }

  static unauthorized(context?: ErrorContext): AuthError {
    return new AuthError('You are not authorized to perform this action.', {
      code: 'AUTH_UNAUTHORIZED',
      context,
      severity: 'medium',
    });
  }

  static forbidden(context?: ErrorContext): AuthError {
    return new AuthError('Access denied.', {
      code: 'AUTH_FORBIDDEN',
      context,
      severity: 'medium',
    });
  }

  static invalidCredentials(context?: ErrorContext): AuthError {
    return new AuthError('Invalid email or password.', {
      code: 'AUTH_INVALID_CREDENTIALS',
      context,
      severity: 'low',
    });
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'AUTH_TOKEN_EXPIRED':
      case 'AUTH_SESSION_EXPIRED':
        return 'Your session has expired. Please log in again.';
      case 'AUTH_TOKEN_INVALID':
        return 'Invalid session. Please log in again.';
      case 'AUTH_INVALID_CREDENTIALS':
        return 'Invalid email or password.';
      case 'AUTH_FORBIDDEN':
        return 'Access denied.';
      default:
        return 'Authentication error. Please try again.';
    }
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

// ─────────────────────────────────────────────────────────────
// Validation Error
// ─────────────────────────────────────────────────────────────

export type ValidationErrorCode =
  | 'VALIDATION_REQUIRED'
  | 'VALIDATION_FORMAT'
  | 'VALIDATION_RANGE'
  | 'VALIDATION_LENGTH'
  | 'VALIDATION_CUSTOM';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
  constraint?: string;
}

export class ValidationError extends AppError {
  readonly code: ValidationErrorCode;
  readonly category = 'validation' as const;
  readonly retryable = false;
  readonly errors: ValidationErrorDetail[];

  constructor(
    message: string,
    errors: ValidationErrorDetail[],
    options?: {
      code?: ValidationErrorCode;
      context?: ErrorContext;
      cause?: Error;
    }
  ) {
    super(message, options);
    this.code = options?.code ?? 'VALIDATION_CUSTOM';
    this.errors = errors;
  }

  static required(fields: string[], context?: ErrorContext): ValidationError {
    const errors: ValidationErrorDetail[] = fields.map((field) => ({
      field,
      message: `${field} is required`,
    }));
    return new ValidationError('Validation failed: required fields missing', errors, {
      code: 'VALIDATION_REQUIRED',
      context,
    });
  }

  static invalidFormat(
    field: string,
    expectedFormat: string,
    context?: ErrorContext
  ): ValidationError {
    return new ValidationError(
      `Invalid format for ${field}`,
      [{ field, message: `Expected format: ${expectedFormat}` }],
      { code: 'VALIDATION_FORMAT', context }
    );
  }

  static outOfRange(
    field: string,
    min: number,
    max: number,
    context?: ErrorContext
  ): ValidationError {
    return new ValidationError(
      `${field} must be between ${min} and ${max}`,
      [{ field, message: `Range: ${min} - ${max}`, constraint: `${min}-${max}` }],
      { code: 'VALIDATION_RANGE', context }
    );
  }

  getUserMessage(): string {
    if (this.errors.length === 1) {
      return this.errors[0].message;
    }
    return `Please fix ${this.errors.length} validation errors.`;
  }

  getErrors(): ValidationErrorDetail[] {
    return this.errors;
  }

  getErrorsForField(field: string): ValidationErrorDetail[] {
    return this.errors.filter((e) => e.field === field);
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

// ─────────────────────────────────────────────────────────────
// Server Error
// ─────────────────────────────────────────────────────────────

export type ServerErrorCode =
  | 'SERVER_INTERNAL'
  | 'SERVER_UNAVAILABLE'
  | 'SERVER_TIMEOUT'
  | 'SERVER_RATE_LIMITED'
  | 'SERVER_MAINTENANCE';

export class ServerError extends AppError {
  readonly code: ServerErrorCode;
  readonly category = 'server' as const;
  readonly retryable: boolean;
  readonly httpStatus?: number;

  constructor(
    message: string,
    options?: {
      code?: ServerErrorCode;
      httpStatus?: number;
      context?: ErrorContext;
      cause?: Error;
      retryable?: boolean;
    }
  ) {
    super(message, options);
    this.code = options?.code ?? 'SERVER_INTERNAL';
    this.httpStatus = options?.httpStatus;
    this.retryable = options?.retryable ?? this.determineRetryable();
  }

  static internal(context?: ErrorContext): ServerError {
    return new ServerError('An internal server error occurred.', {
      code: 'SERVER_INTERNAL',
      context,
      retryable: true,
    });
  }

  static unavailable(context?: ErrorContext): ServerError {
    return new ServerError('Service temporarily unavailable.', {
      code: 'SERVER_UNAVAILABLE',
      context,
      retryable: true,
    });
  }

  static rateLimited(retryAfter?: number, context?: ErrorContext): ServerError {
    return new ServerError('Too many requests. Please slow down.', {
      code: 'SERVER_RATE_LIMITED',
      context: { retryAfter, ...context },
      retryable: true,
    });
  }

  static maintenance(context?: ErrorContext): ServerError {
    return new ServerError('Server is under maintenance.', {
      code: 'SERVER_MAINTENANCE',
      context,
      retryable: false,
    });
  }

  static fromStatus(status: number, message?: string, context?: ErrorContext): ServerError {
    const code: ServerErrorCode = status === 429 ? 'SERVER_RATE_LIMITED' :
                                  status === 503 ? 'SERVER_UNAVAILABLE' :
                                  status >= 500 ? 'SERVER_INTERNAL' : 'SERVER_INTERNAL';
    return new ServerError(message ?? `Server error (${status})`, {
      code,
      httpStatus: status,
      context,
      retryable: status >= 500 || status === 429,
    });
  }

  private determineRetryable(): boolean {
    return this.code !== 'SERVER_MAINTENANCE';
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'SERVER_RATE_LIMITED':
        return 'Too many requests. Please wait a moment.';
      case 'SERVER_UNAVAILABLE':
        return 'Service temporarily unavailable. Please try again.';
      case 'SERVER_MAINTENANCE':
        return 'Server is under maintenance. Please check back later.';
      default:
        return 'A server error occurred. Please try again.';
    }
  }
}

export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError;
}

// ─────────────────────────────────────────────────────────────
// Error Handler Utility
// ─────────────────────────────────────────────────────────────

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common error types
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return NetworkError.requestFailed('unknown', error.message, { cause: error });
    }
    
    if (message.includes('timeout')) {
      return NetworkError.timeout('unknown', 0, { cause: error });
    }

    return new (class extends AppError {
      readonly code = 'UNKNOWN_ERROR';
      readonly category = 'unknown' as const;
      readonly retryable = false;
    })('An unexpected error occurred', { cause: error });
  }

  return new (class extends AppError {
    readonly code = 'UNKNOWN_ERROR';
    readonly category = 'unknown' as const;
    readonly retryable = false;
  })('An unknown error occurred');
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.getUserMessage();
  }
  if (error instanceof Error) {
    return error.message || 'An error occurred';
  }
  return 'An unexpected error occurred';
}