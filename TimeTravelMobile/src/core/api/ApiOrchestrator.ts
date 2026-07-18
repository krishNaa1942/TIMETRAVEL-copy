/**
 * 🚀 API ORCHESTRATOR
 * ===================
 * Production-grade HTTP client with retry, caching, and offline support
 */

import { NetworkError, AuthError, ServerError, AppError, toAppError } from '../errors';
import { getCacheManager, CacheManager } from '../cache/CacheManager';
import { getNetworkManager, NetworkManager } from '../network/NetworkManager';
import type { 
  RequestConfig, 
  ApiResponse, 
  HttpMethod,
  CircuitState,
  QueuedRequest
} from '../types';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

interface ApiConfig {
  baseURL: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  enableCache: boolean;
  enableOfflineQueue: boolean;
}

const DEFAULT_CONFIG: ApiConfig = {
  baseURL: '',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  enableCache: true,
  enableOfflineQueue: true,
};

// ─────────────────────────────────────────────────────────────
// Circuit Breaker
// ─────────────────────────────────────────────────────────────

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailure?: number;
  private nextAttempt?: number;

  constructor(
    private threshold = 5,
    private resetTimeout = 30000
  ) {}

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() >= (this.nextAttempt ?? 0)) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true; // half-open
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailure = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ─────────────────────────────────────────────────────────────
// Request Queue (Offline Support)
// ─────────────────────────────────────────────────────────────

class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private max = 100;

  add(request: QueuedRequest): void {
    if (this.queue.length >= this.max) {
      this.queue.shift();
    }
    this.queue.push(request);
  }

  getAll(): QueuedRequest[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
  }

  remove(id: string): void {
    this.queue = this.queue.filter(r => r.id !== id);
  }
}

// ─────────────────────────────────────────────────────────────
// API Orchestrator
// ─────────────────────────────────────────────────────────────

export class ApiOrchestrator {
  private config: ApiConfig;
  private cache: CacheManager;
  private network: NetworkManager;
  private circuitBreaker: CircuitBreaker;
  private offlineQueue: OfflineQueue;
  private abortControllers: Map<string, AbortController> = new Map();
  private authToken?: string;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = getCacheManager();
    this.network = getNetworkManager();
    this.circuitBreaker = new CircuitBreaker();
    this.offlineQueue = new OfflineQueue();

    // Subscribe to network changes
    this.network.subscribe(this.handleNetworkChange);
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  /**
   * Set authentication token
   */
  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  /**
   * GET request
   */
  async get<T>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'POST', data });
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', data });
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, config?: Omit<RequestConfig, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', data });
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  /**
   * Main request method
   */
  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const requestId = this.generateRequestId();
    const fullUrl = this.buildUrl(config.url, config.params);

    // Check cache for GET requests
    if (config.method === 'GET' && !config.skipCache && this.config.enableCache) {
      const cached = this.cache.get<T>(config.cacheKey ?? fullUrl);
      if (cached !== null) {
        return {
          data: cached,
          status: 200,
          headers: {},
          cached: true,
          timestamp: Date.now(),
        };
      }
    }

    // Check network
    if (this.network.isOffline()) {
      if (config.method !== 'GET' && this.config.enableOfflineQueue) {
        this.queueRequest(config);
        throw NetworkError.offline({ requestId });
      }
      throw NetworkError.offline({ requestId });
    }

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      throw ServerError.unavailable({ requestId });
    }

    // Execute request with retry
    return this.executeWithRetry<T>(fullUrl, config, requestId);
  }

  /**
   * Process offline queue
   */
  async processOfflineQueue(): Promise<void> {
    const requests = this.offlineQueue.getAll();
    for (const request of requests) {
      try {
        await this.request(request);
        this.offlineQueue.remove(request.id);
      } catch {
        // Keep in queue for next attempt
      }
    }
  }

  /**
   * Cancel pending request
   */
  cancel(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private async executeWithRetry<T>(
    url: string,
    config: RequestConfig,
    requestId: string
  ): Promise<ApiResponse<T>> {
    const maxRetries = config.retries ?? this.config.maxRetries;
    let lastError: AppError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeRequest<T>(url, config, requestId);
        this.circuitBreaker.recordSuccess();
        return response;
      } catch (error) {
        lastError = toAppError(error) as AppError;

        if (!lastError.retryable) {
          throw lastError;
        }

        if (attempt < maxRetries) {
          await this.delay(this.getRetryDelay(attempt, config));
        }
      }
    }

    this.circuitBreaker.recordFailure();
    throw lastError;
  }

  private async executeRequest<T>(
    url: string,
    config: RequestConfig,
    requestId: string
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    const timeoutId = setTimeout(
      () => controller.abort(),
      config.timeout ?? this.config.timeout
    );

    try {
      const response = await fetch(url, {
        method: config.method ?? 'GET',
        headers: this.buildHeaders(config.headers),
        body: config.data ? JSON.stringify(config.data) : undefined,
        signal: config.signal ?? controller.signal,
      });

      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      return this.processResponse<T>(response, config);
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw NetworkError.timeout(url, config.timeout ?? this.config.timeout, { requestId });
      }

      throw error;
    }
  }

  private async processResponse<T>(
    response: Response,
    config: RequestConfig
  ): Promise<ApiResponse<T>> {
    const status = response.status;
    const headers = this.headersToObject(response.headers);

    // Handle errors
    if (status === 401) {
      throw AuthError.tokenExpired({ httpStatus: status });
    }

    if (status === 403) {
      throw AuthError.forbidden({ httpStatus: status });
    }

    if (status >= 400) {
      const body = await response.text();
      throw ServerError.fromStatus(status, body || response.statusText);
    }

    // Parse response
    let data: T;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = (await response.text()) as T;
    }

    // Cache successful GET requests
    if (config.method === 'GET' && !config.skipCache && this.config.enableCache) {
      this.cache.set(config.cacheKey ?? response.url, data, {
        ttl: config.cacheTTL,
      });
    }

    return {
      data,
      status,
      headers,
      cached: false,
      timestamp: Date.now(),
    };
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
    let url = path.startsWith('http') ? path : `${this.config.baseURL}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  private buildHeaders(custom?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return { ...headers, ...custom };
  }

  private headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private queueRequest(config: RequestConfig): void {
    const request: QueuedRequest = {
      ...config,
      id: this.generateRequestId(),
      timestamp: Date.now(),
      attemptCount: 0,
    };
    this.offlineQueue.add(request);
  }

  private getRetryDelay(attempt: number, config: RequestConfig): number {
    const base = config.retryDelay ?? this.config.retryDelay;
    return base * Math.pow(2, attempt);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleNetworkChange = (): void => {
    if (this.network.isOnline()) {
      this.processOfflineQueue();
    }
  };
}

// Singleton instance
let apiInstance: ApiOrchestrator | null = null;

export function getApiOrchestrator(config?: Partial<ApiConfig>): ApiOrchestrator {
  if (!apiInstance) {
    apiInstance = new ApiOrchestrator(config);
  }
  return apiInstance;
}

export function resetApiOrchestrator(): void {
  if (apiInstance) {
    apiInstance.cancelAll();
    apiInstance = null;
  }
}