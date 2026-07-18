/**
 * 🔐 PRODUCTION-GRADE TOKEN MANAGER
 * =================================
 *
 * Enterprise token management with:
 * - Silent background refresh
 * - Request queue during refresh
 * - Token rotation (refresh token security)
 * - Secure storage (platform-aware)
 * - Expiry tracking with proactive refresh
 * - Race condition protection
 *
 * @architecture Netflix/Meta-level reliability
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "@/constants/config";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType?: string;
}

export interface TokenInfo {
  accessToken: string;
  expiresAt: number;
  issuedAt: number;
}

export interface RefreshState {
  isRefreshing: boolean;
  refreshPromise: Promise<boolean> | null;
  failedRequests: FailedRequest[];
}

interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

type TokenEventType = "token_refreshed" | "token_expired" | "token_cleared";
type TokenEventListener = (event: TokenEventType, data?: any) => void;

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  REFRESH_TOKEN: "auth_refresh_token",
  TOKEN_EXPIRY: "auth_token_expiry",
  TOKEN_ISSUED: "auth_token_issued",
  TOKEN_ROTATION_COUNT: "auth_token_rotation_count",
} as const;

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
const MAX_ROTATION_COUNT = 100; // Prevent infinite rotation
const REFRESH_TIMEOUT_MS = 10000; // 10 seconds timeout for refresh

// ─────────────────────────────────────────────────────────────
// SECURE STORAGE ABSTRACTION
// ─────────────────────────────────────────────────────────────

class SecureTokenStorage {
  private memoryCache: Map<string, string> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  /**
   * Get item from secure storage with memory cache
   */
  async getItem(key: string): Promise<string | null> {
    // Check memory cache first
    const cached = this.memoryCache.get(key);
    const expiry = this.cacheExpiry.get(key);

    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    try {
      let value: string | null = null;

      if (Platform.OS === "web") {
        value = await AsyncStorage.getItem(key);
      } else {
        value = await SecureStore.getItemAsync(key);
      }

      // Update memory cache
      if (value) {
        this.memoryCache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + 60000); // 1 min cache
      }

      return value;
    } catch (error) {
      console.error(`🔐 Storage get error for ${key}:`, error);
      return this.memoryCache.get(key) || null;
    }
  }

  /**
   * Set item in secure storage with memory cache
   */
  async setItem(key: string, value: string): Promise<boolean> {
    try {
      // Update memory cache immediately
      this.memoryCache.set(key, value);
      this.cacheExpiry.set(key, Date.now() + 60000);

      if (Platform.OS === "web") {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }

      return true;
    } catch (error) {
      console.error(`🔐 Storage set error for ${key}:`, error);
      // Still keep in memory cache
      return false;
    }
  }

  /**
   * Delete item from secure storage
   */
  async deleteItem(key: string): Promise<boolean> {
    try {
      // Clear memory cache
      this.memoryCache.delete(key);
      this.cacheExpiry.delete(key);

      if (Platform.OS === "web") {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }

      return true;
    } catch (error) {
      console.error(`🔐 Storage delete error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all token storage
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.deleteItem(STORAGE_KEYS.ACCESS_TOKEN),
      this.deleteItem(STORAGE_KEYS.REFRESH_TOKEN),
      this.deleteItem(STORAGE_KEYS.TOKEN_EXPIRY),
      this.deleteItem(STORAGE_KEYS.TOKEN_ISSUED),
      this.deleteItem(STORAGE_KEYS.TOKEN_ROTATION_COUNT),
    ]);

    // Clear memory cache
    this.memoryCache.clear();
    this.cacheExpiry.clear();
  }
}

// ─────────────────────────────────────────────────────────────
// PRODUCTION TOKEN MANAGER
// ─────────────────────────────────────────────────────────────

class ProductionTokenManager {
  private storage = new SecureTokenStorage();
  private refreshState: RefreshState = {
    isRefreshing: false,
    refreshPromise: null,
    failedRequests: [],
  };
  private listeners: Set<TokenEventListener> = new Set();
  private rotationCount = 0;

  // ── Token Storage ────────────────────────────────────────────

  /**
   * Store tokens securely with metadata
   */
  async storeTokens(tokens: TokenPair): Promise<boolean> {
    try {
      const now = Date.now();
      const expiresAt = now + tokens.expiresIn * 1000;

      await Promise.all([
        this.storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
        this.storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
        this.storage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiresAt)),
        this.storage.setItem(STORAGE_KEYS.TOKEN_ISSUED, String(now)),
      ]);

      // Increment rotation count
      this.rotationCount++;
      await this.storage.setItem(
        STORAGE_KEYS.TOKEN_ROTATION_COUNT,
        String(this.rotationCount),
      );

      console.log("🔐 Tokens stored securely");
      this.notifyListeners("token_refreshed", { expiresAt });

      return true;
    } catch (error) {
      console.error("🔐 Failed to store tokens:", error);
      return false;
    }
  }

  // ── Token Retrieval ──────────────────────────────────────────

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    return this.storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return this.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Get token expiry time
   */
  async getTokenExpiry(): Promise<number | null> {
    const expiry = await this.storage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    return expiry ? parseInt(expiry, 10) : null;
  }

  /**
   * Check if token is expired or expiring soon
   */
  async isTokenExpiringSoon(): Promise<boolean> {
    const expiry = await this.getTokenExpiry();
    if (!expiry) return true;

    return Date.now() + REFRESH_THRESHOLD_MS >= expiry;
  }

  /**
   * Check if token is completely expired
   */
  async isTokenExpired(): Promise<boolean> {
    const expiry = await this.getTokenExpiry();
    if (!expiry) return true;

    return Date.now() >= expiry;
  }

  /**
   * Check if we have a valid token
   */
  async hasValidToken(): Promise<boolean> {
    const token = await this.getAccessToken();
    if (!token) return false;

    const expired = await this.isTokenExpired();
    return !expired;
  }

  /**
   * Get a valid token, refreshing if necessary
   * This is the main method to use for API calls
   */
  async getValidToken(): Promise<string | null> {
    const token = await this.getAccessToken();

    if (!token) {
      return null;
    }

    // Check if we need to refresh
    if (await this.isTokenExpiringSoon()) {
      console.log("🔐 Token expiring soon, refreshing proactively...");

      // If already refreshing, wait for it
      if (this.refreshState.isRefreshing && this.refreshState.refreshPromise) {
        const success = await this.refreshState.refreshPromise;
        return success ? await this.getAccessToken() : null;
      }

      // Start refresh
      const success = await this.refreshAccessToken();
      return success ? await this.getAccessToken() : token;
    }

    return token;
  }

  // ── Token Refresh ────────────────────────────────────────────

  /**
   * Refresh access token using refresh token
   * Implements request queue to prevent duplicate refresh calls
   */
  async refreshAccessToken(): Promise<boolean> {
    // If already refreshing, return existing promise
    if (this.refreshState.isRefreshing && this.refreshState.refreshPromise) {
      return this.refreshState.refreshPromise;
    }

    // Check rotation limit
    if (this.rotationCount >= MAX_ROTATION_COUNT) {
      console.error("🔐 Max token rotation count reached");
      await this.clearTokens();
      return false;
    }

    this.refreshState.isRefreshing = true;
    this.refreshState.refreshPromise = this.performRefresh();

    try {
      const result = await this.refreshState.refreshPromise;
      return result;
    } finally {
      this.refreshState.isRefreshing = false;
      this.refreshState.refreshPromise = null;
    }
  }

  /**
   * Perform actual token refresh
   */
  private async performRefresh(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();

    if (!refreshToken) {
      console.log("🔐 No refresh token available");
      await this.clearTokens();
      this.processFailedRequests(new Error("No refresh token"));
      return false;
    }

    try {
      console.log("🔐 Refreshing access token...");

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REFRESH_TIMEOUT_MS,
      );

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("🔐 Token refresh failed:", response.status, error);

        if (response.status === 401 || response.status === 403) {
          // Refresh token is invalid
          await this.clearTokens();
          this.notifyListeners("token_expired");
        }

        this.processFailedRequests(new Error("Refresh failed"));
        return false;
      }

      const data = await response.json();

      if (data.access_token && data.refresh_token) {
        await this.storeTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in || 3600,
        });

        // Process any queued requests
        this.processQueuedRequests(data.access_token);

        console.log("🔐 Token refreshed successfully");
        return true;
      }

      return false;
    } catch (error) {
      console.error("🔐 Token refresh error:", error);

      if (error instanceof Error && error.name === "AbortError") {
        console.error("🔐 Token refresh timed out");
      }

      this.processFailedRequests(
        error instanceof Error ? error : new Error("Refresh error"),
      );
      return false;
    }
  }

  // ── Request Queue ─────────────────────────────────────────────

  /**
   * Queue a request to be resolved after token refresh
   */
  queueRequest(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.refreshState.failedRequests.push({ resolve, reject });
    });
  }

  /**
   * Process queued requests with new token
   */
  private processQueuedRequests(token: string): void {
    this.refreshState.failedRequests.forEach(({ resolve }) => {
      resolve(token);
    });
    this.refreshState.failedRequests = [];
  }

  /**
   * Reject queued requests on failure
   */
  private processFailedRequests(error: Error): void {
    this.refreshState.failedRequests.forEach(({ reject }) => {
      reject(error);
    });
    this.refreshState.failedRequests = [];
  }

  // ─- Token Clearing ───────────────────────────────────────────

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    await this.storage.clearAll();
    this.rotationCount = 0;
    this.notifyListeners("token_cleared");
    console.log("🔐 Tokens cleared");
  }

  // ── Event Listeners ───────────────────────────────────────────

  /**
   * Subscribe to token events
   */
  subscribe(listener: TokenEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(event: TokenEventType, data?: any): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch (error) {
        console.error("🔐 Token event listener error:", error);
      }
    });
  }

  // ── Utility Methods ───────────────────────────────────────────

  /**
   * Get token info for debugging
   */
  async getTokenInfo(): Promise<TokenInfo | null> {
    const [accessToken, expiry, issued] = await Promise.all([
      this.getAccessToken(),
      this.getTokenExpiry(),
      this.storage.getItem(STORAGE_KEYS.TOKEN_ISSUED),
    ]);

    if (!accessToken) return null;

    return {
      accessToken: accessToken.substring(0, 10) + "...", // Truncated for safety
      expiresAt: expiry || 0,
      issuedAt: issued ? parseInt(issued, 10) : 0,
    };
  }

  /**
   * Check if refresh is in progress
   */
  isRefreshInProgress(): boolean {
    return this.refreshState.isRefreshing;
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────

export const productionTokenManager = new ProductionTokenManager();
export default productionTokenManager;
