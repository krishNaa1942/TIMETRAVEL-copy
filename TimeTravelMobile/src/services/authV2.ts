/**
 * 🔐 PRODUCTION AUTH SERVICE (JWT-based)
 * ======================================
 *
 * Integrates with Flask backend JWT authentication (auth_v2.py)
 * - Handles access/refresh token pairs
 * - Auto-refreshes expired tokens
 * - Secure token storage via TokenManager
 * - Full error handling with user-friendly messages
 */

import { apiClient, tokenManager, ApiError } from "./apiClient";
import { useAuthStore, User } from "@/stores/authStore";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
}

// ─────────────────────────────────────────────────────────────
// AUTH SERVICE
// ─────────────────────────────────────────────────────────────

export const authServiceV2 = {
  /**
   * Login with email and password
   * Returns JWT tokens that are automatically stored
   */
  async login(credentials: LoginCredentials): Promise<User> {
    console.log("🔐 [AUTH] Login attempt for:", credentials.email);

    // Validate input
    if (!credentials.email?.trim()) {
      throw new ApiError({
        code: "VALIDATION_ERROR",
        message: "Email is required",
        status: 400,
        retryable: false,
        userMessage: "Please enter your email address.",
      });
    }

    if (!credentials.password) {
      throw new ApiError({
        code: "VALIDATION_ERROR",
        message: "Password is required",
        status: 400,
        retryable: false,
        userMessage: "Please enter your password.",
      });
    }

    try {
      const response = await apiClient.post<AuthResponse>(
        "/auth/v2/login",
        {
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
        },
        { skipDedup: true },
      );

      if (!response.success || !response.user || !response.tokens) {
        throw new ApiError({
          code: "INVALID_RESPONSE",
          message: "Invalid server response",
          status: 500,
          retryable: false,
          userMessage: "Login failed. Please try again.",
        });
      }

      // Store tokens
      await tokenManager.setTokens(response.tokens);

      // Create user object
      const user: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
      };

      // Update auth store
      const { setUser } = useAuthStore.getState();
      setUser(user);

      console.log("✅ [AUTH] Login successful for:", user.email);
      return user;
    } catch (error) {
      console.log("[AUTH] Login failed:", error);

      if (error instanceof ApiError) {
        // Add context-specific messages
        if (error.code === "UNAUTHORIZED" || error.status === 401) {
          throw new ApiError({
            ...error,
            userMessage: "Invalid email or password. Please try again.",
          });
        }
        if (error.code === "NOT_FOUND" || error.status === 404) {
          throw new ApiError({
            ...error,
            userMessage:
              "Sign-in service is unavailable right now. Please try again.",
          });
        }
        throw error;
      }

      throw new ApiError({
        code: "LOGIN_FAILED",
        message: "Login failed",
        status: 500,
        retryable: false,
        userMessage:
          "Unable to log in. Please check your connection and try again.",
      });
    }
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<User> {
    console.log("🔐 [AUTH] Registration attempt for:", data.email);

    // Validate input
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push("Name is required");
    } else if (data.name.trim().length > 100) {
      errors.push("Name is too long (max 100 characters)");
    }

    if (!data.email?.trim()) {
      errors.push("Email is required");
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(data.email.trim().toLowerCase())) {
        errors.push("Invalid email format");
      }
    }

    if (!data.password) {
      errors.push("Password is required");
    } else {
      if (data.password.length < 8) {
        errors.push("Password must be at least 8 characters");
      }
      if (!/[A-Z]/.test(data.password)) {
        errors.push("Password must contain an uppercase letter");
      }
      if (!/[a-z]/.test(data.password)) {
        errors.push("Password must contain a lowercase letter");
      }
      if (!/[0-9]/.test(data.password)) {
        errors.push("Password must contain a digit");
      }
    }

    if (errors.length > 0) {
      throw new ApiError({
        code: "VALIDATION_ERROR",
        message: errors.join(". "),
        status: 400,
        retryable: false,
        userMessage: errors.join(". "),
      });
    }

    try {
      const response = await apiClient.post<AuthResponse>(
        "/auth/v2/register",
        {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
        },
        { skipDedup: true },
      );

      if (!response.success || !response.user || !response.tokens) {
        throw new ApiError({
          code: "INVALID_RESPONSE",
          message: "Invalid server response",
          status: 500,
          retryable: false,
          userMessage: "Registration failed. Please try again.",
        });
      }

      // Store tokens
      await tokenManager.setTokens(response.tokens);

      // Create user object
      const user: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
      };

      // Update auth store
      const { setUser } = useAuthStore.getState();
      setUser(user);

      console.log("✅ [AUTH] Registration successful for:", user.email);
      return user;
    } catch (error) {
      console.log("[AUTH] Registration failed:", error);

      if (error instanceof ApiError) {
        if (error.code === "CONFLICT" || error.status === 409) {
          throw new ApiError({
            ...error,
            userMessage:
              "An account with this email already exists. Please log in instead.",
          });
        }
        if (error.code === "NOT_FOUND" || error.status === 404) {
          throw new ApiError({
            ...error,
            userMessage:
              "Sign-up service is unavailable right now. Please try again.",
          });
        }
        throw error;
      }

      throw new ApiError({
        code: "REGISTRATION_FAILED",
        message: "Registration failed",
        status: 500,
        retryable: false,
        userMessage: "Unable to create account. Please try again.",
      });
    }
  },

  /**
   * Logout user
   */
  async logout(logoutAllDevices: boolean = false): Promise<void> {
    console.log("🔐 [AUTH] Logout initiated");

    try {
      // Call logout endpoint to invalidate tokens on server
      await apiClient.post(
        "/auth/v2/logout",
        {
          logout_all_devices: logoutAllDevices,
        },
        { skipRetry: true },
      );
      console.log("✅ [AUTH] Server logout successful");
    } catch (error) {
      // Continue with local logout even if server fails
      console.log(
        "[AUTH] Server logout failed (continuing with local):",
        error,
      );
    }

    // Clear local tokens
    await tokenManager.clearTokens();

    // Update auth store
    const { clearUser } = useAuthStore.getState();
    clearUser();

    console.log("✅ [AUTH] Local logout completed");
  },

  /**
   * Check if user is authenticated
   */
  async checkAuth(): Promise<User | null> {
    console.log("🔐 [AUTH] Checking authentication status");

    // Load tokens from storage if not in memory
    await tokenManager.loadTokensFromStorage();

    const token = await tokenManager.getValidToken();

    if (!token) {
      console.log("ℹ️ [AUTH] Not authenticated");
      return null;
    }

    try {
      // Verify with server
      const response = await apiClient.get<{
        user: { id: string; name: string; email: string };
      }>("/auth/v2/me");

      if (response.user) {
        const user: User = {
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
        };

        const { setUser } = useAuthStore.getState();
        setUser(user);

        console.log("✅ [AUTH] User authenticated:", user.email);
        return user;
      }

      return null;
    } catch (error) {
      console.log("[AUTH] Auth check failed:", error);
      return null;
    }
  },

  /**
   * Get active sessions
   */
  async getSessions(): Promise<any[]> {
    try {
      const response = await apiClient.get<{ sessions: any[] }>(
        "/auth/v2/sessions",
      );
      return response.sessions || [];
    } catch (error) {
      console.log("[AUTH] Failed to get sessions:", error);
      return [];
    }
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/auth/v2/sessions/${sessionId}`);
  },

  /**
   * Update user profile
   */
  async updateProfile(data: { name?: string; email?: string }): Promise<User> {
    const response = await apiClient.put<{
      success: boolean;
      user: { id: string; name: string; email: string };
    }>("/auth/v2/profile", data);

    if (response.user) {
      const user: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
      };

      const { setUser } = useAuthStore.getState();
      setUser(user);

      return user;
    }

    throw new ApiError({
      code: "UPDATE_FAILED",
      message: "Failed to update profile",
      status: 500,
      retryable: false,
      userMessage: "Unable to update profile. Please try again.",
    });
  },
};

export default authServiceV2;
