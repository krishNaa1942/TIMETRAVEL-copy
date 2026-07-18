/**
 * Auth Store (REFACTORED)
 * =======================
 * 
 * SINGLE RESPONSIBILITY: Authentication state ONLY
 * 
 * What's NEW:
 * - Removed server state (user profile moved to React Query)
 * - Only stores tokens and auth status
 * - Uses secure storage for tokens
 * - Clean separation of concerns
 * 
 * What's REMOVED:
 * - user object (now in useUser() hook)
 * - API calls (now in useAuth mutations)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type AuthStatus = 
  | 'idle'           // Initial state
  | 'checking'       // Checking stored tokens
  | 'authenticated'  // Valid session
  | 'unauthenticated' // No valid session
  | 'refreshing';    // Refreshing tokens

export interface AuthState {
  // Core Auth State (CLIENT ONLY)
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  
  // UI State
  isInitializing: boolean;
  lastError: string | null;

  // Actions
  setTokens: (access: string, refresh: string, expiresIn: number) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  getRefreshToken: () => Promise<string | null>;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  clearTokens: () => Promise<void>;
  initialize: () => Promise<void>;
  isAuthenticated: () => boolean;
}

// ─────────────────────────────────────────────────────────────
// SECURE STORAGE HELPERS
// ─────────────────────────────────────────────────────────────

const SECURE_STORE_KEY_ACCESS = 'auth_access_token';
const SECURE_STORE_KEY_REFRESH = 'auth_refresh_token';

const saveTokensSecure = async (
  accessToken: string, 
  refreshToken: string
): Promise<void> => {
  try {
    await SecureStore.setItemAsync(SECURE_STORE_KEY_ACCESS, accessToken);
    await SecureStore.setItemAsync(SECURE_STORE_KEY_REFRESH, refreshToken);
  } catch (error) {
    // Fallback to AsyncStorage on web
    await AsyncStorage.setItem(SECURE_STORE_KEY_ACCESS, accessToken);
    await AsyncStorage.setItem(SECURE_STORE_KEY_REFRESH, refreshToken);
  }
};

const getAccessTokenSecure = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(SECURE_STORE_KEY_ACCESS);
  } catch {
    return AsyncStorage.getItem(SECURE_STORE_KEY_ACCESS);
  }
};

const getRefreshTokenSecure = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(SECURE_STORE_KEY_REFRESH);
  } catch {
    return AsyncStorage.getItem(SECURE_STORE_KEY_REFRESH);
  }
};

const clearTokensSecure = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY_ACCESS);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY_REFRESH);
  } catch {
    await AsyncStorage.multiRemove([
      SECURE_STORE_KEY_ACCESS,
      SECURE_STORE_KEY_REFRESH
    ]);
  }
};

// ─────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      status: 'idle',
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isInitializing: true,
      lastError: null,

      // ───────────────────────────────────────────────────────
      // SET TOKENS
      // ───────────────────────────────────────────────────────
      setTokens: async (access, refresh, expiresIn) => {
        await saveTokensSecure(access, refresh);
        
        const expiresAt = Date.now() + expiresIn * 1000;
        
        set({
          accessToken: access,
          refreshToken: refresh,
          expiresAt,
          status: 'authenticated',
          lastError: null,
          isInitializing: false,
        });
      },

      // ───────────────────────────────────────────────────────
      // GET ACCESS TOKEN
      // ───────────────────────────────────────────────────────
      getAccessToken: async () => {
        const state = get();
        
        // Check if token is expired
        if (state.expiresAt && Date.now() > state.expiresAt) {
          return null; // Token expired, needs refresh
        }
        
        // Return from memory or secure storage
        if (state.accessToken) {
          return state.accessToken;
        }
        
        return getAccessTokenSecure();
      },

      // ───────────────────────────────────────────────────────
      // GET REFRESH TOKEN
      // ───────────────────────────────────────────────────────
      getRefreshToken: async () => {
        const state = get();
        
        if (state.refreshToken) {
          return state.refreshToken;
        }
        
        return getRefreshTokenSecure();
      },

      // ───────────────────────────────────────────────────────
      // SET STATUS
      // ───────────────────────────────────────────────────────
      setStatus: (status) => set({ status }),

      // ───────────────────────────────────────────────────────
      // SET ERROR
      // ───────────────────────────────────────────────────────
      setError: (error) => set({ lastError: error }),

      // ───────────────────────────────────────────────────────
      // CLEAR TOKENS (Logout)
      // ───────────────────────────────────────────────────────
      clearTokens: async () => {
        await clearTokensSecure();
        
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          status: 'unauthenticated',
          lastError: null,
          isInitializing: false,
        });
      },

      // ───────────────────────────────────────────────────────
      // INITIALIZE
      // ───────────────────────────────────────────────────────
      initialize: async () => {
        set({ isInitializing: true, status: 'checking' });
        
        try {
          const accessToken = await getAccessTokenSecure();
          const refreshToken = await getRefreshTokenSecure();
          
          if (accessToken && refreshToken) {
            set({
              accessToken,
              refreshToken,
              status: 'authenticated',
              isInitializing: false,
            });
          } else {
            set({
              status: 'unauthenticated',
              isInitializing: false,
            });
          }
        } catch (error) {
          set({
            status: 'unauthenticated',
            isInitializing: false,
            lastError: 'Failed to initialize auth',
          });
        }
      },

      // ───────────────────────────────────────────────────────
      // IS AUTHENTICATED
      // ───────────────────────────────────────────────────────
      isAuthenticated: () => {
        const state = get();
        return state.status === 'authenticated' && !!state.accessToken;
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist non-sensitive metadata
      partialize: (state) => ({
        status: state.status,
        expiresAt: state.expiresAt,
      }),
    }
  )
);

// ─────────────────────────────────────────────────────────────
// SELECTORS (For optimized subscriptions)
// ─────────────────────────────────────────────────────────────

export const selectAuthStatus = (state: AuthState) => state.status;
export const selectIsAuthenticated = (state: AuthState) => 
  state.status === 'authenticated';
export const selectIsInitializing = (state: AuthState) => state.isInitializing;
export const selectAuthError = (state: AuthState) => state.lastError;

export default useAuthStore;