/**
 * Auth Context - Production Grade Authentication Provider
 * Provides auth state and actions to navigation system
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useAuthStore, User } from "@/stores/authStore";
import { tokenManager } from "@/services/tokenManager";
import { authServiceV2 } from "@/services/authV2";
import { ApiError } from "@/services/apiClient";

// ── Types ────────────────────────────────────────────────────────
export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";
export type UserRole = "free" | "premium" | "admin";

export interface AuthState {
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboarded: boolean;
  user: User | null;
  userRole: UserRole;
  error: string | null;
  tokenExpiringSoon: boolean;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: (logoutAllDevices?: boolean) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export interface AuthContextValue extends AuthState, AuthActions {}

// ── Context ──────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider Props ───────────────────────────────────────────────
interface AuthProviderProps {
  children: React.ReactNode;
  onAuthStateChange?: (state: AuthState) => void;
}

// ── Constants ─────────────────────────────────────────────────────
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
const AUTH_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

// ── Auth Provider Component ───────────────────────────────────────
export function AuthProvider({
  children,
  onAuthStateChange,
}: AuthProviderProps) {
  const store = useAuthStore();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("free");
  const [tokenExpiringSoon, setTokenExpiringSoon] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Compute derived state
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading" || status === "idle";

  // Sync with store
  useEffect(() => {
    if (onAuthStateChange) {
      onAuthStateChange({
        status,
        isAuthenticated,
        isLoading,
        isOnboarded,
        user: store.user,
        userRole,
        error: store.error,
        tokenExpiringSoon,
      });
    }
  }, [
    status,
    isAuthenticated,
    isLoading,
    isOnboarded,
    store.user,
    userRole,
    store.error,
    tokenExpiringSoon,
  ]);

  // Initialize auth state on mount
  useEffect(() => {
    if (initialized) return;

    const initializeAuth = async () => {
      console.log("🔐 Initializing auth state...");
      setStatus("loading");

      try {
        const user = await authServiceV2.checkAuth();

        if (user) {
          console.log("🔐 Session verified for user:", user.email);
          store.setUser(user);
          setStatus("authenticated");

          // Determine user role from user data
          const role = (user as any).role || "free";
          setUserRole(role);

          // Check onboarding status
          const onboarded = (user as any).preferences?.onboarded ?? false;
          setIsOnboarded(onboarded);
        } else {
          console.log("🔐 Session verification failed");
          setStatus("unauthenticated");
          store.clearUser();
        }
      } catch (error) {
        console.error("🔐 Auth initialization error:", error);
        setStatus("error");
        store.setError(
          error instanceof Error ? error.message : "Authentication failed",
        );
      } finally {
        setInitialized(true);
      }
    };

    initializeAuth();
  }, [initialized]);

  // Note: Token subscription is handled internally by tokenManager
  // through its refresh mechanism and getValidToken() method

  // Periodic token check
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkToken = async () => {
      const isExpired = await tokenManager.isTokenExpired();
      setTokenExpiringSoon(isExpired);

      if (isExpired) {
        console.log("🔐 Token expiring soon, refreshing...");
        await refreshSession();
      }
    };

    const interval = setInterval(checkToken, AUTH_CHECK_INTERVAL_MS);
    checkToken(); // Initial check

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // ── Actions ──────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    console.log("🔐 Logging in:", email);
    setStatus("loading");
    store.setError(null);

    try {
      const user = await authServiceV2.login({ email, password });
      store.setUser(user);
      setStatus("authenticated");

      const role = (user as any).role || "free";
      setUserRole(role);

      const onboarded = (user as any).preferences?.onboarded ?? false;
      setIsOnboarded(onboarded);

      console.log("🔐 Login successful");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.userMessage : "Login failed";
      store.setError(message);
      setStatus("unauthenticated");
      throw error;
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      console.log("🔐 Registering:", email);
      setStatus("loading");
      store.setError(null);

      try {
        const user = await authServiceV2.register({ name, email, password });
        store.setUser(user);
        setStatus("authenticated");
        setUserRole("free");
        setIsOnboarded(false);

        console.log("🔐 Registration successful");
      } catch (error) {
        const message =
          error instanceof ApiError ? error.userMessage : "Registration failed";
        store.setError(message);
        setStatus("unauthenticated");
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(async (logoutAllDevices: boolean = false) => {
    console.log("🔐 Logging out...");
    setStatus("loading");

    try {
      await authServiceV2.logout(logoutAllDevices);
    } catch (error) {
      console.error("🔐 Logout error:", error);
    } finally {
      store.clearUser();
      setStatus("unauthenticated");
      setUserRole("free");
      setIsOnboarded(false);
      setTokenExpiringSoon(false);
      console.log("🔐 Logout complete");
    }
  }, []);

  const refreshSession = useCallback(async () => {
    console.log("🔐 Refreshing session...");

    try {
      const newToken = await tokenManager.refreshAccessToken();

      if (newToken) {
        console.log("🔐 Session refreshed");
        setTokenExpiringSoon(false);

        // Re-verify user
        const user = await authServiceV2.checkAuth();
        if (user) {
          store.setUser(user);
        }
      } else {
        console.log("🔐 Session refresh failed, logging out");
        setStatus("unauthenticated");
        store.clearUser();
      }
    } catch (error) {
      console.error("🔐 Session refresh error:", error);
      setStatus("unauthenticated");
      store.clearUser();
    }
  }, []);

  const clearError = useCallback(() => {
    store.setError(null);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    if (status !== "authenticated") return;

    try {
      const user = await authServiceV2.checkAuth();
      if (user) {
        store.setUser(user);
        const role = (user as any).role || "free";
        setUserRole(role);
      } else {
        setStatus("unauthenticated");
        store.clearUser();
      }
    } catch (error) {
      console.error("🔐 Auth check error:", error);
    }
  }, [status]);

  const updateUser = useCallback((updates: Partial<User>) => {
    store.updateUser(updates);
  }, []);

  // ── Context Value ────────────────────────────────────────────────
  const value = useMemo<AuthContextValue>(
    () => ({
      // State
      status,
      isAuthenticated,
      isLoading,
      isOnboarded,
      user: store.user,
      userRole,
      error: store.error,
      tokenExpiringSoon,

      // Actions
      login,
      register,
      logout,
      refreshSession,
      clearError,
      checkAuthStatus,
      updateUser,
    }),
    [
      status,
      isAuthenticated,
      isLoading,
      isOnboarded,
      store.user,
      userRole,
      store.error,
      tokenExpiringSoon,
      login,
      register,
      logout,
      refreshSession,
      clearError,
      checkAuthStatus,
      updateUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}

// ── Hook for just auth status (lighter weight) ────────────────────
export function useAuthStatus(): Pick<
  AuthState,
  "status" | "isAuthenticated" | "isLoading"
> {
  const { status, isAuthenticated, isLoading } = useAuthContext();
  return { status, isAuthenticated, isLoading };
}

// ── HOC for components that need auth ─────────────────────────────
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
): React.FC<P> {
  return function WithAuthComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuthContext();

    if (isLoading) {
      return null; // Or a loading spinner
    }

    if (!isAuthenticated) {
      return null; // Will be redirected by navigation
    }

    return <Component {...props} />;
  };
}

export default AuthContext;
