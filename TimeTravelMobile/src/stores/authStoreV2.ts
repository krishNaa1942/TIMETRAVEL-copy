/**
 * Production-Grade Authentication State Management
 * With secure token storage and automatic refresh
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  secureStorage,
  TokenData,
  StoredSession,
} from "../services/secureStorage";
import { API_BASE_URL } from "../constants/config";

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: (logoutAllDevices?: boolean) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// API base URL
const API_URL = API_BASE_URL;

// ============================================================================
// STORE
// ============================================================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isInitialized: false,
      error: null,

      initialize: async () => {
        try {
          set({ isLoading: true, error: null });
          await secureStorage.initialize();

          const hasTokens = await secureStorage.hasValidTokens();
          if (!hasTokens) {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              isInitialized: true,
            });
            return;
          }

          const isExpired = await secureStorage.isTokenExpired();
          if (isExpired) {
            const refreshed = await get().refreshSession();
            if (!refreshed) {
              await secureStorage.clearTokens();
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                isInitialized: true,
              });
              return;
            }
          }

          const session = await secureStorage.getSession();
          if (session) {
            set({
              user: { id: session.userId, name: "", email: session.email },
              isAuthenticated: true,
              isLoading: false,
              isInitialized: true,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              isInitialized: true,
            });
          }
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
            error: "Failed to initialize",
          });
        }
      },

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          const deviceId = await secureStorage.getDeviceId();

          const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Device-ID": deviceId,
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            set({ error: data.message || "Login failed", isLoading: false });
            return false;
          }

          const tokenData: TokenData = {
            accessToken: data.tokens.access_token,
            refreshToken: data.tokens.refresh_token,
            expiresAt: Date.now() + data.tokens.expires_in * 1000,
            tokenType: data.tokens.token_type,
          };

          await secureStorage.storeTokens(tokenData);
          await secureStorage.storeSession({
            userId: data.user.id,
            email: data.user.email,
            deviceId,
            lastActivity: Date.now(),
          });

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return true;
        } catch (error: any) {
          set({ error: error.message || "Login failed", isLoading: false });
          return false;
        }
      },

      register: async (name: string, email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          const deviceId = await secureStorage.getDeviceId();

          const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Device-ID": deviceId,
            },
            body: JSON.stringify({ name, email, password }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            set({
              error: data.message || "Registration failed",
              isLoading: false,
            });
            return false;
          }

          const tokenData: TokenData = {
            accessToken: data.tokens.access_token,
            refreshToken: data.tokens.refresh_token,
            expiresAt: Date.now() + data.tokens.expires_in * 1000,
            tokenType: data.tokens.token_type,
          };

          await secureStorage.storeTokens(tokenData);
          await secureStorage.storeSession({
            userId: data.user.id,
            email: data.user.email,
            deviceId,
            lastActivity: Date.now(),
          });

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return true;
        } catch (error: any) {
          set({
            error: error.message || "Registration failed",
            isLoading: false,
          });
          return false;
        }
      },

      logout: async (logoutAllDevices = false) => {
        try {
          const token = await secureStorage.getAccessToken();
          if (token) {
            await fetch(`${API_URL}/auth/logout`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ logout_all_devices: logoutAllDevices }),
            });
          }
        } catch {}

        await secureStorage.clearTokens();
        set({ user: null, isAuthenticated: false, error: null });
      },

      refreshSession: async () => {
        try {
          const refreshToken = await secureStorage.getRefreshToken();
          if (!refreshToken) return false;

          const deviceId = await secureStorage.getDeviceId();
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Device-ID": deviceId,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (!response.ok) return false;

          const data = await response.json();
          const tokenData: TokenData = {
            accessToken: data.tokens.access_token,
            refreshToken: data.tokens.refresh_token,
            expiresAt: Date.now() + data.tokens.expires_in * 1000,
            tokenType: data.tokens.token_type,
          };

          await secureStorage.storeTokens(tokenData);
          return true;
        } catch {
          return false;
        }
      },

      setUser: (user: User) => set({ user, isAuthenticated: true }),
      updateUser: (updates: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : state.user,
        })),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export default useAuthStore;
