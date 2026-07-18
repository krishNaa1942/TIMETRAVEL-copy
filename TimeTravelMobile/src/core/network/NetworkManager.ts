/**
 * 🌐 NETWORK MANAGER
 * ==================
 * Handles network state, connectivity, and offline detection
 */

import { NetworkError } from '../errors';
import type { NetworkState, NetworkStatus, ConnectionType, NetworkListener } from '../types';

/**
 * Network Manager
 * Monitors network connectivity and provides offline detection
 */
export class NetworkManager {
  private state: NetworkState;
  private listeners: Set<NetworkListener> = new Set();
  private checkInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.state = this.getInitialState();
    this.startMonitoring();
  }

  /**
   * Get current network state
   */
  getState(): NetworkState {
    return { ...this.state };
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return this.state.isConnected && this.state.isInternetReachable !== false;
  }

  /**
   * Check if offline
   */
  isOffline(): boolean {
    return !this.isOnline();
  }

  /**
   * Subscribe to network state changes
   */
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Wait for connection
   */
  async waitForConnection(timeout = 30000): Promise<boolean> {
    if (this.isOnline()) return true;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeout);

      const unsubscribe = this.subscribe((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          clearTimeout(timer);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  /**
   * Check internet reachability
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      // Simple fetch to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Require connection or throw
   */
  requireConnection(): void {
    if (this.isOffline()) {
      throw NetworkError.offline();
    }
  }

  /**
   * Destroy network manager
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.listeners.clear();
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private getInitialState(): NetworkState {
    return {
      isConnected: navigator.onLine,
      isInternetReachable: navigator.onLine ? true : null,
      type: this.detectConnectionType(),
      status: navigator.onLine ? 'online' : 'offline',
      lastOnline: navigator.onLine ? Date.now() : undefined,
      lastOffline: navigator.onLine ? undefined : Date.now(),
    };
  }

  private detectConnectionType(): ConnectionType {
    // @ts-expect-error - Navigator connection is not standard
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!connection) return 'unknown';
    
    const type = connection.effectiveType || connection.type;
    
    switch (type) {
      case 'wifi':
      case '4g':
        return 'wifi';
      case 'cellular':
      case '3g':
      case '2g':
        return 'cellular';
      case 'ethernet':
        return 'ethernet';
      case 'none':
        return 'none';
      default:
        return 'unknown';
    }
  }

  private startMonitoring(): void {
    // Listen to browser events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Periodic check
    this.checkInterval = setInterval(() => {
      this.performCheck();
    }, 30000);
  }

  private handleOnline = (): void => {
    this.updateState({
      isConnected: true,
      status: 'online',
      lastOnline: Date.now(),
    });
  };

  private handleOffline = (): void => {
    this.updateState({
      isConnected: false,
      isInternetReachable: false,
      status: 'offline',
      lastOffline: Date.now(),
    });
  };

  private async performCheck(): Promise<void> {
    const reachable = await this.checkConnectivity();
    
    this.updateState({
      isInternetReachable: reachable,
      status: reachable ? 'online' : 'offline',
    });
  }

  private updateState(updates: Partial<NetworkState>): void {
    const prevState = this.state;
    this.state = { ...this.state, ...updates };

    // Notify listeners if state changed
    if (prevState.status !== this.state.status) {
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Network listener error:', error);
      }
    });
  }
}

// Singleton instance
let networkInstance: NetworkManager | null = null;

export function getNetworkManager(): NetworkManager {
  if (!networkInstance) {
    networkInstance = new NetworkManager();
  }
  return networkInstance;
}

export function resetNetworkManager(): void {
  if (networkInstance) {
    networkInstance.destroy();
    networkInstance = null;
  }
}