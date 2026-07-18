/**
 * 📡 NETWORK MANAGER
 * Real-time connectivity detection using NetInfo
 * 
 * Features:
 * - Real network state detection (not navigator.onLine)
 * - Connection type detection (wifi/cellular)
 * - Offline/online event listeners
 * - Internet reachability check
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { NetworkState, NetworkListener } from './types';

// ─────────────────────────────────────────────────────────────
// NETWORK MANAGER CLASS
// ─────────────────────────────────────────────────────────────
class NetworkManager {
  private currentState: NetworkState = {
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  };
  private listeners: Set<NetworkListener> = new Set();
  private unsubscribe: (() => void) | null = null;
  private initialized = false;

  /**
   * Initialize network monitoring
   */
  initialize(): void {
    if (this.initialized) return;

    this.unsubscribe = NetInfo.addEventListener(this.handleStateChange.bind(this));
    this.initialized = true;

    // Fetch initial state
    NetInfo.fetch().then(this.handleStateChange.bind(this)).catch(() => {
      this.log('Failed to fetch initial network state');
    });

    this.log('Network monitoring initialized');
  }

  /**
   * Cleanup network monitoring
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * Handle NetInfo state changes
   */
  private handleStateChange(state: NetInfoState): void {
    const newState: NetworkState = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type || 'unknown',
    };

    const wasOffline = !this.currentState.isConnected;
    const isNowOnline = newState.isConnected && newState.isInternetReachable;

    // Log state change
    if (wasOffline && isNowOnline) {
      this.log('Network recovered', newState);
    } else if (this.currentState.isConnected && !newState.isConnected) {
      this.log('Network lost', newState);
    }

    this.currentState = newState;

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(newState);
      } catch (error) {
        this.logError('Listener error', error);
      }
    });
  }

  /**
   * Get current network state
   */
  getState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.currentState.isConnected && this.currentState.isInternetReachable;
  }

  /**
   * Check if on WiFi (for large downloads, etc.)
   */
  isWifi(): boolean {
    return this.currentState.type === 'wifi';
  }

  /**
   * Check if on cellular (metered connection)
   */
  isCellular(): boolean {
    return this.currentState.type === 'cellular';
  }

  /**
   * Subscribe to network state changes
   */
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Wait for online state (with timeout)
   */
  async waitForOnline(timeoutMs: number = 30000): Promise<boolean> {
    if (this.isOnline()) return true;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.subscribe((state) => {
        if (state.isConnected && state.isInternetReachable) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  /**
   * Check actual internet connectivity by making a test request
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected === true && state.isInternetReachable === true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // LOGGING
  // ─────────────────────────────────────────────────────────────

  private log(message: string, data?: unknown): void {
    if (__DEV__) {
      console.log(`📡 [NetworkManager] ${message}`, data ?? '');
    }
  }

  private logError(message: string, error: unknown): void {
    if (__DEV__) {
      console.error(`📡❌ [NetworkManager] ${message}`, error);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────
export const networkManager = new NetworkManager();
export default networkManager;