/**
 * 🚀 ENTERPRISE API CLIENT
 *
 * FAANG-Level Production API Layer
 *
 * FEATURES:
 * - Token refresh with mutex lock (NO duplicate refreshes)
 * - Request deduplication (NO duplicate in-flight requests)
 * - Circuit breaker (protects against cascade failures)
 * - Intelligent retry with jitter
 * - Offline-first with persistent queue
 * - Request cancellation
 * - Full observability
 * - Event-based (NO UI coupling)
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosRequestConfig,
} from "axios";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

import {
  ApiConfig,
  ApiResponse,
  RequestConfig,
  HttpMethod,
  StructuredError,
  ErrorCategory,
  ApiEvent,
  ApiEventListener,
  QueuedRequest,
  NetworkState,
  RequestMetric,
} from "./types";

import { AuthManager, authManager } from "./AuthManager";
import { CircuitBreaker, circuitBreakerManager } from "./CircuitBreaker";
import {
  RequestDeduplicator,
  requestDeduplicator,
} from "./RequestDeduplicator";
import { API_BASE_URL } from "../../constants/config";

// ─────────────────────────────────────────────────────────────
// REQUEST METADATA
// ─────────────────────────────────────────────────────────────
interface RequestMetadata {
  startTime: number;
  retryCount?: number;
  skipAuthRefresh?: boolean;
  requestId?: string;
}

// Extend axios config with metadata
declare module "axios" {
  interface InternalAxiosRequestConfig {
    metadata?: RequestMetadata;
  }
}

// ─────────────────────────────────────────────────────────────
// DEFAULT CONFIG
// ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: ApiConfig = {
  environment: (__DEV__ ? "development" : "production") as
    | "development"
    | "production",
  baseUrl: API_BASE_URL,
  timeout: 20000,
  enableLogging: __DEV__,
  enableAnalytics: true,
  retryAttempts: 3,
  circuitBreakerThreshold: 5,
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000,
};

// ─────────────────────────────────────────────────────────────
// API CLIENT CLASS
// ─────────────────────────────────────────────────────────────
export class ApiClient {
  private axiosInstance: AxiosInstance;
  private config: ApiConfig;

  // Managers
  private authManager: AuthManager;
  private circuitBreaker: CircuitBreaker;
  private deduplicator: RequestDeduplicator;

  // Network state
  private networkState: NetworkState = {
    isConnected: true,
    isInternetReachable: true,
    type: "unknown",
    isConnectionExpensive: false,
  };

  // Offline queue
  private offlineQueue: QueuedRequest[] = [];
  private readonly OFFLINE_QUEUE_KEY = "api_offline_queue";

  // Request tracking
  private pendingRequests: Map<string, AbortController> = new Map();
  private requestMetrics: RequestMetric[] = [];
  private readonly MAX_METRICS = 100;

  // Event listeners
  private eventListeners: Set<ApiEventListener> = new Set();

  // Public endpoints (no auth required)
  private publicEndpoints = [
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/health",
    "/public/",
  ];

  // Idempotent methods (safe to retry)
  private idempotentMethods: HttpMethod[] = [
    "GET",
    "HEAD",
    "OPTIONS",
    "PUT",
    "DELETE",
  ];

  // Retryable status codes
  private retryableStatusCodes = [408, 429, 500, 502, 503, 504];

  // Initialization state
  private initialized = false;

  // ───────────────────────────────────────────────────────────
  // INITIALIZATION
  // ───────────────────────────────────────────────────────────

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // Initialize managers
    this.authManager = authManager;
    this.circuitBreaker = circuitBreakerManager.getBreaker("api", {
      failureThreshold: this.config.circuitBreakerThreshold,
    });
    this.deduplicator = requestDeduplicator;

    // Setup interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();

    // Setup network monitoring
    this.setupNetworkMonitoring();

    // Setup app state handling
    this.setupAppStateHandling();
  }

  /**
   * Initialize the API client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize auth manager
      await this.authManager.initialize();

      // Set HTTP client for auth manager (for refresh)
      this.authManager.setHttpClient({
        post: async <T>(url: string, data?: unknown): Promise<T> => {
          const response = await axios.post<T>(
            `${this.config.baseUrl}${url}`,
            data,
          );
          return response.data;
        },
      });

      // Load offline queue
      await this.loadOfflineQueue();

      this.initialized = true;
      this.log("API Client initialized");
    } catch (error) {
      this.logError("API Client initialization failed", error);
      this.initialized = true;
    }
  }

  // ───────────────────────────────────────────────────────────
  // REQUEST INTERCEPTOR
  // ───────────────────────────────────────────────────────────

  private setupRequestInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const startTime = Date.now();
        config.metadata = { startTime };

        // Generate request ID
        const requestId = this.generateRequestId();
        config.metadata.requestId = requestId;
        config.headers["X-Request-ID"] = requestId;

        const path = config.url || "";
        const requestConfig = config as InternalAxiosRequestConfig &
          RequestConfig;

        // Check if offline (queue request)
        if (!this.networkState.isConnected && !requestConfig.skipAuth) {
          const method = config.method?.toUpperCase() as HttpMethod;
          if (method !== "GET") {
            await this.queueRequest(config);
            return Promise.reject(this.createNetworkError("Offline"));
          }
        }

        // Skip auth for public endpoints
        if (this.isPublicEndpoint(path) || requestConfig.skipAuth) {
          return config;
        }

        // Get valid token (will refresh if needed)
        try {
          const token = await this.authManager.getValidToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          this.logError("Failed to get auth token", error);
        }

        return config;
      },
      (error) => Promise.reject(error),
    );
  }

  // ───────────────────────────────────────────────────────────
  // RESPONSE INTERCEPTOR
  // ───────────────────────────────────────────────────────────

  private setupResponseInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const metadata = response.config.metadata || { startTime: Date.now() };
        const duration = Date.now() - metadata.startTime;

        this.recordMetric({
          requestId: metadata.requestId || this.generateRequestId(),
          method:
            (response.config.method?.toUpperCase() as HttpMethod) || "GET",
          path: response.config.url || "",
          status: response.status,
          duration,
          cached: false,
          retryCount: metadata.retryCount || 0,
          timestamp: Date.now(),
        });

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig &
          RequestConfig;
        if (!config) throw error;

        const metadata = config.metadata || { startTime: Date.now() };
        const status = error.response?.status || 0;
        const duration = Date.now() - metadata.startTime;

        // Handle 401 Unauthorized
        if (status === 401 && !metadata.skipAuthRefresh) {
          return this.handle401Error(error, config);
        }

        // Handle retryable errors
        if (this.shouldRetry(error, metadata)) {
          return this.retryRequest(error, config, metadata);
        }

        // Record error metric
        this.recordMetric({
          requestId: metadata.requestId || this.generateRequestId(),
          method: (config.method?.toUpperCase() as HttpMethod) || "GET",
          path: config.url || "",
          status,
          duration,
          cached: false,
          retryCount: metadata.retryCount || 0,
          timestamp: Date.now(),
          error: this.createStructuredError(error),
        });

        throw this.createStructuredError(error);
      },
    );
  }

  // ───────────────────────────────────────────────────────────
  // 401 HANDLING (Token Refresh)
  // ───────────────────────────────────────────────────────────

  private async handle401Error(
    error: AxiosError,
    config: InternalAxiosRequestConfig & RequestConfig,
  ): Promise<unknown> {
    const metadata = config.metadata || { startTime: Date.now() };

    try {
      const newToken = await this.authManager.doRefresh();

      if (newToken && config) {
        config.headers.Authorization = `Bearer ${newToken}`;
        config.metadata = { ...metadata, skipAuthRefresh: true };
        return this.axiosInstance.request(config);
      }
    } catch (refreshError) {
      this.emitEvent({ type: "auth:logout", timestamp: Date.now() });
      throw this.createStructuredError(refreshError as Error, "AUTH", 401);
    }
  }

  // ───────────────────────────────────────────────────────────
  // RETRY LOGIC
  // ───────────────────────────────────────────────────────────

  private shouldRetry(error: AxiosError, metadata: RequestMetadata): boolean {
    const retryCount = metadata.retryCount || 0;
    if (retryCount >= this.config.retryAttempts) return false;

    const status = error.response?.status || 0;
    return this.retryableStatusCodes.includes(status) || !error.response;
  }

  private async retryRequest(
    error: AxiosError,
    config: InternalAxiosRequestConfig & RequestConfig,
    metadata: RequestMetadata,
  ): Promise<unknown> {
    const retryCount = (metadata.retryCount || 0) + 1;
    config.metadata = { ...metadata, retryCount };

    // Exponential backoff with jitter
    const baseDelay = 1000 * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * 500;
    const delay = Math.min(baseDelay + jitter, 30000);

    this.log(
      `Retrying request (${retryCount}/${this.config.retryAttempts}) after ${delay}ms`,
    );

    await this.sleep(delay);
    return this.axiosInstance.request(config);
  }

  // ───────────────────────────────────────────────────────────
  // HTTP METHODS
  // ───────────────────────────────────────────────────────────

  async get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, config);
  }

  async post<T>(
    path: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", path, data, config);
  }

  async put<T>(
    path: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", path, data, config);
  }

  async patch<T>(
    path: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", path, data, config);
  }

  async delete<T>(
    path: string,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", path, undefined, config);
  }

  /**
   * Main request method with all features
   */
  private async request<T>(
    method: HttpMethod,
    path: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    // Check circuit breaker
    if (!this.circuitBreaker.canRequest()) {
      throw this.createStructuredError(
        new Error("Circuit breaker is open"),
        "SERVER",
        503,
      );
    }

    // Request deduplication (GET only)
    if (method === "GET" && !config?.skipDedup) {
      const { promise } = this.deduplicator.getOrCreate(
        method,
        path,
        data,
        () => this.executeRequest<T>(method, path, data, config),
      );
      return promise;
    }

    return this.executeRequest<T>(method, path, data, config);
  }

  /**
   * Execute actual HTTP request
   */
  private async executeRequest<T>(
    method: HttpMethod,
    path: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    const requestId = config?.requestId || this.generateRequestId();
    const controller = new AbortController();

    // Track pending request
    this.pendingRequests.set(requestId, controller);

    try {
      const axiosConfig: AxiosRequestConfig = {
        method,
        url: path,
        data,
        signal: config?.abortSignal || controller.signal,
        headers: config?.headers,
        timeout: config?.timeout || this.config.timeout,
      };

      const response = await this.axiosInstance.request<T>(axiosConfig);

      // Record success
      this.circuitBreaker.recordSuccess();

      const metadata = response.config.metadata || { startTime: Date.now() };

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
        requestId,
        duration: Date.now() - metadata.startTime,
      };
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    } finally {
      this.pendingRequests.delete(requestId);
    }
  }

  // ───────────────────────────────────────────────────────────
  // FILE UPLOAD (React Native Compatible)
  // ───────────────────────────────────────────────────────────

  async upload<T>(
    path: string,
    file: { uri: string; type: string; name: string },
    additionalData?: Record<string, string>,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();

    formData.append("file", {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const requestId = config?.requestId || this.generateRequestId();
    const startTime = Date.now();

    const response = await this.axiosInstance.post<T>(path, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...config?.headers,
      },
      timeout: config?.timeout,
    });

    return {
      data: response.data,
      status: response.status,
      requestId,
      duration: Date.now() - startTime,
    };
  }

  // ───────────────────────────────────────────────────────────
  // OFFLINE QUEUE
  // ───────────────────────────────────────────────────────────

  private async queueRequest(
    config: InternalAxiosRequestConfig,
  ): Promise<void> {
    const queuedRequest: QueuedRequest = {
      id: this.generateRequestId(),
      method: config.method?.toUpperCase() as HttpMethod,
      path: config.url || "",
      data: config.data,
      config: {
        headers: config.headers as Record<string, string>,
      },
      timestamp: Date.now(),
      attempts: 0,
    };

    this.offlineQueue.push(queuedRequest);
    await this.persistOfflineQueue();

    this.emitEvent({
      type: "request:queued",
      timestamp: Date.now(),
      data: queuedRequest,
    });
    this.log("Request queued for offline sync");
  }

  private async loadOfflineQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
      }
    } catch (error) {
      this.logError("Failed to load offline queue", error);
    }
  }

  private async persistOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.OFFLINE_QUEUE_KEY,
        JSON.stringify(this.offlineQueue),
      );
    } catch (error) {
      this.logError("Failed to persist offline queue", error);
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    this.log(`Processing ${this.offlineQueue.length} queued requests`);

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const request of queue) {
      try {
        await this.request(
          request.method,
          request.path,
          request.data,
          request.config,
        );
        this.emitEvent({
          type: "request:replayed",
          timestamp: Date.now(),
          data: request,
        });
      } catch (error) {
        request.attempts++;
        request.lastError = String(error);

        if (request.attempts < 5) {
          this.offlineQueue.push(request);
        }
      }
    }

    await this.persistOfflineQueue();
  }

  // ───────────────────────────────────────────────────────────
  // NETWORK MONITORING
  // ───────────────────────────────────────────────────────────

  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.networkState.isConnected;
      const isNowOnline = state.isConnected;

      this.networkState = {
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        type: state.type || "unknown",
        isConnectionExpensive: false,
      };

      if (wasOffline && isNowOnline) {
        this.emitEvent({ type: "network:online", timestamp: Date.now() });
        this.processOfflineQueue();
      } else if (!isNowOnline) {
        this.emitEvent({ type: "network:offline", timestamp: Date.now() });
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // APP STATE HANDLING
  // ───────────────────────────────────────────────────────────

  private setupAppStateHandling(): void {
    AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && this.networkState.isConnected) {
        this.processOfflineQueue();
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // REQUEST CANCELLATION
  // ───────────────────────────────────────────────────────────

  cancelRequest(requestId: string): boolean {
    const controller = this.pendingRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.pendingRequests.delete(requestId);
      return true;
    }
    return false;
  }

  cancelAllRequests(): void {
    this.pendingRequests.forEach((controller) => controller.abort());
    this.pendingRequests.clear();
    this.deduplicator.cancelAll();
  }

  // ───────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ───────────────────────────────────────────────────────────

  private createStructuredError(
    error: Error | AxiosError,
    category?: ErrorCategory,
    status?: number,
  ): StructuredError {
    const axiosError = error as AxiosError;
    const statusCode = status || axiosError.response?.status || 0;

    let errorCategory: ErrorCategory = category || "UNKNOWN";
    let userMessage = "An unexpected error occurred. Please try again.";
    let retryable = false;

    if (!axiosError.response) {
      errorCategory = "NETWORK";
      userMessage =
        "Unable to connect to the server. Please check your connection.";
      retryable = true;
    } else if (axiosError.code === "ECONNABORTED") {
      errorCategory = "TIMEOUT";
      userMessage = "Request timed out. Please try again.";
      retryable = true;
    } else if (statusCode === 401) {
      errorCategory = "AUTH";
      userMessage = "Your session has expired. Please log in again.";
    } else if (statusCode === 403) {
      errorCategory = "AUTH";
      userMessage = "You do not have permission to perform this action.";
    } else if (statusCode === 400) {
      errorCategory = "VALIDATION";
      userMessage = "Invalid request. Please check your input.";
    } else if (statusCode >= 500) {
      errorCategory = "SERVER";
      userMessage = "Server error. Please try again later.";
      retryable = true;
    }

    return {
      id: this.generateRequestId(),
      category: errorCategory,
      code: axiosError.code || "UNKNOWN",
      message: error.message,
      userMessage,
      debugMessage: __DEV__ ? error.message : "",
      status: statusCode,
      retryable,
      timestamp: Date.now(),
      requestId: axiosError.config?.metadata?.requestId,
    };
  }

  private createNetworkError(message: string): StructuredError {
    return {
      id: this.generateRequestId(),
      category: "NETWORK",
      code: "OFFLINE",
      message,
      userMessage: "You are offline. Request has been queued.",
      debugMessage: message,
      retryable: true,
      timestamp: Date.now(),
    };
  }

  // ───────────────────────────────────────────────────────────
  // METRICS & OBSERVABILITY
  // ───────────────────────────────────────────────────────────

  private recordMetric(metric: RequestMetric): void {
    this.requestMetrics.push(metric);

    if (this.requestMetrics.length > this.MAX_METRICS) {
      this.requestMetrics.shift();
    }
  }

  getMetrics(): RequestMetric[] {
    return [...this.requestMetrics];
  }

  // ───────────────────────────────────────────────────────────
  // EVENT SYSTEM
  // ───────────────────────────────────────────────────────────

  subscribe(listener: ApiEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emitEvent(event: ApiEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.logError("Event listener error", error);
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ───────────────────────────────────────────────────────────

  private isPublicEndpoint(path: string): boolean {
    return this.publicEndpoints.some((ep) => path.startsWith(ep));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  setBaseUrl(url: string): void {
    this.config.baseUrl = url;
    this.axiosInstance.defaults.baseURL = url;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  getAuthManager(): AuthManager {
    return this.authManager;
  }

  private log(message: string, data?: unknown): void {
    if (this.config.enableLogging) {
      console.log(`🚀 [ApiClient] ${message}`, data || "");
    }
  }

  private logError(message: string, error: unknown): void {
    if (this.config.enableLogging) {
      console.error(`🚀 [ApiClient] ${message}`, error);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────
export const apiClient = new ApiClient();
export default ApiClient;
