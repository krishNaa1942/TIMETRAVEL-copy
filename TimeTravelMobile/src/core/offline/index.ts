/**
 * 📴 OFFLINE-FIRST SYSTEM
 * =======================
 * Production-grade offline support with sync queue
 */

// Types
export type {
  SyncAction,
  SyncActionType,
  SyncPriority,
  SyncQueueConfig,
  SyncQueueStats,
  SyncResult,
  SyncResultDetail,
  ConflictInfo,
  ConflictResolver,
  OfflineState,
  OfflineEventListener,
  OfflineEventType,
  OfflineEvent,
  OfflineResourceConfig,
} from './types';

// Constants
export {
  DEFAULT_SYNC_QUEUE_CONFIG,
  DEFAULT_OFFLINE_RESOURCES,
} from './types';

// Classes
export { SyncQueue, getSyncQueue, resetSyncQueue } from './SyncQueue';
export { OfflineManager, getOfflineManager, resetOfflineManager } from './OfflineManager';

// Default export
export { getOfflineManager as default } from './OfflineManager';