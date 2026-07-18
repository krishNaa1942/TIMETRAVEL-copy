/**
 * 🔐 AUTH MANAGER - PRODUCTION GRADE
 * 
 * CRITICAL FEATURES:
 * - Mutex lock for token refresh (SINGLE REFRESH ONLY)
 * - Request queue during refresh
 * - Secure token storage (Expo SecureStore)
 * - Silent token refresh
 * - Event-based communication (NO UI COUPLING)
 */

import * as SecureStore from 'expo-secure-store';
import { TokenPair, TokenStorage, ApiEvent, ApiEventListener } from './types';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  EXPIRES_AT: 'auth_expires_at',
} as const;

const TOKEN_REFRESH_THRESHOLD_MS = 60 * 1000; // 1 minute before expiry

// ─────────────────────────────────────────────────────────────
// QUEUED REQUEST
// ─────────────────────────────────────────────────────────────
interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// AUTH MANAGER CLASS
// ─────────────────────────────────────────────────────────────
export class AuthManager {
  // Token storage (in-memory cache)
  private tokenStorage: TokenStorage = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
  };

  // 🎯 CRITICAL: Mutex lock for token refresh
  private isRefreshing = false;
  
  // Queue of requests waiting for token refresh
  private requestQueue: QueuedRequest[] = [];

  // Event listeners
  private eventListeners: Set<ApiEventListener> = new Set();

  // Refresh token endpoint
  private refreshEndpoint = '/auth/refresh';

  // HTTP client reference (set externally to avoid circular dependency)
  private httpClient: {
    post: <T>(url: string, data?: unknown) => Promise<T>;
  } | null = null;

  // Initialization state
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // ───────────────────────────────────────────────────────────
  // INITIALIZATION
  // ───────────────────────────────────────────────────────────

  /**
   * Initialize - Load tokens from secure storage
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      const [accessToken, refreshToken, expiresAt] = await Promise.all([
        SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.EXPIRES_AT),
      ]);

      this.tokenStorage = {
        accessToken,
        refreshToken,
        expiresAt: expiresAt ? parseInt(expiresAt, 10) : null,
      };

      this.initialized = true;
      this.log('Initialized', { hasToken: !!accessToken });
    } catch (error) {
      this.logError('Initialization failed', error);
      this.initialized = true; // Continue without stored tokens
    }
  }

  /**
   * Set HTTP client (to avoid circular dependency)
   */
  setHttpClient(client: { post: <T>(url: string, data?: unknown) => Promise<T> }): void {
    this.httpClient = client;
  }

  /**
   * Set refresh endpoint
   */
  setRefreshEndpoint(endpoint: string): void {
    this.refreshEndpoint = endpoint;
  }

  // ───────────────────────────────────────────────────────────
  // TOKEN MANAGEMENT
  // ───────────────────────────────────────────────────────────

  /**
   * Get valid token - refreshes if needed
   * This is the main entry point for getting tokens
   */
  async getValidToken(): Promise<string | null> {
    await this.initialize();

    // No token stored
    if (!this.tokenStorage.accessToken) {
      return null;
    }

    // Check if token needs refresh
    if (this.needsRefresh()) {
      return this.getOrRefreshToken();
    }

    return this.tokenStorage.accessToken;
  }

  /**
   * Get token with refresh queue handling
   * CRITICAL: Implements mutex lock + request queue
   */
  private async getOrRefreshToken(): Promise<string | null> {
    // 🎯 CRITICAL: Check if refresh is already in progress
    if (this.isRefreshing) {
      // Add to queue and wait for the ongoing refresh
      return this.queueForToken();
    }

    // Perform refresh
    try {
      const token = await this.doRefresh();
      return token;
    } catch (error) {
      this.logError('Token refresh failed', error);
      return null;
    }
  }

  /**
   * Queue request for token (waits for ongoing refresh)
   */
  private queueForToken(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        resolve: (token) => resolve(token),
        reject: (error) => reject(error),
        timestamp: Date.now(),
      };

      this.requestQueue.push(request);

      // Timeout after 30 seconds
      setTimeout(() => {
        const index = this.requestQueue.indexOf(request);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          reject(new Error('Token refresh timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Perform actual token refresh
   * CRITICAL: Uses mutex lock to prevent duplicate refresh calls
   */
  async doRefresh(): Promise<string | null> {
    // 🎯 CRITICAL: Mutex lock - prevent duplicate refresh
    if (this.isRefreshing) {
      this.log('Refresh already in progress, waiting...');
      return this.queueForToken();
    }

    this.isRefreshing = true;
    this.emitEvent({ type: 'token:refresh:start', timestamp: Date.now() });

    try {
      if (!this.tokenStorage.refreshToken) {
        throw new Error('No refresh token available');
      }

      if (!this.httpClient) {
        throw new Error('HTTP client not configured');
      }

      // Call refresh endpoint
      const response = await this.httpClient.post<{ data: TokenPair }>(
        this.refreshEndpoint,
        { refreshToken: this.tokenStorage.refreshToken }
      );

      const tokens = response.data || response;
      await this.storeTokens(tokens);

      // 🎯 CRITICAL: Resolve all queued requests
      this.resolveQueue(tokens.accessToken);

      this.emitEvent({ type: 'token:refresh:success', timestamp: Date.now() });
      this.log('Token refreshed successfully');

      return tokens.accessToken;
    } catch (error) {
      // 🎯 CRITICAL: Reject all queued requests on failure
      this.rejectQueue(error as Error);

      // Clear tokens on refresh failure
      await this.clearTokens();

      this.emitEvent({ type: 'token:refresh:failure', timestamp: Date.now(), data: error });
      this.logError('Token refresh failed', error);

      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Resolve all queued requests with new token
   */
  private resolveQueue(token: string): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach((request) => {
      request.resolve(token);
    });
  }

  /**
   * Reject all queued requests with error
   */
  private rejectQueue(error: Error): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach((request) => {
      request.reject(error);
    });
  }

  /**
   * Store tokens securely
   */
  async storeTokens(tokens: TokenPair): Promise<void> {
    const expiresAt = Date.now() + (tokens.expiresIn * 1000);

    this.tokenStorage = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || this.tokenStorage.refreshToken,
      expiresAt,
    };

    // Store in SecureStore
    await Promise.all([
      SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, tokens.accessToken),
      tokens.refreshToken
        ? SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, tokens.refreshToken)
        : Promise.resolve(),
      SecureStore.setItemAsync(SECURE_STORE_KEYS.EXPIRES_AT, expiresAt.toString()),
    ]);

    this.log('Tokens stored securely');
  }

  /**
   * Set tokens directly (after login)
   */
  async setTokens(tokens: TokenPair): Promise<void> {
    await this.storeTokens(tokens);
  }

  /**
   * Clear all tokens
   */
  async clearTokens(): Promise<void> {
    this.tokenStorage = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    };

    try {
      await Promise.all([
        SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(SECURE_STORE_KEYS.EXPIRES_AT),
      ]);
    } catch (error) {
      // Ignore errors during cleanup
    }

    this.emitEvent({ type: 'auth:logout', timestamp: Date.now() });
    this.log('Tokens cleared');
  }

  /**
   * Check if token needs refresh
   */
  private needsRefresh(): boolean {
    if (!this.tokenStorage.expiresAt || !this.tokenStorage.accessToken) {
      return false;
    }

    const timeUntilExpiry = this.tokenStorage.expiresAt - Date.now();
    return timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.tokenStorage.accessToken && 
           (!this.tokenStorage.expiresAt || this.tokenStorage.expiresAt > Date.now());
  }

  /**
   * Get current access token (no refresh)
   */
  getAccessToken(): string | null {
    return this.tokenStorage.accessToken;
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return this.tokenStorage.refreshToken;
  }

  // ───────────────────────────────────────────────────────────
  // EVENT SYSTEM
  // ───────────────────────────────────────────────────────────

  /**
   * Subscribe to auth events
   */
  subscribe(listener: ApiEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: ApiEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.logError('Event listener error', error);
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // LOGGING (Secure - no token data)
  // ───────────────────────────────────────────────────────────

  private log(message: string, data?: object): void {
    if (__DEV__) {
      console.log(`🔐 [AuthManager] ${message}`, data || '');
    }
  }

  private logError(message: string, error: unknown): void {
    if (__DEV__) {
      console.error(`🔐 [AuthManager] ${message}`, error);
    }
  }
}

// Singleton instance
export const authManager = new AuthManager();
export default AuthManager;