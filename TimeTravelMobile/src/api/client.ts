/**
 * Production-Grade API Client
 * ===========================
 * Features: Retry, Timeout, Auth, Token Refresh
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../constants/config";
import { secureStorage } from "../services/secureStorage";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta | null;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, any>;
  field?: string;
}

export interface ApiMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface RequestOptions {
  skipAuth?: boolean;
  skipRetry?: boolean;
  timeout?: number;
  headers?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// RETRY CONFIGURATION
// ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;
const MAX_DELAY = 10000;

const calculateDelay = (attempt: number): number => {
  const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
};

const isRetryable = (error: AxiosError): boolean => {
  if (error.response?.status && error.response.status < 500) {
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────
// API CLIENT CLASS
// ─────────────────────────────────────────────────────────────

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<boolean> | null = null;
  private isRefreshing = false;

  constructor() {
    const baseURL = API_BASE_URL;

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        if (!config.headers?.skipAuth) {
          const token = await this.getValidToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        const deviceId = await secureStorage.getDeviceId();
        if (deviceId) {
          config.headers["X-Device-ID"] = deviceId;
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as any;

        if (error.response?.status === 401 && !config?.skipAuth) {
          const refreshed = await this.handleTokenRefresh();
          if (refreshed && config) {
            return this.client.request(config);
          }
        }

        if (config?.retryCount < MAX_RETRIES && isRetryable(error)) {
          config.retryCount = (config.retryCount || 0) + 1;
          const delay = calculateDelay(config.retryCount);

          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client.request(config);
        }

        return Promise.reject(error);
      },
    );
  }

  private async getValidToken(): Promise<string | null> {
    return secureStorage.getAccessToken();
  }

  private async handleTokenRefresh(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = await secureStorage.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await axios.post(
        `${this.client.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken },
      );

      if (response.data.success) {
        await secureStorage.storeTokens({
          accessToken: response.data.tokens.access_token,
          refreshToken: response.data.tokens.refresh_token,
          expiresAt: Date.now() + response.data.tokens.expires_in * 1000,
          tokenType: "Bearer",
        });
        return true;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC METHODS
  // ─────────────────────────────────────────────────────────────

  async get<T = any>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint, undefined, options);
  }

  async post<T = any>(
    endpoint: string,
    data?: any,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, data, options);
  }

  async put<T = any>(
    endpoint: string,
    data?: any,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, data, options);
  }

  async patch<T = any>(
    endpoint: string,
    data?: any,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", endpoint, data, options);
  }

  async delete<T = any>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint, undefined, options);
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
        data,
        timeout: options.timeout || 30000,
        headers: {
          ...options.headers,
          skipAuth: options.skipAuth ? "true" : undefined,
        },
      };

      (config as any).retryCount = 0;

      const response = await this.client.request<T>(config);

      return {
        success: true,
        data: response.data,
        error: null,
        meta: null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error || {
          message: error.message || "An error occurred",
          code: error.code || "UNKNOWN_ERROR",
        };

        return {
          success: false,
          data: null,
          error: apiError,
          meta: null,
        };
      }

      return {
        success: false,
        data: null,
        error: {
          message: "An unexpected error occurred",
          code: "UNKNOWN_ERROR",
        },
        meta: null,
      };
    }
  }

  getBaseUrl(): string {
    return this.client.defaults.baseURL || "";
  }
}

export const apiClient = new ApiClient();
export default apiClient;
