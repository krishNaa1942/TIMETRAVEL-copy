/**
 * 🎯 ENTERPRISE API TYPES
 * Complete type definitions for production API layer
 */

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT CONFIG
// ─────────────────────────────────────────────────────────────

export type Environment = 'development' | 'staging' | 'production';

export interface ApiConfig {
  environment: Environment;
  baseUrl: string;
  timeout: number;
  enableLogging: boolean;
  enableAnalytics: boolean;
  retryAttempts: number;
  circuitBreakerThreshold: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

// ─────────────────────────────────────────────────────────────
// TOKEN TYPES
// ─────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType?: string;
}

export interface TokenStorage {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface DecodedToken {
  sub: string;
  exp: number;
  iat: number;
  userId?: string;
  email?: string;
  role?: string;
  permissions?: string[];
}

// ─────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────

export type ErrorCategory = 
  | 'AUTH' 
  | 'NETWORK' 
  | 'TIMEOUT' 
  | 'VALIDATION' 
  | 'SERVER' 
  | 'UNKNOWN';

export interface StructuredError {
  id: string;
  category: ErrorCategory;
  code: string;
  message: string;
  userMessage: string;
  debugMessage: string;
  status?: number;
  retryable: boolean;
  timestamp: number;
  requestId?: string;
  details?: Record<string, unknown>;
  stack?: string;
}

// ─────────────────────────────────────────────────────────────
// NETWORK TYPES
// ─────────────────────────────────────────────────────────────

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isConnectionExpensive: boolean;
}

export type NetworkListener = (state: NetworkState) => void;

// ─────────────────────────────────────────────────────────────
// CACHE TYPES
// ─────────────────────────────────────────────────────────────

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  lastModified?: string;
  tags: string[];
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  staleWhileRevalidate: boolean;
  persistentStorage: boolean;
}

// ─────────────────────────────────────────────────────────────
// RETRY TYPES
// ─────────────────────────────────────────────────────────────

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
  retryableStatusCodes: number[];
  retryableMethods: HttpMethod[];
}

export interface RetryState {
  attempt: number;
  totalDelay: number;
  lastError: Error | null;
}

// ─────────────────────────────────────────────────────────────
// CIRCUIT BREAKER TYPES
// ─────────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  openDuration: number;
  halfOpenMaxRequests: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastStateChange: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

// ─────────────────────────────────────────────────────────────
// REQUEST TYPES
// ─────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RequestConfig {
  skipAuth?: boolean;
  skipRetry?: boolean;
  skipCache?: boolean;
  skipDedup?: boolean;
  timeout?: number;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  requestId?: string;
  cacheKey?: string;
  cacheTTL?: number;
  cacheTags?: string[];
  retryAttempts?: number;
  abortSignal?: AbortSignal;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
}

export interface QueuedRequest {
  id: string;
  method: HttpMethod;
  path: string;
  data?: unknown;
  config?: RequestConfig;
  timestamp: number;
  attempts: number;
  idempotencyKey?: string;
  lastError?: string;
}

export interface PendingRequest {
  id: string;
  controller: AbortController;
  config: RequestConfig;
  promise: Promise<ApiResponse<unknown>>;
}

// ─────────────────────────────────────────────────────────────
// RESPONSE TYPES
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers?: Record<string, string>;
  fromCache?: boolean;
  requestId?: string;
  duration?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// DEDUPLICATION TYPES
// ─────────────────────────────────────────────────────────────

export interface DedupeKey {
  method: HttpMethod;
  path: string;
  dataHash?: string;
}

export interface DedupeEntry {
  key: string;
  promise: Promise<ApiResponse<unknown>>;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// OBSERVABILITY TYPES
// ─────────────────────────────────────────────────────────────

export interface RequestMetric {
  requestId: string;
  method: HttpMethod;
  path: string;
  status: number;
  duration: number;
  cached: boolean;
  retryCount: number;
  error?: StructuredError;
  timestamp: number;
}

export interface PerformanceStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  cacheHitRate: number;
  errorRate: number;
}

export type MetricListener = (metric: RequestMetric) => void;

// ─────────────────────────────────────────────────────────────
// EVENT TYPES
// ─────────────────────────────────────────────────────────────

export type ApiEventType = 
  | 'token:refresh:start'
  | 'token:refresh:success'
  | 'token:refresh:failure'
  | 'token:expired'
  | 'auth:logout'
  | 'network:offline'
  | 'network:online'
  | 'circuit:open'
  | 'circuit:half_open'
  | 'circuit:closed'
  | 'request:queued'
  | 'request:replayed'
  | 'cache:invalidated';

export interface ApiEvent {
  type: ApiEventType;
  timestamp: number;
  data?: unknown;
}

export type ApiEventListener = (event: ApiEvent) => void;

// ─────────────────────────────────────────────────────────────
// FILE UPLOAD TYPES
// ─────────────────────────────────────────────────────────────

export interface UploadFile {
  uri: string;
  type: string;
  name: string;
  size?: number;
}

export interface UploadConfig extends RequestConfig {
  file: UploadFile;
  fieldName?: string;
  additionalData?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// VALIDATION TYPES
// ─────────────────────────────────────────────────────────────

// Generic validation schema type (compatible with Zod, Yup, etc.)
export type ValidationSchema = {
  parse: (data: unknown) => unknown;
  safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown };
};

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

// ─────────────────────────────────────────────────────────────
// FEATURE FLAGS
// ─────────────────────────────────────────────────────────────

export interface FeatureFlags {
  apiVersion: 'v1' | 'v2';
  enableCaching: boolean;
  enableDeduplication: boolean;
  enableOfflineQueue: boolean;
  enableCircuitBreaker: boolean;
  enableRequestTracing: boolean;
}

// ─────────────────────────────────────────────────────────────
// BACKGROUND SYNC TYPES
// ─────────────────────────────────────────────────────────────

export interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  persistQueue: boolean;
  syncOnAppResume: boolean;
  syncOnNetworkReconnect: boolean;
}

export interface SyncStatus {
  pending: number;
  failed: number;
  syncing: boolean;
  lastSync: number | null;
}