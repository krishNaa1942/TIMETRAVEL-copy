/**
 * 📤 SYNC QUEUE
 * =============
 * Priority-based queue for offline action synchronization
 */

import type {
  SyncAction,
  SyncActionType,
  SyncPriority,
  SyncQueueConfig,
  SyncQueueStats,
  SyncResult,
  SyncResultDetail,
  ConflictInfo,
  ConflictResolver,
} from './types';
import { DEFAULT_SYNC_QUEUE_CONFIG } from './types';

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────
// Priority Weights
// ─────────────────────────────────────────────────────────────

const PRIORITY_WEIGHTS: Record<SyncPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
};

// ─────────────────────────────────────────────────────────────
// SyncQueue Class
// ─────────────────────────────────────────────────────────────

export class SyncQueue {
  private queue: SyncAction[] = [];
  private config: SyncQueueConfig;
  private completedActions: SyncAction[] = [];
  private syncInProgress: boolean = false;
  private abortController: AbortController | null = null;
  private apiClient: ((action: SyncAction) => Promise<unknown>) | null = null;
  private conflictResolvers: Map<string, ConflictResolver> = new Map();

  constructor(config: Partial<SyncQueueConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_QUEUE_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────
  // Public Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Set the API client for sync operations
   */
  setApiClient(client: (action: SyncAction) => Promise<unknown>): void {
    this.apiClient = client;
  }

  /**
   * Register a conflict resolver for a resource
   */
  registerConflictResolver(resource: string, resolver: ConflictResolver): void {
    this.conflictResolvers.set(resource, resolver);
  }

  /**
   * Add an action to the sync queue
   */
  async addAction(params: {
    type: SyncActionType;
    resource: string;
    resourceId?: string;
    payload: Record<string, unknown>;
    priority?: SyncPriority;
    metadata?: Record<string, unknown>;
  }): Promise<SyncAction> {
    // Check queue size
    if (this.queue.length >= this.config.maxSize) {
      // Remove lowest priority items
      this.removeLowPriorityItems();
    }

    // Create action
    const action: SyncAction = {
      id: generateId(),
      type: params.type,
      priority: params.priority ?? 'normal',
      status: 'pending',
      resource: params.resource,
      resourceId: params.resourceId,
      payload: params.payload,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      metadata: params.metadata,
    };

    // Add to queue (sorted by priority)
    this.insertByPriority(action);

    return action;
  }

  /**
   * Remove an action from the queue
   */
  removeAction(actionId: string): boolean {
    const index = this.queue.findIndex(a => a.id === actionId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get action by ID
   */
  getAction(actionId: string): SyncAction | undefined {
    return this.queue.find(a => a.id === actionId);
  }

  /**
   * Get all pending actions
   */
  getPendingActions(): SyncAction[] {
    return this.queue.filter(a => a.status === 'pending');
  }

  /**
   * Get all actions for a resource
   */
  getActionsForResource(resource: string): SyncAction[] {
    return this.queue.filter(a => a.resource === resource);
  }

  /**
   * Sync all pending actions
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        syncId: generateId(),
        timestamp: Date.now(),
        synced: 0,
        failed: 0,
        conflicts: 0,
        duration: 0,
        details: [],
      };
    }

    this.syncInProgress = true;
    this.abortController = new AbortController();
    const startTime = Date.now();
    const details: SyncResultDetail[] = [];
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    try {
      // Get pending actions sorted by priority
      const pendingActions = this.getPendingActions();

      // Process in batches
      for (let i = 0; i < pendingActions.length; i += this.config.batchSize) {
        if (this.abortController.signal.aborted) {
          break;
        }

        const batch = pendingActions.slice(i, i + this.config.batchSize);
        
        // Process batch concurrently
        const results = await Promise.allSettled(
          batch.map(action => this.syncAction(action))
        );

        // Process results
        results.forEach((result, index) => {
          const action = batch[index];
          
          if (result.status === 'fulfilled') {
            const detail = result.value as SyncResultDetail;
            details.push(detail);
            
            if (detail.success) {
              synced++;
              this.markComplete(action.id);
            } else if (detail.conflict) {
              conflicts++;
              this.markConflict(action.id, detail.conflict);
            } else {
              failed++;
              this.markFailed(action.id, detail.error ?? 'Unknown error');
            }
          } else {
            failed++;
            const error = result.reason instanceof Error 
              ? result.reason.message 
              : String(result.reason);
            this.markFailed(action.id, error);
            details.push({
              actionId: action.id,
              success: false,
              error,
            });
          }
        });
      }
    } finally {
      this.syncInProgress = false;
      this.abortController = null;
    }

    return {
      syncId: generateId(),
      timestamp: Date.now(),
      synced,
      failed,
      conflicts,
      duration: Date.now() - startTime,
      details,
    };
  }

  /**
   * Cancel ongoing sync
   */
  cancelSync(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Retry failed actions
   */
  async retryFailed(): Promise<SyncResult> {
    // Reset failed actions to pending
    this.queue.forEach(action => {
      if (action.status === 'failed' && action.retryCount < action.maxRetries) {
        action.status = 'pending';
        action.error = undefined;
      }
    });

    return this.sync();
  }

  /**
   * Get queue statistics
   */
  getStats(): SyncQueueStats {
    const pending = this.queue.filter(a => a.status === 'pending');
    const oldestPending = pending.length > 0
      ? Math.min(...pending.map(a => a.createdAt))
      : undefined;

    return {
      pending: pending.length,
      syncing: this.queue.filter(a => a.status === 'syncing').length,
      completed: this.completedActions.length,
      failed: this.queue.filter(a => a.status === 'failed').length,
      size: this.queue.length,
      oldestPending,
    };
  }

  /**
   * Clear completed actions
   */
  clearCompleted(): void {
    this.completedActions = [];
  }

  /**
   * Clear all actions
   */
  clear(): void {
    this.queue = [];
    this.completedActions = [];
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Insert action by priority
   */
  private insertByPriority(action: SyncAction): void {
    const weight = PRIORITY_WEIGHTS[action.priority];
    
    // Find insertion point
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const existingWeight = PRIORITY_WEIGHTS[this.queue[i].priority];
      if (weight > existingWeight) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, action);
  }

  /**
   * Remove lowest priority items
   */
  private removeLowPriorityItems(): void {
    // Sort by priority (ascending) and age
    const sorted = [...this.queue].sort((a, b) => {
      const weightDiff = PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority];
      if (weightDiff !== 0) return weightDiff;
      return a.createdAt - b.createdAt;
    });

    // Remove bottom 10%
    const removeCount = Math.ceil(this.config.maxSize * 0.1);
    const toRemove = sorted.slice(0, removeCount).map(a => a.id);
    
    this.queue = this.queue.filter(a => !toRemove.includes(a.id));
  }

  /**
   * Sync a single action
   */
  private async syncAction(action: SyncAction): Promise<SyncResultDetail> {
    if (!this.apiClient) {
      return {
        actionId: action.id,
        success: false,
        error: 'No API client configured',
      };
    }

    // Mark as syncing
    action.status = 'syncing';
    action.lastAttemptAt = Date.now();

    try {
      // Execute API call
      const result = await this.apiClient(action);
      
      return {
        actionId: action.id,
        success: true,
        serverData: result as Record<string, unknown>,
      };
    } catch (error) {
      action.retryCount++;

      // Check if it's a conflict
      const isConflict = this.isConflictError(error);
      if (isConflict) {
        const conflict = await this.handleConflict(action, error);
        return {
          actionId: action.id,
          success: false,
          conflict,
        };
      }

      // Check if retryable
      const retryable = this.isRetryableError(error);
      if (!retryable || action.retryCount >= action.maxRetries) {
        return {
          actionId: action.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      // Schedule retry with backoff
      await this.delay(this.calculateBackoff(action.retryCount));
      
      // Recursively retry
      return this.syncAction(action);
    }
  }

  /**
   * Mark action as complete
   */
  private markComplete(actionId: string): void {
    const index = this.queue.findIndex(a => a.id === actionId);
    if (index !== -1) {
      const [action] = this.queue.splice(index, 1);
      action.status = 'completed';
      this.completedActions.push(action);
    }
  }

  /**
   * Mark action as failed
   */
  private markFailed(actionId: string, error: string): void {
    const action = this.queue.find(a => a.id === actionId);
    if (action) {
      action.status = 'failed';
      action.error = error;
    }
  }

  /**
   * Mark action as conflict
   */
  private markConflict(actionId: string, conflict: ConflictInfo): void {
    const action = this.queue.find(a => a.id === actionId);
    if (action) {
      action.status = 'conflict';
      action.error = `Conflict: ${conflict.type}`;
    }
  }

  /**
   * Handle conflict
   */
  private async handleConflict(action: SyncAction, error: unknown): Promise<ConflictInfo> {
    const resolver = this.conflictResolvers.get(action.resource);
    const serverData = this.extractServerData(error);

    const conflict: ConflictInfo = {
      type: 'data_mismatch',
      clientVersion: action.payload,
      serverVersion: serverData ?? {},
      suggestedStrategy: resolver?.strategy ?? 'server_wins',
    };

    // Auto-resolve if possible
    if (resolver && resolver.strategy !== 'manual') {
      if (resolver.strategy === 'merge' && resolver.merge) {
        conflict.mergedData = resolver.merge(action.payload, serverData) as Record<string, unknown> | undefined;
      } else if (resolver.strategy === 'client_wins') {
        conflict.mergedData = action.payload;
      } else {
        conflict.mergedData = serverData ?? undefined;
      }
    }

    return conflict;
  }

  /**
   * Check if error is a conflict
   */
  private isConflictError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('409') ||
        error.message.includes('conflict') ||
        error.message.includes('Conflict')
      );
    }
    return false;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('5') || // 5xx errors
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('ECONNRESET')
      );
    }
    return false;
  }

  /**
   * Extract server data from error
   */
  private extractServerData(error: unknown): Record<string, unknown> | null {
    if (error instanceof Error && 'data' in error) {
      return (error as Error & { data: Record<string, unknown> }).data;
    }
    return null;
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    const delay = Math.min(
      this.config.backoffBase * Math.pow(2, retryCount),
      this.config.backoffMax
    );
    // Add jitter
    return delay + Math.random() * delay * 0.1;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────

let syncQueueInstance: SyncQueue | null = null;

export function getSyncQueue(config?: Partial<SyncQueueConfig>): SyncQueue {
  if (!syncQueueInstance) {
    syncQueueInstance = new SyncQueue(config);
  }
  return syncQueueInstance;
}

export function resetSyncQueue(): void {
  syncQueueInstance?.clear();
  syncQueueInstance = null;
}

export default SyncQueue;