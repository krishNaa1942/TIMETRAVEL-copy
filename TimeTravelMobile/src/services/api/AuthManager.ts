/**
 * 🔐 AUTH MANAGER
 * Enterprise-grade token lifecycle management
 * 
 * Features:
 * - Secure storage using Expo SecureStore (NOT AsyncStorage)
 * - Automatic token refresh
 * - Request queue during refresh (prevents race conditions)
 * - Token rotation support
 * - Silent re-authentication
 */

import * as SecureStore from 'expo-secure-store';
import { TokenPair, StructuredError } from './types';

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────
const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  TOKEN_EXPIRY: 'auth_token_expiry',
  USER_ID: 'auth_user_id',
} as const;

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

// ─────────────────────────────────────────────────────────────
// AUTH EVENTS
// ─────────────────────────────────────────────────────────────
type AuthEventType = 'tokenRefresh' | 'tokenExpired' | 'logout' | 'login';
type AuthEventCallback = (event: AuthEventType, data?: unknown) => void;

// ─────────────────────────────────────────────────────────────
// AUTH MANAGER CLASS
// ─────────────────────────────────────────────────────────────
class AuthManager {
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];
  private failedRefreshSubscribers: Array<(error: Error) => void> = [];
  private eventListeners: Map<AuthEventType, Set<AuthEventCallback>> = new Map();
  
  // Cached tokens for fast access
  private cachedAccessToken: string | null = null;
  private cachedRefreshToken: string | null = null;
  private cachedExpiry: number | null = null;

  /**
   * Initialize auth manager - load tokens from secure storage
   */
  async initialize(): Promise<void> {
    try {
      const [accessToken, refreshToken, expiry] = await Promise.all([
        SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN).catch(() => null),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN).catch(() => null),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.TOKEN_EXPIRY).catch(() => null),
      ]);

      this.cachedAccessToken = accessToken;
      this.cachedRefreshToken = refreshToken;
      this.cachedExpiry = expiry ? parseInt(expiry, 10) : null;

      this.log('Initialized', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        expiresAt: expiry ? new Date(parseInt(expiry, 10)).toISOString() : 'N/A',
      });
    } catch (error) {
      this.logError('Failed to initialize', error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TOKEN STORAGE (SECURE)
  // ─────────────────────────────────────────────────────────────

  /**
   * Store tokens securely
   */
  async setTokens(tokens: TokenPair): Promise<void> {
    const { accessToken, refreshToken, expiresAt } = tokens;

    await Promise.all([
      SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, refreshToken),
      SecureStore.setItemAsync(SECURE_STORE_KEYS.TOKEN_EXPIRY, expiresAt.toString()),
    ]);

    // Update cache
    this.cachedAccessToken = accessToken;
    this.cachedRefreshToken = refreshToken;
    this.cachedExpiry = expiresAt;

    this.log('Tokens stored securely');
    this.emitEvent('login', { expiresAt });
  }

  /**
   * Get access token (from cache or secure storage)
   */
  async getAccessToken(): Promise<string | null> {
    if (this.cachedAccessToken) {
      return this.cachedAccessToken;
    }

    try {
      const token = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
      this.cachedAccessToken = token;
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    if (this.cachedRefreshToken) {
      return this.cachedRefreshToken;
    }

    try {
      const token = await SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
      this.cachedRefreshToken = token;
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Clear all tokens (logout)
   */
  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN).catch(() => {}),
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN).catch(() => {}),
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.TOKEN_EXPIRY).catch(() => {}),
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER_ID).catch(() => {}),
    ]);

    // Clear cache
    this.cachedAccessToken = null;
    this.cachedRefreshToken = null;
    this.cachedExpiry = null;

    this.log('Tokens cleared');
    this.emitEvent('logout');
  }

  /**
   * Check if token is expired or about to expire
   */
  async isTokenExpired(): Promise<boolean> {
    const expiry = this.cachedExpiry || 
      parseInt(await SecureStore.getItemAsync(SECURE_STORE_KEYS.TOKEN_EXPIRY).catch(() => '0') || '0', 10);

    if (!expiry) return true;
    
    // Consider expired if within threshold
    return Date.now() >= (expiry - TOKEN_REFRESH_THRESHOLD_MS);
  }

  /**
   * Get time until token expires (in ms)
   */
  getTimeUntilExpiry(): number {
    if (!this.cachedExpiry) return 0;
    return Math.max(0, this.cachedExpiry - Date.now());
  }

  // ─────────────────────────────────────────────────────────────
  // TOKEN REFRESH (RACE CONDITION SAFE)
  // ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to token refresh
   * Returns a promise that resolves when token is refreshed
   */
  subscribeToTokenRefresh(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.refreshSubscribers.push(resolve);
      this.failedRefreshSubscribers.push(reject);
    });
  }

  /**
   * Check if currently refreshing token
   */
  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Set refreshing state (called by API client)
   */
  setRefreshing(state: boolean): void {
    this.isRefreshing = state;
  }

  /**
   * Notify all subscribers that token was refreshed
   */
  notifyRefreshSuccess(newToken: string): void {
    this.refreshSubscribers.forEach(callback => callback(newToken));
    this.refreshSubscribers = [];
    this.failedRefreshSubscribers = [];
    this.emitEvent('tokenRefresh');
  }

  /**
   * Notify all subscribers that refresh failed
   */
  notifyRefreshFailure(error: Error): void {
    this.failedRefreshSubscribers.forEach(callback => callback(error));
    this.refreshSubscribers = [];
    this.failedRefreshSubscribers = [];
    this.emitEvent('tokenExpired', { error });
  }

  // ─────────────────────────────────────────────────────────────
  // EVENT HANDLING
  // ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to auth events
   */
  addEventListener(event: AuthEventType, callback: AuthEventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit auth event
   */
  private emitEvent(event: AuthEventType, data?: unknown): void {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        this.logError('Event listener error', error);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // USER ID STORAGE
  // ─────────────────────────────────────────────────────────────

  async setUserId(userId: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER_ID, userId);
  }

  async getUserId(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_ID).catch(() => null);
  }

  // ─────────────────────────────────────────────────────────────
  // LOGGING (PRODUCTION SAFE)
  // ─────────────────────────────────────────────────────────────

  private log(message: string, data?: unknown): void {
    if (__DEV__) {
      console.log(`🔐 [AuthManager] ${message}`, data ?? '');
    }
  }

  private logError(message: string, error: unknown): void {
    if (__DEV__) {
      console.error(`🔐❌ [AuthManager] ${message}`, error);
    }
    // In production, send to error tracking service
    // e.g., Sentry.captureException(error);
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────
export const authManager = new AuthManager();
export default authManager;