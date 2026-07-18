/**
 * API Configuration & Service (Production-Ready)
 * =================================================
 * Handles all HTTP requests to Flask backend with:
 * - Automatic token refresh
 * - Exponential backoff retry
 * - Request timeout handling
 * - Error normalization
 * - Offline detection
 */

import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────
import { API_BASE_URL, API_TIMEOUT } from "@/constants/config";
import { tokenManager } from "./tokenManager";

export type RequestConfig = AxiosRequestConfig & { skipRetry?: boolean };

// Retry configuration
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// ─────────────────────────────────────────────────────────────
// DEBUG LOGGING
// ─────────────────────────────────────────────────────────────
const DEBUG_API = true;

function log(...args: any[]) {
  if (DEBUG_API) {
    console.log("🌐 [API]", ...args);
  }
}

function logError(...args: any[]) {
  console.error("🌐❌ [API ERROR]", ...args);
}

// ─────────────────────────────────────────────────────────────
// API ERROR CLASS
// ─────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public code?: string,
    public details?: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─────────────────────────────────────────────────────────────
// API SERVICE
// ─────────────────────────────────────────────────────────────
class ApiService {
  private client: AxiosInstance;

  constructor() {
    log("Initializing API service");
    log("Base URL:", API_BASE_URL);
    log("Timeout:", API_TIMEOUT, "ms");
    log("Platform:", Platform.OS);

    // Create axios instance
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      withCredentials: true, // Important for session cookies
    });

    // Request interceptor - add auth token and logging
    this.client.interceptors.request.use(
      async (config) => {
        const fullUrl = `${config.baseURL}${config.url}`;
        log(`→ ${config.method?.toUpperCase()} ${fullUrl}`);

        if (config.data) {
          // Log request body (redact sensitive fields)
          const redactedData = { ...config.data };
          if (redactedData.password) redactedData.password = "***REDACTED***";
          log("  Request body:", JSON.stringify(redactedData, null, 2));
        }

        try {
          const token = await tokenManager.getValidToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            log("  Added auth token to request");
          }
        } catch (error) {
          logError("Failed to retrieve auth token:", error);
        }
        return config;
      },
      (error) => {
        logError("Request interceptor error:", error);
        return Promise.reject(error);
      },
    );

    // Response interceptor - handle errors and logging
    this.client.interceptors.response.use(
      (response) => {
        log(
          `← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
        );
        log("  Response:", JSON.stringify(response.data, null, 2));
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config;

        if (config) {
          logError(
            `← ${error.response?.status || "NO RESPONSE"} ${config.method?.toUpperCase()} ${config.url}`,
          );
        }

        // Handle 401 (token expired / unauthorized)
        if (error.response?.status === 401) {
          log("  401 Unauthorized - clearing auth token");
          try {
            await tokenManager.clearTokens();
          } catch (err) {
            logError("Failed to clear auth token:", err);
          }
        }

        // Handle timeout
        if (error.code === "ECONNABORTED") {
          logError("  Request timeout");
          throw new ApiError(
            "Request timeout - server took too long to respond",
            408,
            "TIMEOUT",
          );
        }

        // Handle network error
        if (!error.response) {
          logError("  Network error - no response received");
          logError("  Error code:", error.code);
          logError("  Error message:", error.message);
          logError("  Base URL:", config?.baseURL || API_BASE_URL);
          logError("  Platform:", Platform.OS);

          // Provide helpful message based on error type
          let message = "Network error - unable to connect to server";
          if (error.message.includes("Network Error")) {
            message =
              "Unable to reach the server. Check the backend URL, device network, and Expo API_URL configuration.";
          }

          if (
            (config?.baseURL || API_BASE_URL).includes("127.0.0.1") &&
            Platform.OS !== "web"
          ) {
            message =
              "The app is pointing at localhost. Use your machine LAN IP or set EXPO_PUBLIC_API_URL for a physical device.";
          } else if (
            (config?.baseURL || API_BASE_URL).includes("10.0.2.2") &&
            Platform.OS !== "android"
          ) {
            message =
              "The app is using the Android emulator loopback URL on a non-Android target. Update EXPO_PUBLIC_API_URL.";
          }

          throw new ApiError(message, 0, "NETWORK_ERROR");
        }

        // Handle other errors
        const status = error.response.status;
        const responseData = error.response.data as any;

        logError("  Status:", status);
        logError("  Response data:", JSON.stringify(responseData, null, 2));

        // Extract error message from response
        let message = "An error occurred";
        if (responseData) {
          if (responseData.error) {
            message = responseData.error;
          } else if (responseData.message) {
            message = responseData.message;
          } else if (responseData.details) {
            // Handle validation errors with details array
            if (Array.isArray(responseData.details)) {
              message = responseData.details.join(". ");
            } else {
              message = String(responseData.details);
            }
          }
        }

        throw new ApiError(message, status, undefined, responseData);
      },
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate retry delay with exponential backoff + jitter
   */
  private getRetryDelay(attempt: number): number {
    const baseDelay = Math.min(
      BASE_RETRY_DELAY_MS * Math.pow(2, attempt),
      MAX_RETRY_DELAY_MS,
    );
    // Add jitter (±10%) to prevent thundering herd
    const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors (no response)
    if (!error.response) {
      return true;
    }
    const status = error.response.status;
    // Retry on server errors and specific client errors
    return (
      status === 408 || // Request Timeout
      status === 429 || // Too Many Requests
      status >= 500 // Server Errors
    );
  }

  /**
   * Generic request method with error handling and retry logic
   */
  async request<T>(
    method: "get" | "post" | "put" | "delete" | "patch",
    path: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<T> {
    const maxRetries = config?.skipRetry ? 0 : MAX_RETRIES;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        let response;

        if (method === "get" || method === "delete") {
          response = await this.client[method](
            path,
            config as AxiosRequestConfig,
          );
        } else {
          response = await this.client[method](path, data, config);
        }

        return response.data;
      } catch (error: any) {
        lastError = error;

        // Don't retry if explicitly skipped
        if (config?.skipRetry) {
          throw this.normalizeError(error);
        }

        // Check if we should retry
        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = this.getRetryDelay(attempt);
          log(
            `Retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms for ${path}`,
          );
          await this.sleep(delay);
          continue;
        }

        throw this.normalizeError(error);
      }
    }

    throw this.normalizeError(lastError);
  }

  /**
   * Normalize error to ApiError
   */
  private normalizeError(error: any): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error?.response) {
      const status = error.response.status;
      const responseData = error.response.data as any;

      let message = "An error occurred";
      if (responseData) {
        if (responseData.error) {
          message = responseData.error;
        } else if (responseData.message) {
          message = responseData.message;
        } else if (responseData.details) {
          if (Array.isArray(responseData.details)) {
            message = responseData.details.join(". ");
          } else {
            message = String(responseData.details);
          }
        }
      }

      return new ApiError(message, status, undefined, responseData);
    }

    // Network error
    if (error?.code === "ECONNABORTED") {
      return new ApiError("Request timeout", 408, "TIMEOUT");
    }

    if (!error?.response) {
      return new ApiError(
        error?.message || "Network error - unable to connect to server",
        0,
        "NETWORK_ERROR",
      );
    }

    return new ApiError(
      error instanceof Error ? error.message : "Unknown error",
      500,
    );
  }

  async get<T>(path: string, config?: RequestConfig): Promise<T> {
    return this.request("get", path, undefined, config);
  }

  async post<T>(path: string, data: any, config?: RequestConfig): Promise<T> {
    return this.request("post", path, data, config);
  }

  async put<T>(path: string, data: any, config?: RequestConfig): Promise<T> {
    return this.request("put", path, data, config);
  }

  async delete<T>(path: string, config?: RequestConfig): Promise<T> {
    return this.request("delete", path, undefined, config);
  }

  async patch<T>(path: string, data: any, config?: RequestConfig): Promise<T> {
    return this.request("patch", path, data, config);
  }

  /**
   * Get the base URL for debugging
   */
  getBaseUrl(): string {
    return API_BASE_URL;
  }

  /**
   * Check if API is reachable
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await this.get<{ status: string }>("/health", {
        timeout: 5000,
        skipRetry: true,
      } as any);
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if we're online
   */
  isOnline(): boolean {
    if (typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return true; // Assume online on native
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────
export const apiService = new ApiService();

export default apiService;
