/**
 * Offline Mutation Queue
 * ======================
 * 
 * Handles offline mutations with:
 * - Queue persistence
 * - Automatic retry on reconnect
 * - Deduplication
 * - Conflict resolution
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

// Network state fallback - uses a simple online/offline check
// For full implementation, install: npm install @react-native-community/netinfo
type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

// Simple network check fallback
const getNetworkState = (): Promise<NetInfoState> => {
  return new Promise((resolve) => {
    // Use navigator.onLine for web, assume online for native
    const isOnline = typeof navigator !== 'undefined' 
      ? navigator.onLine 
      : true;
    resolve({
      isConnected: isOnline,
      isInternetReachable: isOnline,
    });
  });
};

// Subscribe to network changes (simplified)
const subscribeToNetworkChanges = (
  callback: (state: NetInfoState) => void
): (() => void) => {
  // For web
  if (typeof window !== 'undefined') {
    const handleOnline = () => callback({ isConnected: true, isInternetReachable: true });
    const handleOffline = () => callback({ isConnected: false, isInternetReachable: false });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
  
  // For native without netinfo, just return noop
  return () => {};
};

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type MutationStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed';

export interface QueuedMutation {
  id: string;
  type: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload: Record<string, unknown>;
  timestamp: number;
  status: MutationStatus;
  retries: number;
  maxRetries: number;
  error?: string;
}

interface OfflineQueueState {
  mutations: QueuedMutation[];
  isOnline: boolean;
  isProcessing: boolean;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'offline_mutation_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const PROCESSING_INTERVAL_MS = 5000;

// ─────────────────────────────────────────────────────────────
// OFFLINE QUEUE CLASS
// ─────────────────────────────────────────────────────────────

class OfflineQueueManager {
  private state: OfflineQueueState = {
    mutations: [],
    isOnline: true,
    isProcessing: false,
  };
  
  private listeners: Set<(state: OfflineQueueState) => void> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;

  /**
   * Initialize the offline queue
   */
  async initialize(): Promise<void> {
    // Load persisted mutations
    await this.loadQueue();
    
    // Setup network listener
    this.unsubscribeNetInfo = subscribeToNetworkChanges(this.handleNetworkChange);
    
    // Get initial network state
    const netInfo = await getNetworkState();
    this.state.isOnline = netInfo.isConnected ?? true;
    
    // Start processing if online
    if (this.state.isOnline) {
      this.startProcessing();
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.listeners.clear();
  }

  /**
   * Subscribe to queue state changes
   */
  subscribe(listener: (state: OfflineQueueState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current state
   */
  getState(): OfflineQueueState {
    return { ...this.state };
  }

  /**
   * Add mutation to queue
   */
  async queueMutation(
    type: string,
    endpoint: string,
    method: QueuedMutation['method'],
    payload: Record<string, unknown>
  ): Promise<string> {
    const mutation: QueuedMutation = {
      id: `mutation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      endpoint,
      method,
      payload,
      timestamp: Date.now(),
      status: 'pending',
      retries: 0,
      maxRetries: MAX_RETRIES,
    };

    // Check for duplicate
    const isDuplicate = this.state.mutations.some(
      m => m.type === type && 
           JSON.stringify(m.payload) === JSON.stringify(payload) &&
           m.status === 'pending'
    );

    if (isDuplicate) {
      console.log('[OfflineQueue] Skipping duplicate mutation:', type);
      return '';
    }

    this.state.mutations.push(mutation);
    await this.persistQueue();
    this.notifyListeners();

    // Process immediately if online
    if (this.state.isOnline && !this.state.isProcessing) {
      this.processQueue();
    }

    return mutation.id;
  }

  /**
   * Remove mutation from queue
   */
  async removeMutation(id: string): Promise<void> {
    this.state.mutations = this.state.mutations.filter(m => m.id !== id);
    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Clear all mutations
   */
  async clearQueue(): Promise<void> {
    this.state.mutations = [];
    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Retry failed mutations
   */
  async retryFailed(): Promise<void> {
    this.state.mutations
      .filter(m => m.status === 'failed')
      .forEach(m => {
        m.status = 'pending';
        m.retries = 0;
        m.error = undefined;
      });
    
    await this.persistQueue();
    this.notifyListeners();
    
    if (this.state.isOnline) {
      this.processQueue();
    }
  }

  // ───────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ───────────────────────────────────────────────────────────

  private handleNetworkChange = (state: NetInfoState): void => {
    const wasOffline = !this.state.isOnline;
    this.state.isOnline = state.isConnected ?? false;

    if (this.state.isOnline && wasOffline) {
      console.log('[OfflineQueue] Back online, processing queue');
      this.startProcessing();
    } else if (!this.state.isOnline) {
      console.log('[OfflineQueue] Gone offline, pausing processing');
      this.stopProcessing();
    }

    this.notifyListeners();
  };

  private startProcessing(): void {
    if (this.processingInterval) return;
    
    this.processQueue(); // Immediate process
    
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, PROCESSING_INTERVAL_MS);
  }

  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.state.isProcessing || !this.state.isOnline) return;

    const pendingMutations = this.state.mutations.filter(
      m => m.status === 'pending'
    );

    if (pendingMutations.length === 0) return;

    this.state.isProcessing = true;
    this.notifyListeners();

    for (const mutation of pendingMutations) {
      try {
        mutation.status = 'processing';
        this.notifyListeners();

        await this.executeMutation(mutation);
        
        mutation.status = 'completed';
        console.log('[OfflineQueue] Mutation completed:', mutation.id);
      } catch (error) {
        mutation.retries++;
        mutation.error = error instanceof Error ? error.message : 'Unknown error';

        if (mutation.retries >= mutation.maxRetries) {
          mutation.status = 'failed';
          console.error('[OfflineQueue] Mutation failed after max retries:', mutation.id);
        } else {
          mutation.status = 'pending';
          console.warn('[OfflineQueue] Mutation will retry:', mutation.id, 'Attempt:', mutation.retries);
        }
      }

      this.notifyListeners();
    }

    // Remove completed mutations
    this.state.mutations = this.state.mutations.filter(
      m => m.status !== 'completed'
    );

    await this.persistQueue();
    this.state.isProcessing = false;
    this.notifyListeners();
  }

  private async executeMutation(mutation: QueuedMutation): Promise<void> {
    const { endpoint, method, payload } = mutation;

    switch (method) {
      case 'POST':
        await apiService.post(endpoint, payload);
        break;
      case 'PUT':
        await apiService.put(endpoint, payload);
        break;
      case 'PATCH':
        await apiService.patch(endpoint, payload);
        break;
      case 'DELETE':
        await apiService.delete(endpoint);
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state.mutations = parsed.mutations || [];
        
        // Reset processing state on load
        this.state.mutations.forEach(m => {
          if (m.status === 'processing') {
            m.status = 'pending';
          }
        });
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error);
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mutations: this.state.mutations })
      );
    } catch (error) {
      console.error('[OfflineQueue] Failed to persist queue:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────

export const offlineQueue = new OfflineQueueManager();

// ─────────────────────────────────────────────────────────────
// REACT HOOK
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export const useOfflineQueue = () => {
  const [state, setState] = useState<OfflineQueueState>(offlineQueue.getState());

  useEffect(() => {
    return offlineQueue.subscribe(setState);
  }, []);

  const queueMutation = useCallback(
    (
      type: string,
      endpoint: string,
      method: QueuedMutation['method'],
      payload: Record<string, unknown>
    ) => offlineQueue.queueMutation(type, endpoint, method, payload),
    []
  );

  const removeMutation = useCallback(
    (id: string) => offlineQueue.removeMutation(id),
    []
  );

  const retryFailed = useCallback(
    () => offlineQueue.retryFailed(),
    []
  );

  const clearQueue = useCallback(
    () => offlineQueue.clearQueue(),
    []
  );

  return {
    ...state,
    queueMutation,
    removeMutation,
    retryFailed,
    clearQueue,
    pendingCount: state.mutations.filter(m => m.status === 'pending').length,
    failedCount: state.mutations.filter(m => m.status === 'failed').length,
  };
};

export default offlineQueue;