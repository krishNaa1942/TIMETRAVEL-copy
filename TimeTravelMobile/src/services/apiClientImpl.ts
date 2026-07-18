import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";

import { API_BASE_URL, API_TIMEOUT } from "@/constants/config";
import { tokenManager } from "./tokenManagerCore";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  status: number;
  details?: any;
  retryable: boolean;
  userMessage: string;
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: any;
  public retryable: boolean;
  public userMessage: string;

  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = "ApiError";
    this.code = details.code;
    this.status = details.status;
    this.details = details.details;
    this.retryable = details.retryable;
    this.userMessage = details.userMessage;
  }
}

function classifyError(error: any): ApiError {
  if (!error.response) {
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      return new ApiError({
        code: "TIMEOUT",
        message: "Request timeout",
        status: 408,
        retryable: true,
        userMessage: "Request took too long. Please try again.",
      });
    }

    if (error.message?.includes("Network") || error.code === "ERR_NETWORK") {
      return new ApiError({
        code: "NETWORK_ERROR",
        message: "Network error",
        status: 0,
        retryable: true,
        userMessage: "Unable to connect to server. Check your internet connection.",
      });
    }

    return new ApiError({
      code: "NETWORK_ERROR",
      message: error.message || "Unknown network error",
      status: 0,
      retryable: true,
      userMessage: "Connection error. Please check your internet and try again.",
    });
  }

  const status = error.response?.status || 0;
  const data = error.response?.data;

  if (status === 401) {
    const errorCode = data?.error || data?.code;

    if (errorCode === "invalid_token" || errorCode === "token_expired") {
      return new ApiError({
        code: "TOKEN_EXPIRED",
        message: "Token expired",
        status: 401,
        retryable: false,
        userMessage: "Your session has expired. Please log in again.",
      });
    }

    return new ApiError({
      code: "UNAUTHORIZED",
      message: data?.message || "Authentication required",
      status: 401,
      retryable: false,
      userMessage: data?.message || "Please log in to continue.",
    });
  }

  if (status === 403) {
    return new ApiError({
      code: "FORBIDDEN",
      message: data?.message || "Access denied",
      status: 403,
      retryable: false,
      userMessage: "You don't have permission to perform this action.",
    });
  }

  if (status === 404) {
    return new ApiError({
      code: "NOT_FOUND",
      message: data?.message || "Resource not found",
      status: 404,
      retryable: false,
      userMessage: "The requested resource was not found.",
    });
  }

  if (status === 409) {
    return new ApiError({
      code: "CONFLICT",
      message: data?.message || "Resource conflict",
      status: 409,
      retryable: false,
      userMessage: data?.message || "This resource already exists.",
    });
  }

  if (status === 422) {
    const details = data?.details || data?.errors;
    return new ApiError({
      code: "VALIDATION_ERROR",
      message: data?.message || "Validation failed",
      status: 422,
      details,
      retryable: false,
      userMessage: Array.isArray(details)
        ? details.join(". ")
        : data?.message || "Please check your input.",
    });
  }

  if (status === 429) {
    return new ApiError({
      code: "RATE_LIMITED",
      message: "Too many requests",
      status: 429,
      retryable: true,
      userMessage: "Too many requests. Please wait a moment and try again.",
    });
  }

  if (status >= 500) {
    return new ApiError({
      code: "SERVER_ERROR",
      message: data?.message || "Internal server error",
      status,
      retryable: status !== 501,
      userMessage: "Something went wrong on our end. Please try again later.",
    });
  }

  return new ApiError({
    code: data?.error || "CLIENT_ERROR",
    message: data?.message || "Request failed",
    status,
    details: data,
    retryable: false,
    userMessage: data?.message || "Request failed. Please try again.",
  });
}

class BulletproofApiClient {
  private client: AxiosInstance;
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT || 30000,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      async (config) => {
        const skipAuthPaths = [
          "/auth/v2/login",
          "/auth/v2/register",
          "/auth/v2/refresh",
          "/auth/v2/forgot-password",
          "/auth/v2/reset-password",
          "/auth/v2/oauth/google",
          "/auth/v2/oauth/apple",
        ];

        const shouldSkipAuth = skipAuthPaths.some((path) =>
          config.url?.includes(path),
        );

        if (!shouldSkipAuth) {
          const token = await tokenManager.getValidToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        config.headers["X-Device-ID"] = Platform.OS;
        config.headers["X-Platform"] = Platform.OS;
        config.headers["X-App-Version"] = "1.0.0";

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (originalRequest.url?.includes("/auth/v2/")) {
            await tokenManager.resetTokens();
            return Promise.reject(classifyError(error));
          }

          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(() => this.client(originalRequest));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshed = await tokenManager.refreshAccessToken();

            if (refreshed) {
              this.failedQueue.forEach(({ resolve }) => resolve(null));
              this.failedQueue = [];

              const token = await tokenManager.getValidToken();
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }

              return this.client(originalRequest);
            }

            await tokenManager.resetTokens();
            this.failedQueue.forEach(({ reject }) => reject(classifyError(error)));
            this.failedQueue = [];
            return Promise.reject(classifyError(error));
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(classifyError(error));
      },
    );
  }

  private getCacheKey(method: string, url: string, data?: any): string {
    return `${method}:${url}:${JSON.stringify(data || "")}`;
  }

  async request<T>(
    method: "get" | "post" | "put" | "patch" | "delete",
    url: string,
    data?: any,
    config?: { skipRetry?: boolean; skipDedup?: boolean; timeout?: number },
  ): Promise<T> {
    const cacheKey = !config?.skipDedup
      ? this.getCacheKey(method, url, data)
      : "";

    if (cacheKey && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const requestPromise = this.doRequest<T>(method, url, data, config);

    if (cacheKey) {
      this.pendingRequests.set(cacheKey, requestPromise);
      requestPromise.finally(() => this.pendingRequests.delete(cacheKey));
    }

    return requestPromise;
  }

  private async doRequest<T>(
    method: string,
    url: string,
    data: any,
    config?: { skipRetry?: boolean; timeout?: number },
  ): Promise<T> {
    const maxRetries = config?.skipRetry ? 0 : 3;
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.request({
          method,
          url,
          data,
          timeout: config?.timeout,
        });
        return response.data;
      } catch (error) {
        lastError = error instanceof ApiError ? error : classifyError(error);

        if (!lastError.retryable || attempt === maxRetries) {
          throw lastError;
        }

        const delay =
          Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async get<T>(url: string, config?: { skipRetry?: boolean }): Promise<T> {
    return this.request<T>("get", url, undefined, config);
  }

  async post<T>(
    url: string,
    data?: any,
    config?: { skipRetry?: boolean; skipDedup?: boolean },
  ): Promise<T> {
    return this.request<T>("post", url, data, config);
  }

  async put<T>(url: string, data?: any): Promise<T> {
    return this.request<T>("put", url, data);
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    return this.request<T>("patch", url, data);
  }

  async delete<T>(url: string): Promise<T> {
    return this.request<T>("delete", url);
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.get("/health", { skipRetry: true });
      return { healthy: true, latency: Date.now() - start };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getBaseUrl(): string {
    return API_BASE_URL;
  }
}

export const apiClient = new BulletproofApiClient();
export default apiClient;
export { tokenManager };
