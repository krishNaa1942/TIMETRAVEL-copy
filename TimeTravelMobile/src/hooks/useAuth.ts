/**
 * 🔐 useAuth Hook
 * ==============
 * React hook for authentication state and actions
 * Automatically syncs with TokenManager
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthStore, User } from "@/stores/authStore";
import { authServiceV2 } from "@/services/authV2";
import { tokenManager, ApiError } from "@/services/apiClient";

export interface UseAuthReturn {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: (logoutAllDevices?: boolean) => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const {
    user,
    isAuthenticated,
    setUser,
    clearUser,
    setLoading,
    setError,
    isLoading,
    error,
  } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      if (initialized) return;

      setLoading(true);

      try {
        const verifiedUser = await authServiceV2.checkAuth();
        if (verifiedUser) {
          setUser(verifiedUser);
        } else {
          clearUser();
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
        clearUser();
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initAuth();

    // Subscribe to token changes
    const unsubscribe = tokenManager.subscribe((authenticated) => {
      if (!authenticated) {
        clearUser();
      }
    });

    return unsubscribe;
  }, [initialized]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const loggedInUser = await authServiceV2.login({ email, password });
      setUser(loggedInUser);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.userMessage : "Login failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setLoading(true);
      setError(null);

      try {
        const newUser = await authServiceV2.register({ name, email, password });
        setUser(newUser);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.userMessage : "Registration failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async (logoutAllDevices: boolean = false) => {
    setLoading(true);

    try {
      await authServiceV2.logout(logoutAllDevices);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      clearUser();
      setLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    setLoading(true);

    try {
      const verifiedUser = await authServiceV2.checkAuth();
      if (verifiedUser) {
        setUser(verifiedUser);
      } else {
        clearUser();
      }
    } catch (err) {
      console.error("Auth check error:", err);
      clearUser();
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateProfile = useCallback(
    async (data: { name?: string; email?: string }) => {
      setLoading(true);
      setError(null);

      try {
        const updatedUser = await authServiceV2.updateProfile(data);
        setUser(updatedUser);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.userMessage
            : "Failed to update profile";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    checkAuth,
    clearError,
    updateProfile,
  };
}

export default useAuth;
