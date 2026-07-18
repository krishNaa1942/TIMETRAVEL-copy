/**
 * 🏗️ CORE INFRASTRUCTURE - BARREL EXPORT
 * ======================================
 * Production-grade infrastructure for TimeTravel Mobile
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Cache
  CacheEntry,
  CacheOptions,
  CacheStats,
  
  // Network
  NetworkState,
  NetworkStatus,
  ConnectionType,
  NetworkListener,
  
  // API
  RequestConfig,
  ApiResponse,
  HttpMethod,
  CircuitState,
  QueuedRequest,
  
  // Error
  ErrorContext,
  ErrorSeverity,
  ErrorCategory,
} from './types';

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export {
  // Base
  AppError,
  
  // Network
  NetworkError,
  isNetworkError,
  
  // Auth
  AuthError,
  isAuthError,
  
  // Validation
  ValidationError,
  isValidationError,
  
  // Server
  ServerError,
  isServerError,
  
  // Utilities
  toAppError,
  isRetryable,
  getUserMessage,
} from './errors';

// ─────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────

import { CacheManager, getCacheManager, resetCacheManager } from './cache/CacheManager';
export { CacheManager, getCacheManager, resetCacheManager };

// ─────────────────────────────────────────────────────────────
// Network
// ─────────────────────────────────────────────────────────────

import { NetworkManager, getNetworkManager, resetNetworkManager } from './network/NetworkManager';
export { NetworkManager, getNetworkManager, resetNetworkManager };

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

import { ApiOrchestrator, getApiOrchestrator, resetApiOrchestrator } from './api/ApiOrchestrator';
export { ApiOrchestrator, getApiOrchestrator, resetApiOrchestrator };

// ─────────────────────────────────────────────────────────────
// Streaming
// ─────────────────────────────────────────────────────────────

export {
  StreamingManager,
  SSEParser,
  getStreamingManager,
  resetStreamingManager,
  useStreaming,
  useItineraryStreaming,
  useChatStreaming,
  type StreamConfig,
  type StreamOptions,
  type StreamState,
  type StreamMetrics,
  type ItineraryStreamRequest,
  type ItineraryStreamProgress,
  type ChatStreamRequest,
  type ChatStreamProgress,
} from './streaming';

// ─────────────────────────────────────────────────────────────
// Offline
// ─────────────────────────────────────────────────────────────

export {
  SyncQueue,
  getSyncQueue,
  resetSyncQueue,
  OfflineManager,
  getOfflineManager,
  resetOfflineManager,
  type SyncAction,
  type SyncActionType,
  type SyncPriority,
  type SyncResult,
  type OfflineState,
} from './offline';

// ─────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────

export {
  Logger,
  createLogger,
  Metrics,
  getMetrics,
  resetMetrics,
  Analytics,
  getAnalytics,
  resetAnalytics,
  Telemetry,
  getTelemetry,
  resetTelemetry,
  DEFAULT_TELEMETRY_CONFIG,
  type LogLevel,
  type LogEntry,
  type DeviceInfo,
  type MetricEntry,
  type ApiMetric,
  type CacheMetric,
  type PerformanceMetric,
  type AnalyticsEvent,
  type ScreenViewEvent,
  type UserProperties,
  type ErrorReport,
  type Breadcrumb,
  type AppState,
  type TelemetryConfig,
  type TelemetryStats,
  type TelemetryEventListener,
} from './telemetry';

// ─────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────

/**
 * Initialize core infrastructure
 */
export function initializeCore(config?: {
  apiBaseUrl?: string;
  cacheSize?: number;
}): void {
  const { apiBaseUrl, cacheSize } = config ?? {};
  
  if (cacheSize) {
    resetCacheManager();
    getCacheManager({ maxSize: cacheSize });
  }
  
  if (apiBaseUrl) {
    resetApiOrchestrator();
    getApiOrchestrator({ baseURL: apiBaseUrl });
  }
  
  getNetworkManager();
}

/**
 * Reset all core infrastructure
 */
export function resetCore(): void {
  resetApiOrchestrator();
  resetCacheManager();
  resetNetworkManager();
}