/**
 * 🚀 PRODUCTION API CLIENT
 * Enterprise-grade HTTP client with all features integrated
 * 
 * Features:
 * - Automatic token refresh (race-condition safe)
 * - Request queuing when offline
 * - Intelligent retry with circuit breaker
 * - Response caching
 * - Structured error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { authManager } from './AuthManager';
import { networkManager } from './NetworkManager';
import { retryManager } from './RetryManager';
import { cacheManager } from './CacheManager';
import { requestQueue } from './RequestQueue';
import { errorHandler } from './ErrorHandler';
import { ApiResponse, RequestConfig, StructuredError } from './types';

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────
const BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api/v1'
  : 'https://api.timetravel.app/api/v1';

const DEFAULT_TIMEOUT = 30000;

// ─────────────────────────────────────────────────────────────
// API CLIENT CLASS
// ─────────────────────────────────────────────────────────────
class ApiClient {
  private axios: AxiosInstance;
  private onAuthFailure: (() => void) | null = null;

  constructor() {
    this.axios = axios.create({
      baseURL: BASE_URL,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Set auth failure callback (for navigation to login)
   */
  setAuthFailureCallback(callback: () => void): void {
    this.onAuthFailure = callback;
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.axios.interceptors.request.use(
      async (config) => {
        const token = await authManager.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401 and token refresh
    this.axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        // Handle 401 - try token refresh
        if (error.response?.status === 401 && originalRequest) {
          return this.handle401(error, originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Handle 401 errors with token refresh
   */
  private async handle401(error: AxiosError, originalRequest: any): Promise<any> {
    // If already refreshing, wait for new token
    if (authManager.isCurrentlyRefreshing()) {
      try {
        const newToken = await authManager.subscribeToTokenRefresh();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return this.axios(originalRequest);
      } catch (refreshError) {
        return Promise.reject(error);
      }
    }

    // Start refresh process
    authManager.setRefreshing(true);

    try {
      const refreshToken = await authManager.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      // Call refresh endpoint
      const response = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
      
      await authManager.setTokens({
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      authManager.notifyRefreshSuccess(accessToken);

      // Retry original request
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return this.axios(originalRequest);
    } catch (refreshError) {
      authManager.notifyRefreshFailure(refreshError as Error);
      await authManager.clearTokens();
      this.onAuthFailure?.();
      return Promise.reject(error);
    } finally {
      authManager.setRefreshing(false);
    }
  }

  /**
   * Initialize all managers
   */
  async initialize(): Promise<void> {
    await authManager.initialize();
    await requestQueue.initialize();
    networkManager.initialize();
    
    // Set up queue executor
    requestQueue.setExecutor(async (request) => {
      return this.request(request.method, request.path, request.data, request.config);
    });

    // Process queue when online
    networkManager.subscribe((state) => {
      if (state.isConnected && state.isInternetReachable) {
        requestQueue.processQueue();
      }
    });

    this.log('Initialized');
  }

  /**
   * Main request method
   */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const { skipRetry = false, skipCache = false, timeout, headers } = config;

    // Check if offline - queue non-GET requests
    if (!networkManager.isOnline() && method !== 'GET') {
      await requestQueue.enqueue(method, path, data, config);
      throw errorHandler.handle(new Error('Offline - request queued'));
    }

    // Check cache for GET requests
    if (!skipCache && method === 'GET') {
      const cached = cacheManager.get<T>(method, path, data);
      if (cached !== null) {
        return { data: cached, status: 200, fromCache: true };
      }
    }

    // Execute with retry logic
    const executeRequest = async (): Promise<ApiResponse<T>> => {
      const axiosConfig: AxiosRequestConfig = {
        method,
        url: path,
        data,
        timeout: timeout || DEFAULT_TIMEOUT,
        headers,
      };

      const response = await this.axios.request<T>(axiosConfig);
      
      // Cache GET responses
      if (method === 'GET' && !skipCache) {
        cacheManager.set(method, path, data, response.data);
      }

      return {
        data: response.data,
        status: response.status,
      };
    };

    try {
      return await retryManager.executeWithRetry(
        executeRequest,
        method,
        skipRetry
      );
    } catch (error) {
      const structured = errorHandler.handle(error);
      throw structured;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CONVENIENCE METHODS
  // ─────────────────────────────────────────────────────────────

  async get<T = unknown>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, config);
  }

  async post<T = unknown>(path: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, data, config);
  }

  async put<T = unknown>(path: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, data, config);
  }

  async patch<T = unknown>(path: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, data, config);
  }

  async delete<T = unknown>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, config);
  }

  // ─────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────

  /**
   * Clear all cached data
   */
  clearCache(): void {
    cacheManager.clear();
  }

  /**
   * Invalidate cache by pattern
   */
  invalidateCache(pattern: string): void {
    cacheManager.invalidatePattern(pattern);
  }

  /**
   * Get pending offline requests count
   */
  getPendingRequestsCount(): number {
    return requestQueue.getSize();
  }

  private log(message: string, data?: unknown): void {
    if (__DEV__) {
      console.log(`🚀 [ApiClient] ${message}`, data ?? '');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────
export const apiClient = new ApiClient();
export default apiClient;