/**
 * Error Handler Utility
 * Centralized error handling with retry logic, categorization, and user-friendly messages
 */

import { AxiosError } from "axios";

// ─────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────

export enum ErrorCategory {
  NETWORK = "NETWORK",
  TIMEOUT = "TIMEOUT",
  AUTH = "AUTH",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION = "VALIDATION",
  SERVER = "SERVER",
  RATE_LIMIT = "RATE_LIMIT",
  UNKNOWN = "UNKNOWN",
}

export interface AppError {
  message: string;
  category: ErrorCategory;
  originalError?: any;
  retryable: boolean;
  userMessage: string;
  statusCode?: number;
}

// ─────────────────────────────────────────────────────────────
// ERROR CATEGORIZATION
// ─────────────────────────────────────────────────────────────

export function categorizeError(error: any): AppError {
  // Axios errors
  if (error instanceof AxiosError || error?.isAxiosError) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    
    // No response = network error
    if (!axiosError.response) {
      return {
        message: "Network connection failed",
        category: ErrorCategory.NETWORK,
        originalError: error,
        retryable: true,
        userMessage: "Unable to connect. Please check your internet connection and try again.",
      };
    }
    
    // Timeout
    if (axiosError.code === "ECONNABORTED" || status === 408) {
      return {
        message: "Request timed out",
        category: ErrorCategory.TIMEOUT,
        originalError: error,
        retryable: true,
        userMessage: "The request took too long. Please try again.",
        statusCode: 408,
      };
    }
    
    // Auth errors
    if (status === 401 || status === 403) {
      return {
        message: "Authentication failed",
        category: ErrorCategory.AUTH,
        originalError: error,
        retryable: false,
        userMessage: "Your session has expired. Please log in again.",
        statusCode: status,
      };
    }
    
    // Not found
    if (status === 404) {
      return {
        message: "Resource not found",
        category: ErrorCategory.NOT_FOUND,
        originalError: error,
        retryable: false,
        userMessage: "The requested information could not be found.",
        statusCode: 404,
      };
    }
    
    // Rate limit
    if (status === 429) {
      return {
        message: "Rate limit exceeded",
        category: ErrorCategory.RATE_LIMIT,
        originalError: error,
        retryable: true,
        userMessage: "Too many requests. Please wait a moment and try again.",
        statusCode: 429,
      };
    }
    
    // Validation errors
    if (status === 400 || status === 422) {
      const data = axiosError.response?.data as any;
      return {
        message: data?.message || "Validation error",
        category: ErrorCategory.VALIDATION,
        originalError: error,
        retryable: false,
        userMessage: data?.message || "Please check your input and try again.",
        statusCode: status,
      };
    }
    
    // Server errors
    if (status && status >= 500) {
      return {
        message: "Server error",
        category: ErrorCategory.SERVER,
        originalError: error,
        retryable: true,
        userMessage: "Our servers are having issues. Please try again later.",
        statusCode: status,
      };
    }
    
    // Other HTTP errors
    return {
      message: `HTTP error ${status}`,
      category: ErrorCategory.UNKNOWN,
      originalError: error,
      retryable: true,
      userMessage: "Something went wrong. Please try again.",
      statusCode: status,
    };
  }
  
  // Custom AppError (already categorized)
  if (error?.category && Object.values(ErrorCategory).includes(error.category)) {
    return error as AppError;
  }
  
  // Generic Error
  if (error instanceof Error) {
    return {
      message: error.message,
      category: ErrorCategory.UNKNOWN,
      originalError: error,
      retryable: true,
      userMessage: error.message || "An unexpected error occurred. Please try again.",
    };
  }
  
  // Unknown error type
  return {
    message: "Unknown error",
    category: ErrorCategory.UNKNOWN,
    originalError: error,
    retryable: true,
    userMessage: "Something went wrong. Please try again.",
  };
}

// ─────────────────────────────────────────────────────────────
// RETRY LOGIC
// ─────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: AppError) => boolean;
  onRetry?: (attempt: number, error: AppError) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: AppError | null = null;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = categorizeError(error);
      
      // Check if we should retry
      const shouldRetry = config.shouldRetry 
        ? config.shouldRetry(lastError)
        : lastError.retryable;
      
      if (!shouldRetry || attempt >= config.maxAttempts) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5);
      
      // Callback
      if (options.onRetry) {
        options.onRetry(attempt, lastError);
      }
      
      console.log(`[Retry] Attempt ${attempt}/${config.maxAttempts} failed, retrying in ${Math.round(jitteredDelay)}ms`);
      
      await sleep(jitteredDelay);
    }
  }
  
  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// REQUEST WITH TIMEOUT & CANCELLATION
// ─────────────────────────────────────────────────────────────

export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────
// PARALLEL EXECUTION WITH FALLBACK
// ─────────────────────────────────────────────────────────────

export interface ParallelOptions {
  failFast?: boolean; // If true, reject immediately on first error
  fallbacks?: Record<string, any>; // Fallback values for failed requests
}

export async function parallelFetch<T extends Record<string, any>>(
  requests: Record<keyof T, () => Promise<any>>,
  options: ParallelOptions = {}
): Promise<Partial<T>> {
  const { failFast = false, fallbacks = {} } = options;
  
  const entries = Object.entries(requests) as [string, () => Promise<any>][];
  
  if (failFast) {
    // Use Promise.all for fail-fast behavior
    const results = await Promise.all(
      entries.map(async ([key, fn]) => [key, await fn()])
    );
    return Object.fromEntries(results) as T;
  }
  
  // Use Promise.allSettled for graceful degradation
  const results = await Promise.allSettled(
    entries.map(async ([key, fn]) => {
      try {
        return [key, await fn()];
      } catch (error) {
        if (key in fallbacks) {
          return [key, fallbacks[key]];
        }
        throw error;
      }
    })
  );
  
  const output: Partial<T> = {};
  
  results.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === "fulfilled") {
      output[key as keyof T] = result.value[1];
    } else if (key in fallbacks) {
      output[key as keyof T] = fallbacks[key];
    } else {
      console.warn(`[Parallel] Request "${key}" failed:`, result.reason);
    }
  });
  
  return output;
}

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createAbortController(): AbortController {
  return new AbortController();
}

export function isAbortedError(error: any): boolean {
  return error?.name === "AbortError" || error?.code === "ABORTED";
}

// ─────────────────────────────────────────────────────────────
// ERROR BOUNDARY HELPER
// ─────────────────────────────────────────────────────────────

export function getErrorInfo(error: any): {
  title: string;
  message: string;
  action?: string;
} {
  const appError = categorizeError(error);
  
  switch (appError.category) {
    case ErrorCategory.NETWORK:
      return {
        title: "Connection Error",
        message: appError.userMessage,
        action: "Retry",
      };
    case ErrorCategory.TIMEOUT:
      return {
        title: "Request Timeout",
        message: appError.userMessage,
        action: "Retry",
      };
    case ErrorCategory.AUTH:
      return {
        title: "Session Expired",
        message: appError.userMessage,
        action: "Log In",
      };
    case ErrorCategory.NOT_FOUND:
      return {
        title: "Not Found",
        message: appError.userMessage,
        action: undefined,
      };
    case ErrorCategory.RATE_LIMIT:
      return {
        title: "Too Many Requests",
        message: appError.userMessage,
        action: "Wait & Retry",
      };
    case ErrorCategory.SERVER:
      return {
        title: "Server Error",
        message: appError.userMessage,
        action: "Retry Later",
      };
    default:
      return {
        title: "Oops!",
        message: appError.userMessage,
        action: "Retry",
      };
  }
}

export default {
  categorizeError,
  withRetry,
  withTimeout,
  parallelFetch,
  sleep,
  createAbortController,
  isAbortedError,
  getErrorInfo,
  ErrorCategory,
};