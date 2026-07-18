/**
 * 📦 API LAYER - Production Export
 * 
 * Usage:
 * import { apiClient, authManager } from '@/services/api';
 */

// Types
export type {
  TokenPair,
  TokenStorage,
  ErrorType,
  StructuredError,
  NetworkState,
  NetworkListener,
  CacheEntry,
  CacheConfig,
  RetryConfig,
  CircuitBreakerState,
  QueuedRequest,
  RequestConfig,
  ApiResponse,
  PaginatedResponse,
} from './types';

// Managers
export { authManager } from './AuthManager';
export { networkManager } from './NetworkManager';
export { retryManager } from './RetryManager';
export { cacheManager } from './CacheManager';
export { requestQueue } from './RequestQueue';
export { errorHandler } from './ErrorHandler';

// Client
export { apiClient, default as ApiClient } from './client';

// Convenience re-export
export { default } from './client';