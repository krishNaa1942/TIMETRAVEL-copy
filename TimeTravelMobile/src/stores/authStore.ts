/**
 * Authentication Store (Zustand)
 * Manages user authentication state with secure token restoration
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient, ApiError, tokenManager } from "@/services/apiClient";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  preferences?: Record<string, any>;
}

export interface AuthStore {
  // State
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Actions
  setToken: (token: string) => Promise<void>;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearUser: () => void;
  logout: () => Promise<void>;
  loadAuthState: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AUTH_TOKEN_MARKER = "session-active";

const normalizeUser = (user: {
  id: string | number;
  name: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  preferences?: Record<string, any>;
}): User => ({
  id: String(user.id),
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  avatar_url: user.avatar_url,
  preferences: user.preferences,
});

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      token: null,
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,

      // Action: Set token and persist
      setToken: async (token: string) => {
        set({
          token: token ? AUTH_TOKEN_MARKER : null,
          isAuthenticated: !!token,
        });
      },

      // Action: Set user
      setUser: (user: User) => {
        set({
          user,
          token: AUTH_TOKEN_MARKER,
          isAuthenticated: true,
        });
      },

      // Action: Set loading state
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      // Action: Set error
      setError: (error: string | null) => {
        set({ error });
      },

      // Action: Clear user (for logout)
      clearUser: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      // Action: Logout
      logout: async () => {
        try {
          const accessToken = await tokenManager.getValidToken();
          if (accessToken) {
            await apiClient.post(
              "/auth/v2/logout",
              { logout_all_devices: false },
              { skipRetry: true, skipDedup: true },
            );
          }
        } catch (error) {
          console.log("[AUTH] Failed to logout:", error);
        } finally {
          await tokenManager.clearTokens();
          set({ token: null, user: null, isAuthenticated: false });
        }
      },

      // Action: Load auth state from storage
      loadAuthState: async () => {
        try {
          set({ isLoading: true });
          await tokenManager.loadTokensFromStorage();

          const token = await tokenManager.getValidToken();

          if (!token) {
            set({ isLoading: false, isAuthenticated: false, token: null });
            return;
          }

          try {
            const response = await apiClient.get<{
              user: {
                id: string | number;
                name: string;
                email: string;
                avatar?: string;
                avatar_url?: string;
                preferences?: Record<string, any>;
              };
            }>("/auth/v2/me");

            if (response.user) {
              set({
                token: AUTH_TOKEN_MARKER,
                user: normalizeUser(response.user),
                isLoading: false,
                isAuthenticated: true,
              });
              return;
            }
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              await tokenManager.clearTokens();
              set({
                token: null,
                user: null,
                isLoading: false,
                isAuthenticated: false,
              });
              return;
            }

            const currentUser = get().user;
            set({
              token: AUTH_TOKEN_MARKER,
              user: currentUser,
              isLoading: false,
              isAuthenticated: true,
            });
            return;
          }

          const currentUser = get().user;
          set({
            token: AUTH_TOKEN_MARKER,
            user: currentUser,
            isLoading: false,
            isAuthenticated: true,
          });
        } catch (error) {
          console.log("[AUTH] Failed to load auth state:", error);
          set({ isLoading: false, isAuthenticated: false });
        }
      },

      // Action: Update user profile
      updateUser: (updates: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
      }),
    },
  ),
);

tokenManager.subscribe((authenticated) => {
  if (!authenticated) {
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
    return;
  }

  useAuthStore.setState((state) => ({
    token: AUTH_TOKEN_MARKER,
    isAuthenticated: true,
    user: state.user,
  }));
});

export default useAuthStore;
