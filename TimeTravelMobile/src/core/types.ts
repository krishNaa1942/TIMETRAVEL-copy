/**
 * 🎯 CORE TYPES
 * =============
 * Central type definitions for the GOD-LEVEL architecture
 */

// ─────────────────────────────────────────────────────────────
// API Types
// ─────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestPriority = 'critical' | 'high' | 'normal' | 'low';

export interface RequestConfig {
  url: string;
  method?: HttpMethod;
  data?: unknown;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  timeout?: number;
  priority?: RequestPriority;
  skipCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  retries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
  cached?: boolean;
  timestamp: number;
}

export interface QueuedRequest extends RequestConfig {
  id: string;
  timestamp: number;
  attemptCount: number;
  lastAttempt?: number;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

export type ErrorCategory = 'network' | 'auth' | 'validation' | 'server' | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  [key: string]: unknown;
}

export interface ErrorInfo {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  retryable: boolean;
  timestamp: number;
  context: ErrorContext;
  stack?: string;
}

// ─────────────────────────────────────────────────────────────
// Cache Types
// ─────────────────────────────────────────────────────────────

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  size: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  staleWhileRevalidate?: boolean;
  persistent?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
  hitRate: number;
}

// ─────────────────────────────────────────────────────────────
// Network Types
// ─────────────────────────────────────────────────────────────

export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown' | 'none';

export type NetworkStatus = 'online' | 'offline' | 'reconnecting';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: ConnectionType;
  status: NetworkStatus;
  lastOnline?: number;
  lastOffline?: number;
}

export interface NetworkListener {
  (state: NetworkState): void;
}

// ─────────────────────────────────────────────────────────────
// Telemetry Types
// ─────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  tags?: string[];
}

export interface MetricEntry {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Token Types
// ─────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
}

// ─────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────

export type Environment = 'development' | 'staging' | 'production';

export interface AppConfig {
  environment: Environment;
  api: {
    baseURL: string;
    wsURL: string;
    timeout: number;
    retries: number;
  };
  cache: {
    maxSize: number;
    defaultTTL: number;
    persistent: boolean;
  };
  telemetry: {
    enabled: boolean;
    logLevel: LogLevel;
    crashReporting: boolean;
    analytics: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// Circuit Breaker Types
// ─────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailure?: number;
  nextAttempt?: number;
}