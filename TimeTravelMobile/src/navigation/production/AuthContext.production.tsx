/**
 * 🔐 PRODUCTION-GRADE AUTH CONTEXT
 * ================================
 * 
 * Enterprise-level authentication with:
 * - Zero flicker auth state transitions
 * - Silent background token refresh
 * - Request queue during token refresh
 * - Offline auth persistence
 * - Multi-device session handling
 * - Race condition protection
 * - Auto-recovery from auth failures
 * 
 * @architecture FAANG Production Standard
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore, User } from '@/stores/authStore';
import { productionTokenManager } from './TokenManager.production';
import { authServiceV2 } from '@/services/authV2';
import { ApiError } from '@/services/apiClient';
import { navigationAnalytics } from './NavigationAnalytics.production';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type AuthStatus = 
  | 'idle' 
  | 'checking' 
  | 'authenticated' 
  | 'unauthenticated' 
  | 'error'
  | 'refreshing';

export type UserRole = 'free' | 'premium' | 'admin';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  deviceId: string;
  lastActivity: number;
}

export interface AuthState {
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboarded: boolean;
  user: User | null;
  userRole: UserRole;
  error: string | null;
  tokenExpiringSoon: boolean;
  isOffline: boolean;
  sessionAge: number;
  deviceId: string;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
  checkAuthStatus: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  forceRefresh: () => Promise<void>;
}

export interface LogoutOptions {
  logoutAllDevices?: boolean;
  reason?: 'user_initiated' | 'token_expired' | 'session_invalid' | 'security';
}

export interface AuthContextValue extends AuthState, AuthActions {}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
const AUTH_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
const SESSION_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const OFFLINE_AUTH_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days offline
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ─────────────────────────────────────────────────────────────
// SECURE STORAGE HELPER
// ─────────────────────────────────────────────────────────────

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return AsyncStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`🔐 Secure storage get error for ${key}:`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
        return true;
      }
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (error) {
      console.error(`🔐 Secure storage set error for ${key}:`, error);
      return false;
    }
  },

  async deleteItem(key: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
        return true;
      }
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error(`🔐 Secure storage delete error for ${key}:`, error);
      return false;
    }
  },
};

// ─────────────────────────────────────────────────────────────
// DEVICE ID GENERATOR
// ─────────────────────────────────────────────────────────────

async function getOrCreateDeviceId(): Promise<string> {
  const DEVICE_ID_KEY = 'auth_device_id';
  
  let deviceId = await secureStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate unique device ID
    deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await secureStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

// ─────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// PROVIDER PROPS
// ─────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
  onAuthStateChange?: (state: AuthState) => void;
  onAuthError?: (error: Error) => void;
  onSessionExpired?: () => void;
  skipInitialCheck?: boolean;
}

// ─────────────────────────────────────────────────────────────
// AUTH PROVIDER COMPONENT
// ─────────────────────────────────────────────────────────────

export function AuthProvider({ 
  children, 
  onAuthStateChange,
  onAuthError,
  onSessionExpired,
  skipInitialCheck = false,
}: AuthProviderProps) {
  // ── State ────────────────────────────────────────────────────
  const store = useAuthStore();
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('free');
  const [tokenExpiringSoon, setTokenExpiringSoon] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  
  // ── Refs for race condition protection ───────────────────────
  const mountedRef = useRef(true);
  const initAttemptRef = useRef(0);
  const isInitializingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastActivityRef = useRef<number>(Date.now());
  const authCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ── Computed State ────────────────────────────────────────────
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'idle' || status === 'checking';
  const sessionAge = useMemo(() => {
    if (!store.user) return 0;
    return Date.now() - lastActivityRef.current;
  }, [store.user]);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      if (authCheckIntervalRef.current) {
        clearInterval(authCheckIntervalRef.current);
      }
    };
  }, []);

  // ── Initialize Device ID ───────────────────────────────────────
  useEffect(() => {
    getOrCreateDeviceId().then(id => {
      if (mountedRef.current) {
        setDeviceId(id);
      }
    });
  }, []);

  // ── Sync auth state to callback ────────────────────────────────
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
        isOffline,
        sessionAge,
        deviceId,
      });
    }
  }, [status, isAuthenticated, isLoading, isOnboarded, store.user, userRole, 
      store.error, tokenExpiringSoon, isOffline, sessionAge, deviceId]);

  // ── App State Listener (background/foreground) ────────────────
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - check auth
        console.log('🔐 App foregrounded - checking auth');
        handleAppForeground();
      } else if (nextAppState === 'background') {
        // App went to background - update last activity
        lastActivityRef.current = Date.now();
        console.log('🔐 App backgrounded');
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  // ── Handle app foreground ──────────────────────────────────────
  const handleAppForeground = useCallback(async () => {
    if (!mountedRef.current || !isAuthenticated) return;
    
    const timeSinceLastActivity = Date.now() - lastActivityRef.current;
    
    // If more than 5 minutes, verify session
    if (timeSinceLastActivity > 5 * 60 * 1000) {
      console.log('🔐 Verifying session after background');
      await checkAuthStatus();
    }
  }, [isAuthenticated]);

  // ── Initialize Auth (with race condition protection) ───────────
  useEffect(() => {
    if (skipInitialCheck || isInitializingRef.current) return;

    const initializeAuth = async () => {
      // Prevent concurrent initialization
      if (isInitializingRef.current) return;
      isInitializingRef.current = true;
      
      console.log('🔐 Initializing auth state...');
      
      if (!mountedRef.current) {
        isInitializingRef.current = false;
        return;
      }
      
      setStatus('checking');

      try {
        // Step 1: Check for offline auth first
        const offlineAuth = await checkOfflineAuth();
        
        if (offlineAuth && !navigator.onLine) {
          console.log('🔐 Using offline auth');
          if (mountedRef.current) {
            setIsOffline(true);
            setStatus('authenticated');
          }
          isInitializingRef.current = false;
          return;
        }

        // Step 2: Check token validity
        const hasValidToken = await productionTokenManager.hasValidToken();
        
        if (!hasValidToken) {
          console.log('🔐 No valid tokens found');
          if (mountedRef.current) {
            setStatus('unauthenticated');
            store.clearUser();
          }
          isInitializingRef.current = false;
          return;
        }

        // Step 3: Get valid token (will refresh if needed)
        const token = await productionTokenManager.getValidToken();
        
        if (!token) {
          console.log('🔐 Failed to get valid token');
          if (mountedRef.current) {
            setStatus('unauthenticated');
            store.clearUser();
          }
          isInitializingRef.current = false;
          return;
        }

        // Step 4: Verify session with server (with retry)
        const user = await verifySessionWithRetry();
        
        if (!mountedRef.current) {
          isInitializingRef.current = false;
          return;
        }
        
        if (user) {
          console.log('🔐 Session verified for user:', user.email);
          store.setUser(user);
          setStatus('authenticated');
          
          // Extract user metadata
          const role = (user as any).role || 'free';
          setUserRole(role);
          
          const onboarded = (user as any).preferences?.onboarded ?? false;
          setIsOnboarded(onboarded);
          
          // Save for offline auth
          await saveOfflineAuth(user);
          
          // Track analytics
          navigationAnalytics.trackEvent('auth_session_restored', {
            user_id: user.id,
            method: 'token_refresh',
          });
          
          // Reset retry counter
          initAttemptRef.current = 0;
        } else {
          console.log('🔐 Session verification failed');
          setStatus('unauthenticated');
          store.clearUser();
        }
      } catch (error) {
        console.error('🔐 Auth initialization error:', error);
        
        if (!mountedRef.current) {
          isInitializingRef.current = false;
          return;
        }
        
        // Check if offline
        if (!navigator.onLine) {
          const offlineAuth = await checkOfflineAuth();
          if (offlineAuth) {
            setIsOffline(true);
            setStatus('authenticated');
            isInitializingRef.current = false;
            return;
          }
        }
        
        setStatus('error');
        store.setError(error instanceof Error ? error.message : 'Authentication failed');
        
        if (onAuthError) {
          onAuthError(error instanceof Error ? error : new Error('Auth init failed'));
        }
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeAuth();
  }, [skipInitialCheck]);

  // ── Verify Session with Retry ──────────────────────────────────
  const verifySessionWithRetry = useCallback(async (): Promise<User | null> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const user = await authServiceV2.checkAuth();
        return user;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry for auth errors
        if (error instanceof ApiError && error.status === 401) {
          break;
        }
        
        // Wait before retry with exponential backoff
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt))
          );
        }
      }
    }
    
    console.error('🔐 Session verification failed after retries:', lastError);
    return null;
  }, []);

  // ── Offline Auth Helpers ────────────────────────────────────────
  const OFFLINE_AUTH_KEY = 'offline_auth_data';

  const saveOfflineAuth = async (user: User): Promise<void> => {
    try {
      const offlineData = {
        user,
        timestamp: Date.now(),
        deviceId,
      };
      await secureStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(offlineData));
    } catch (error) {
      console.error('🔐 Failed to save offline auth:', error);
    }
  };

  const checkOfflineAuth = async (): Promise<User | null> => {
    try {
      const data = await secureStorage.getItem(OFFLINE_AUTH_KEY);
      if (!data) return null;
      
      const { user, timestamp, deviceId: savedDeviceId } = JSON.parse(data);
      
      // Check if offline auth is still valid
      const age = Date.now() - timestamp;
      if (age > OFFLINE_AUTH_VALIDITY_MS) {
        console.log('🔐 Offline auth expired');
        await secureStorage.deleteItem(OFFLINE_AUTH_KEY);
        return null;
      }
      
      // Verify device ID matches
      if (savedDeviceId !== deviceId) {
        console.log('🔐 Device ID mismatch');
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('🔐 Failed to check offline auth:', error);
      return null;
    }
  };

  // ── Periodic Token Check ────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkToken = async () => {
      if (!mountedRef.current) return;
      
      try {
        const isExpiring = await productionTokenManager.isTokenExpiringSoon();
        setTokenExpiringSoon(isExpiring);

        if (isExpiring) {
          console.log('🔐 Token expiring soon, refreshing...');
          await refreshSession();
        }
      } catch (error) {
        console.error('🔐 Token check error:', error);
      }
    };

    // Initial check
    checkToken();
    
    // Set up interval
    authCheckIntervalRef.current = setInterval(checkToken, AUTH_CHECK_INTERVAL_MS);

    return () => {
      if (authCheckIntervalRef.current) {
        clearInterval(authCheckIntervalRef.current);
      }
    };
  }, [isAuthenticated]);

  // ── ACTIONS ─────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    console.log('🔐 Logging in:', email);
    setStatus('checking');
    store.setError(null);
    setIsOffline(false);

    try {
      // Login via auth service
      const result = await authServiceV2.login({ email, password });
      
      if (!mountedRef.current) return;
      
      store.setUser(result);
      setStatus('authenticated');
      
      const role = (result as any).role || 'free';
      setUserRole(role);
      
      const onboarded = (result as any).preferences?.onboarded ?? false;
      setIsOnboarded(onboarded);
      
      // Save offline auth
      await saveOfflineAuth(result);
      
      // Update last activity
      lastActivityRef.current = Date.now();
      
      // Track analytics
      navigationAnalytics.trackEvent('auth_login', {
        user_id: result.id,
        method: 'credentials',
      });
      
      console.log('🔐 Login successful');
    } catch (error) {
      if (!mountedRef.current) return;
      
      const message = error instanceof ApiError 
        ? error.userMessage 
        : 'Login failed';
      store.setError(message);
      setStatus('unauthenticated');
      
      if (onAuthError) {
        onAuthError(error instanceof Error ? error : new Error(message));
      }
      
      throw error;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    console.log('🔐 Registering:', email);
    setStatus('checking');
    store.setError(null);

    try {
      const result = await authServiceV2.register({ name, email, password });
      
      if (!mountedRef.current) return;
      
      store.setUser(result);
      setStatus('authenticated');
      setUserRole('free');
      setIsOnboarded(false);
      
      // Save offline auth
      await saveOfflineAuth(result);
      
      // Track analytics
      navigationAnalytics.trackEvent('auth_register', {
        user_id: result.id,
      });
      
      console.log('🔐 Registration successful');
    } catch (error) {
      if (!mountedRef.current) return;
      
      const message = error instanceof ApiError 
        ? error.userMessage 
        : 'Registration failed';
      store.setError(message);
      setStatus('unauthenticated');
      
      if (onAuthError) {
        onAuthError(error instanceof Error ? error : new Error(message));
      }
      
      throw error;
    }
  }, []);

  const logout = useCallback(async (options: LogoutOptions = {}) => {
    const { logoutAllDevices = false, reason = 'user_initiated' } = options;
    console.log('🔐 Logging out... Reason:', reason);
    
    setStatus('checking');

    try {
      // Call logout API
      await authServiceV2.logout(logoutAllDevices);
    } catch (error) {
      console.error('🔐 Logout API error:', error);
      // Continue with local logout even if API fails
    }

    if (!mountedRef.current) return;
    
    // Clear all auth data
    await productionTokenManager.clearTokens();
    await secureStorage.deleteItem(OFFLINE_AUTH_KEY);
    
    store.clearUser();
    setStatus('unauthenticated');
    setUserRole('free');
    setIsOnboarded(false);
    setTokenExpiringSoon(false);
    setIsOffline(false);
    
    // Track analytics
    navigationAnalytics.trackEvent('auth_logout', {
      reason,
      logout_all: logoutAllDevices,
    });
    
    console.log('🔐 Logout complete');
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (status === 'refreshing') {
      console.log('🔐 Already refreshing, waiting...');
      // Wait for ongoing refresh
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (status !== 'refreshing') {
            clearInterval(checkInterval);
            resolve(status === 'authenticated');
          }
        }, 100);
      });
    }
    
    console.log('🔐 Refreshing session...');
    setStatus('refreshing');

    try {
      const newToken = await productionTokenManager.refreshAccessToken();

      if (!mountedRef.current) return false;

      if (newToken) {
        console.log('🔐 Session refreshed');
        setTokenExpiringSoon(false);

        // Re-verify user
        const user = await authServiceV2.checkAuth();
        if (user && mountedRef.current) {
          store.setUser(user);
          await saveOfflineAuth(user);
          setStatus('authenticated');
        }
        
        return true;
      } else {
        console.log('🔐 Session refresh failed');
        if (mountedRef.current) {
          setStatus('unauthenticated');
          store.clearUser();
          
          if (onSessionExpired) {
            onSessionExpired();
          }
        }
        return false;
      }
    } catch (error) {
      console.error('🔐 Session refresh error:', error);
      
      if (!mountedRef.current) return false;
      
      setStatus('unauthenticated');
      store.clearUser();
      
      if (onSessionExpired) {
        onSessionExpired();
      }
      
      return false;
    }
  }, [status]);

  const forceRefresh = useCallback(async () => {
    console.log('🔐 Force refresh requested');
    await productionTokenManager.clearTokens();
    await checkAuthStatus();
  }, []);

  const clearError = useCallback(() => {
    store.setError(null);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    if (status === 'checking' || status === 'refreshing') return;

    console.log('🔐 Checking auth status...');
    setStatus('checking');

    try {
      const user = await authServiceV2.checkAuth();
      
      if (!mountedRef.current) return;
      
      if (user) {
        store.setUser(user);
        const role = (user as any).role || 'free';
        setUserRole(role);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
        store.clearUser();
      }
    } catch (error) {
      console.error('🔐 Auth check error:', error);
      
      if (!mountedRef.current) return;
      
      // Check if we can use offline auth
      if (!navigator.onLine) {
        const offlineUser = await checkOfflineAuth();
        if (offlineUser) {
          store.setUser(offlineUser);
          setIsOffline(true);
          setStatus('authenticated');
          return;
        }
      }
      
      setStatus('unauthenticated');
      store.clearUser();
    }
  }, [status]);

  const updateUser = useCallback((updates: Partial<User>) => {
    store.updateUser(updates);
  }, []);

  // ── Context Value ───────────────────────────────────────────────
  const value = useMemo<AuthContextValue>(() => ({
    // State
    status,
    isAuthenticated,
    isLoading,
    isOnboarded,
    user: store.user,
    userRole,
    error: store.error,
    tokenExpiringSoon,
    isOffline,
    sessionAge,
    deviceId,

    // Actions
    login,
    register,
    logout,
    refreshSession,
    clearError,
    checkAuthStatus,
    updateUser,
    forceRefresh,
  }), [
    status,
    isAuthenticated,
    isLoading,
    isOnboarded,
    store.user,
    userRole,
    store.error,
    tokenExpiringSoon,
    isOffline,
    sessionAge,
    deviceId,
    login,
    register,
    logout,
    refreshSession,
    clearError,
    checkAuthStatus,
    updateUser,
    forceRefresh,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}

export function useAuthStatus(): Pick<AuthState, 'status' | 'isAuthenticated' | 'isLoading'> {
  const { status, isAuthenticated, isLoading } = useAuthContext();
  return { status, isAuthenticated, isLoading };
}

export function useAuthGuard(redirectTo?: string): {
  isChecking: boolean;
  isAuthenticated: boolean;
} {
  const { status, isAuthenticated } = useAuthContext();
  
  return {
    isChecking: status === 'checking' || status === 'idle',
    isAuthenticated,
  };
}

// ─────────────────────────────────────────────────────────────
// HOC
// ─────────────────────────────────────────────────────────────

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { fallback?: React.ComponentType }
): React.FC<P> {
  return function WithAuthComponent(props: P) {
    const { isAuthenticated, isLoading, status } = useAuthContext();
    
    if (isLoading || status === 'checking') {
      return null; // Or loading spinner
    }
    
    if (!isAuthenticated) {
      if (options?.fallback) {
        const Fallback = options.fallback;
        return <Fallback />;
      }
      return null;
    }
    
    return <Component {...props} />;
  };
}

export default AuthContext;