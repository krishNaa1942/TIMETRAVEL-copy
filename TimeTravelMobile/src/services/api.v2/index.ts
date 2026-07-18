/**
 * 🚀 ENTERPRISE API CLIENT - PUBLIC API
 * 
 * FAANG-Level Production API Layer
 * 
 * @example
 * ```typescript
 * import { apiClient, ApiClient } from '@/services/api.v2';
 * 
 * // Use singleton
 * const response = await apiClient.get('/users');
 * 
 * // Or create custom instance
 * const customClient = new ApiClient({ baseUrl: 'https://custom.api' });
 * ```
 */

// ─────────────────────────────────────────────────────────────
// MAIN EXPORTS
// ─────────────────────────────────────────────────────────────

// Client
export { ApiClient, apiClient } from './ApiClient';

// Auth Manager
export { AuthManager, authManager } from './AuthManager';

// Circuit Breaker
export { CircuitBreaker, circuitBreakerManager } from './CircuitBreaker';

// Request Deduplicator
export { RequestDeduplicator, requestDeduplicator } from './RequestDeduplicator';

// Types
export type {
  // Config
  ApiConfig,
  Environment,
  
  // Token
  TokenPair,
  TokenStorage,
  DecodedToken,
  
  // Error
  ErrorCategory,
  StructuredError,
  
  // Network
  NetworkState,
  NetworkListener,
  
  // Cache
  CacheEntry,
  CacheConfig,
  
  // Retry
  RetryConfig,
  RetryState,
  
  // Circuit Breaker
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
  
  // Request
  HttpMethod,
  RequestConfig,
  QueuedRequest,
  PendingRequest,
  
  // Response
  ApiResponse,
  PaginatedResponse,
  
  // Observability
  RequestMetric,
  PerformanceStats,
  MetricListener,
  
  // Events
  ApiEventType,
  ApiEvent,
  ApiEventListener,
  
  // Upload
  UploadFile,
  UploadConfig,
  
  // Validation
  ValidationSchema,
  ValidationError,
  
  // Feature Flags
  FeatureFlags,
  
  // Sync
  SyncConfig,
  SyncStatus,
} from './types';

// ─────────────────────────────────────────────────────────────
// CONVENIENCE EXPORTS
// ─────────────────────────────────────────────────────────────

// Import for use in api object
import { ApiClient as _ApiClient } from './ApiClient';
import { apiClient as _apiClient } from './ApiClient';

/**
 * Quick access to HTTP methods
 * @example
 * ```typescript
 * import { api } from '@/services/api.v2';
 * 
 * const users = await api.get('/users');
 * const created = await api.post('/users', { name: 'John' });
 * ```
 */
export const api = {
  get: <T>(path: string, config?: import('./types').RequestConfig) => 
    _apiClient.get<T>(path, config),
  
  post: <T>(path: string, data?: unknown, config?: import('./types').RequestConfig) => 
    _apiClient.post<T>(path, data, config),
  
  put: <T>(path: string, data?: unknown, config?: import('./types').RequestConfig) => 
    _apiClient.put<T>(path, data, config),
  
  patch: <T>(path: string, data?: unknown, config?: import('./types').RequestConfig) => 
    _apiClient.patch<T>(path, data, config),
  
  delete: <T>(path: string, config?: import('./types').RequestConfig) => 
    _apiClient.delete<T>(path, config),
  
  upload: <T>(
    path: string, 
    file: { uri: string; type: string; name: string },
    additionalData?: Record<string, string>,
    config?: import('./types').RequestConfig
  ) => _apiClient.upload<T>(path, file, additionalData, config),
};

// Default export
export default _apiClient;
