/**
 * 🔒 API LAYER TYPES
 * Production-grade type definitions
 */

// ─────────────────────────────────────────────────────────────
// TOKEN TYPES
// ─────────────────────────────────────────────────────────────
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
}

export interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: TokenPair): Promise<void>;
  clearTokens(): Promise<void>;
  isTokenExpired(): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────
export type ErrorType = 
  | 'AUTH' 
  | 'NETWORK' 
  | 'TIMEOUT' 
  | 'VALIDATION' 
  | 'SERVER' 
  | 'UNKNOWN';

export interface StructuredError {
  type: ErrorType;
  message: string;          // User-friendly message
  debugMessage: string;     // Technical details (dev only)
  status?: number;
  code?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// NETWORK TYPES
// ─────────────────────────────────────────────────────────────
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

export type NetworkListener = (state: NetworkState) => void;

// ─────────────────────────────────────────────────────────────
// CACHE TYPES
// ─────────────────────────────────────────────────────────────
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  etag?: string;
}

export interface CacheConfig {
  defaultTTL: number;       // Time to live in ms
  maxSize: number;          // Max entries
}

// ─────────────────────────────────────────────────────────────
// RETRY TYPES
// ─────────────────────────────────────────────────────────────
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
}

export interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

// ─────────────────────────────────────────────────────────────
// REQUEST TYPES
// ─────────────────────────────────────────────────────────────
export interface QueuedRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  data?: unknown;
  config?: RequestConfig;
  timestamp: number;
  attempts: number;
}

export interface RequestConfig {
  skipRetry?: boolean;
  skipCache?: boolean;
  timeout?: number;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

// ─────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  status: number;
  cached?: boolean;
  fromCache?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}