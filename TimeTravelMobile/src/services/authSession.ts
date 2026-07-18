/**
 * Authentication Service - Session-Based Production Implementation
 * ================================================================
 * Uses Flask-Login sessions with automatic refresh support.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { DEBUG, SESSION_REFRESH_INTERVAL } from "../constants/config";
import { apiService } from "./api";

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  created_at?: string;
}

export interface AuthResponse {
  user: User;
  message: string;
  session_expires_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

// Storage keys
const AUTH_TOKEN_KEY = "authToken";
const USER_KEY = "user";
const SESSION_EXPIRY_KEY = "sessionExpiry";

/**
 * Session-based authentication service
 * Works with Flask-Login sessions using HTTP-only cookies
 */
class AuthService {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private currentUser: User | null = null;

  constructor() {
    this.initializeFromStorage();
  }

  /**
   * Initialize auth state from stored session
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const [token, userJson, expiry] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(SESSION_EXPIRY_KEY),
      ]);

      if (token && userJson) {
        this.currentUser = JSON.parse(userJson);

        // Check if session needs refresh
        if (expiry) {
          const expiryTime = new Date(expiry).getTime();
          const now = Date.now();

          if (now >= expiryTime) {
            // Session expired, try refresh
            await this.refreshSession();
          } else {
            // Schedule refresh before expiry
            this.scheduleRefresh(expiryTime);
          }
        }
      }

      if (DEBUG.AUTH) {
        console.log(
          "[Auth] Initialized, user:",
          this.currentUser?.email || "none",
        );
      }
    } catch (error) {
      console.error("[Auth] Initialization error:", error);
    }
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>(
        "/auth/login",
        credentials,
      );

      // Store session marker
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, "session-active");
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

      // Store expiry if provided
      if (response.session_expires_at) {
        await AsyncStorage.setItem(
          SESSION_EXPIRY_KEY,
          response.session_expires_at,
        );
        this.scheduleRefresh(new Date(response.session_expires_at).getTime());
      }

      this.currentUser = response.user;

      if (DEBUG.AUTH) {
        console.log("[Auth] Login successful:", response.user.email);
      }

      return response;
    } catch (error) {
      if (DEBUG.AUTH) {
        console.error("[Auth] Login failed:", error);
      }
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>(
        "/auth/register",
        credentials,
      );

      // Store session marker
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, "session-active");
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

      if (response.session_expires_at) {
        await AsyncStorage.setItem(
          SESSION_EXPIRY_KEY,
          response.session_expires_at,
        );
        this.scheduleRefresh(new Date(response.session_expires_at).getTime());
      }

      this.currentUser = response.user;

      if (DEBUG.AUTH) {
        console.log("[Auth] Registration successful:", response.user.email);
      }

      return response;
    } catch (error) {
      if (DEBUG.AUTH) {
        console.error("[Auth] Registration failed:", error);
      }
      throw error;
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      // Call backend to clear session
      await apiService.post("/auth/logout", {});
    } catch (error) {
      // Continue with local cleanup even if API fails
      console.warn("[Auth] Logout API call failed:", error);
    } finally {
      // Clear local storage
      await this.clearLocalSession();
    }
  }

  /**
   * Clear local session data
   */
  private async clearLocalSession(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
      AsyncStorage.removeItem(SESSION_EXPIRY_KEY),
    ]);

    this.currentUser = null;

    // Stop refresh timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (DEBUG.AUTH) {
      console.log("[Auth] Local session cleared");
    }
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<AuthResponse | null> {
    try {
      const response = await apiService.post<AuthResponse>("/auth/refresh", {});

      if (response.user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));

        if (response.session_expires_at) {
          await AsyncStorage.setItem(
            SESSION_EXPIRY_KEY,
            response.session_expires_at,
          );
          this.scheduleRefresh(new Date(response.session_expires_at).getTime());
        }

        this.currentUser = response.user;

        if (DEBUG.AUTH) {
          console.log("[Auth] Session refreshed");
        }

        return response;
      }

      return null;
    } catch (error) {
      if (DEBUG.AUTH) {
        console.log("[Auth] Session refresh failed:", error);
      }

      // Session is invalid, clear local state
      await this.clearLocalSession();

      return null;
    }
  }

  /**
   * Schedule automatic session refresh
   */
  private scheduleRefresh(expiryTime: number): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;

    // Refresh 5 minutes before expiry, or at configured interval
    const refreshTime = Math.min(
      timeUntilExpiry - 5 * 60 * 1000,
      SESSION_REFRESH_INTERVAL,
    );

    if (refreshTime > 0) {
      this.refreshTimer = setInterval(() => {
        this.refreshSession().catch((error) => {
          console.error("[Auth] Scheduled refresh failed:", error);
        });
      }, refreshTime);

      if (DEBUG.AUTH) {
        console.log(
          `[Auth] Session refresh scheduled in ${Math.round(refreshTime / 1000)}s`,
        );
      }
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      if (userJson) {
        this.currentUser = JSON.parse(userJson);
        return this.currentUser;
      }
    } catch (error) {
      console.error("[Auth] Error getting current user:", error);
    }

    return null;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const user = await this.getCurrentUser();
      return !!(token && user);
    } catch {
      return false;
    }
  }

  /**
   * Verify session with backend
   */
  async verifySession(): Promise<boolean> {
    try {
      const response = await apiService.get<{
        authenticated: boolean;
        user?: User;
      }>("/auth/me");

      if (response.authenticated && response.user) {
        this.currentUser = response.user;
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
        return true;
      }

      return false;
    } catch (error) {
      if (DEBUG.AUTH) {
        console.log("[Auth] Session verification failed:", error);
      }
      return false;
    }
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await apiService.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });

    if (DEBUG.AUTH) {
      console.log("[Auth] Password changed successfully");
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export class for testing
export default AuthService;
