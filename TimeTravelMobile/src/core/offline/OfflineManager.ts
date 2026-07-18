/**
 * 📴 OFFLINE MANAGER
 * ==================
 * Central coordinator for offline-first functionality
 */

import { SyncQueue, getSyncQueue } from './SyncQueue';
import { getNetworkManager } from '../network/NetworkManager';
import { getCacheManager } from '../cache/CacheManager';
import type {
  SyncAction,
  SyncActionType,
  SyncPriority,
  SyncResult,
  OfflineState,
  OfflineEventListener,
  OfflineEventType,
  OfflineEvent,
  OfflineResourceConfig,
  ConflictResolver,
} from './types';
import { DEFAULT_OFFLINE_RESOURCES } from './types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface OfflineManagerConfig {
  resources?: OfflineResourceConfig[];
  autoSync?: boolean;
  syncInterval?: number;
  onOffline?: () => void;
  onOnline?: () => void;
  onSyncStart?: () => void;
  onSyncComplete?: (result: SyncResult) => void;
}

// ─────────────────────────────────────────────────────────────
// OfflineManager Class
// ─────────────────────────────────────────────────────────────

export class OfflineManager {
  private syncQueue: SyncQueue;
  private networkManager: ReturnType<typeof getNetworkManager>;
  private cacheManager: ReturnType<typeof getCacheManager>;
  private resources: Map<string, OfflineResourceConfig> = new Map();
  private listeners: Set<OfflineEventListener> = new Set();
  private config: OfflineManagerConfig;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized: boolean = false;

  constructor(config: OfflineManagerConfig = {}) {
    this.config = config;
    this.syncQueue = getSyncQueue();
    this.networkManager = getNetworkManager();
    this.cacheManager = getCacheManager();

    // Register resources
    const resources = config.resources ?? DEFAULT_OFFLINE_RESOURCES;
    resources.forEach(resource => {
      this.resources.set(resource.name, resource);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize the offline manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Subscribe to network changes
    this.networkManager.subscribe(state => {
      this.handleNetworkChange(state.isConnected);
    });

    // Set up API client for sync queue
    this.syncQueue.setApiClient(this.executeSyncAction.bind(this));

    // Start auto-sync if enabled
    if (this.config.autoSync !== false) {
      this.startAutoSync();
    }

    // Initial sync if online
    if (this.networkManager.getState().isConnected) {
      await this.sync();
    }

    this.isInitialized = true;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoSync();
    this.listeners.clear();
    this.syncQueue.clear();
    this.isInitialized = false;
  }

  // ─────────────────────────────────────────────────────────────
  // Action Queueing
  // ─────────────────────────────────────────────────────────────

  /**
   * Queue an action for sync
   */
  async queueAction(params: {
    type: SyncActionType;
    resource: string;
    resourceId?: string;
    payload: Record<string, unknown>;
    priority?: SyncPriority;
    metadata?: Record<string, unknown>;
  }): Promise<SyncAction> {
    const resourceConfig = this.resources.get(params.resource);
    
    // Check if resource should queue mutations
    if (resourceConfig && !resourceConfig.queueMutations) {
      throw new Error(`Resource ${params.resource} does not support offline queueing`);
    }

    const action = await this.syncQueue.addAction({
      ...params,
      priority: params.priority ?? 'normal',
    });

    this.emit({
      type: 'action_added',
      timestamp: Date.now(),
      data: { actionId: action.id, resource: params.resource },
    });

    // Try immediate sync if online
    if (this.networkManager.getState().isConnected && this.config.autoSync !== false) {
      this.sync().catch(() => {
        // Silent fail - action is queued
      });
    }

    return action;
  }

  /**
   * Create a resource offline
   */
  async create(resource: string, data: Record<string, unknown>): Promise<SyncAction> {
    // Store locally first
    await this.storeLocalData(resource, data);

    // Queue for sync
    return this.queueAction({
      type: 'create',
      resource,
      payload: data,
    });
  }

  /**
   * Update a resource offline
   */
  async update(resource: string, id: string, data: Record<string, unknown>): Promise<SyncAction> {
    // Update local storage
    await this.updateLocalData(resource, id, data);

    // Queue for sync
    return this.queueAction({
      type: 'update',
      resource,
      resourceId: id,
      payload: data,
    });
  }

  /**
   * Delete a resource offline
   */
  async delete(resource: string, id: string): Promise<SyncAction> {
    // Mark as deleted locally
    await this.deleteLocalData(resource, id);

    // Queue for sync
    return this.queueAction({
      type: 'delete',
      resource,
      resourceId: id,
      payload: { id },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Sync Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Sync all pending actions
   */
  async sync(): Promise<SyncResult> {
    if (!this.networkManager.getState().isConnected) {
      return {
        syncId: 'offline',
        timestamp: Date.now(),
        synced: 0,
        failed: 0,
        conflicts: 0,
        duration: 0,
        details: [],
      };
    }

    this.emit({
      type: 'sync_start',
      timestamp: Date.now(),
    });

    this.config.onSyncStart?.();

    const result = await this.syncQueue.sync();

    this.emit({
      type: 'sync_complete',
      timestamp: Date.now(),
      data: { result },
    });

    this.config.onSyncComplete?.(result);

    return result;
  }

  /**
   * Retry failed actions
   */
  async retryFailed(): Promise<SyncResult> {
    return this.syncQueue.retryFailed();
  }

  /**
   * Cancel ongoing sync
   */
  cancelSync(): void {
    this.syncQueue.cancelSync();
  }

  // ─────────────────────────────────────────────────────────────
  // Data Access
  // ─────────────────────────────────────────────────────────────

  /**
   * Get data (from cache or local storage)
   */
  async getData<T>(resource: string, id: string): Promise<T | null> {
    const resourceConfig = this.resources.get(resource);
    if (!resourceConfig?.cacheLocally) {
      return null;
    }

    const key = `${resource}:${id}`;
    
    // Try cache first
    const cached = await this.cacheManager.get<T>(key);
    if (cached) return cached;

    // Try local storage
    return this.getLocalData<T>(resource, id);
  }

  /**
   * Get all data for a resource
   */
  async getAllData<T>(resource: string): Promise<T[]> {
    const resourceConfig = this.resources.get(resource);
    if (!resourceConfig?.cacheLocally) {
      return [];
    }

    const key = `${resource}:all`;
    const cached = await this.cacheManager.get<T[]>(key);
    return cached ?? [];
  }

  /**
   * Refresh data from server
   */
  async refreshData(resource: string, id?: string): Promise<void> {
    const resourceConfig = this.resources.get(resource);
    if (!resourceConfig) return;

    // Invalidate cache
    if (id) {
      this.cacheManager.delete(`${resource}:${id}`);
    } else {
      this.cacheManager.invalidatePattern(resource);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // State & Events
  // ─────────────────────────────────────────────────────────────

  /**
   * Get current offline state
   */
  getState(): OfflineState {
    const networkState = this.networkManager.getState();
    const queueStats = this.syncQueue.getStats();

    return {
      isOffline: !networkState.isConnected,
      isSyncing: queueStats.syncing > 0,
      lastSyncAt: undefined, // TODO: track this
      queueStats,
      storageUsage: {
        used: 0, // TODO: calculate from storage
        total: 50 * 1024 * 1024,
        percentage: 0,
      },
      pendingActions: queueStats.pending,
    };
  }

  /**
   * Subscribe to offline events
   */
  subscribe(listener: OfflineEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Register conflict resolver
   */
  registerConflictResolver(resource: string, resolver: ConflictResolver): void {
    this.syncQueue.registerConflictResolver(resource, resolver);
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Handle network state change
   */
  private handleNetworkChange(isConnected: boolean): void {
    if (isConnected) {
      this.emit({
        type: 'online',
        timestamp: Date.now(),
      });
      this.config.onOnline?.();

      // Auto-sync when coming online
      if (this.config.autoSync !== false) {
        this.sync().catch(() => {});
      }
    } else {
      this.emit({
        type: 'offline',
        timestamp: Date.now(),
      });
      this.config.onOffline?.();
    }
  }

  /**
   * Execute sync action via API
   */
  private async executeSyncAction(action: SyncAction): Promise<unknown> {
    const resourceConfig = this.resources.get(action.resource);
    if (!resourceConfig) {
      throw new Error(`Unknown resource: ${action.resource}`);
    }

    const { endpoint, primaryKey } = resourceConfig;
    const url = action.resourceId 
      ? `${endpoint}/${action.resourceId}`
      : endpoint;

    // This would integrate with the actual API client
    // For now, return a mock response
    return {
      method: action.type,
      url,
      data: action.payload,
      [primaryKey]: action.resourceId ?? Date.now().toString(),
    };
  }

  /**
   * Store data locally
   */
  private async storeLocalData(resource: string, data: Record<string, unknown>): Promise<void> {
    const resourceConfig = this.resources.get(resource);
    if (!resourceConfig?.cacheLocally) return;

    const primaryKey = resourceConfig.primaryKey;
    const id = (data[primaryKey] as string) ?? Date.now().toString();
    const key = `${resource}:${id}`;

    await this.cacheManager.set(key, data, {
      ttl: resourceConfig.ttl,
      tags: [resource],
    });
  }

  /**
   * Update local data
   */
  private async updateLocalData(
    resource: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const resourceConfig = this.resources.get(resource);
    if (!resourceConfig?.cacheLocally) return;

    const key = `${resource}:${id}`;
    const existing = await this.cacheManager.get<Record<string, unknown>>(key);
    
    const updated = existing ? { ...existing, ...data } : data;
    
    await this.cacheManager.set(key, updated, {
      ttl: resourceConfig.ttl,
      tags: [resource],
    });
  }

  /**
   * Delete local data
   */
  private async deleteLocalData(resource: string, id: string): Promise<void> {
    const key = `${resource}:${id}`;
    this.cacheManager.delete(key);
  }

  /**
   * Get local data
   */
  private async getLocalData<T>(resource: string, id: string): Promise<T | null> {
    const key = `${resource}:${id}`;
    return this.cacheManager.get<T>(key);
  }

  /**
   * Start auto-sync timer
   */
  private startAutoSync(): void {
    if (this.syncTimer) return;

    const interval = this.config.syncInterval ?? 30000;
    this.syncTimer = setInterval(() => {
      if (this.networkManager.getState().isConnected) {
        this.sync().catch(() => {});
      }
    }, interval);
  }

  /**
   * Stop auto-sync timer
   */
  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: OfflineEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────

let offlineManagerInstance: OfflineManager | null = null;

export function getOfflineManager(config?: OfflineManagerConfig): OfflineManager {
  if (!offlineManagerInstance) {
    offlineManagerInstance = new OfflineManager(config);
  }
  return offlineManagerInstance;
}

export function resetOfflineManager(): void {
  offlineManagerInstance?.destroy();
  offlineManagerInstance = null;
}

export default OfflineManager;