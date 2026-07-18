/**
 * 📴 OFFLINE-FIRST SYSTEM TYPES
 * =============================
 * Production-grade offline support for seamless user experience
 */

// ─────────────────────────────────────────────────────────────
// Sync Action Types
// ─────────────────────────────────────────────────────────────

export type SyncActionType = 
  | 'create'
  | 'update'
  | 'delete'
  | 'upload'
  | 'send_message'
  | 'update_preferences'
  | 'bookmark'
  | 'favorite';

export type SyncPriority = 'critical' | 'high' | 'normal' | 'low';

export type SyncStatus = 
  | 'pending'
  | 'syncing'
  | 'completed'
  | 'failed'
  | 'conflict'
  | 'cancelled';

// ─────────────────────────────────────────────────────────────
// Sync Action
// ─────────────────────────────────────────────────────────────

export interface SyncAction {
  /** Unique identifier */
  id: string;
  /** Action type */
  type: SyncActionType;
  /** Priority level */
  priority: SyncPriority;
  /** Current status */
  status: SyncStatus;
  /** Resource being synced */
  resource: string;
  /** Resource ID (if applicable) */
  resourceId?: string;
  /** Action payload */
  payload: Record<string, unknown>;
  /** Timestamp when action was created */
  createdAt: number;
  /** Timestamp of last sync attempt */
  lastAttemptAt?: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Sync Queue
// ─────────────────────────────────────────────────────────────

export interface SyncQueueConfig {
  /** Maximum queue size */
  maxSize: number;
  /** Auto-sync when online */
  autoSync: boolean;
  /** Sync interval in ms */
  syncInterval: number;
  /** Maximum retries per action */
  maxRetries: number;
  /** Batch size for sync */
  batchSize: number;
  /** Exponential backoff base delay */
  backoffBase: number;
  /** Maximum backoff delay */
  backoffMax: number;
}

export interface SyncQueueStats {
  /** Total pending actions */
  pending: number;
  /** Actions currently syncing */
  syncing: number;
  /** Completed actions */
  completed: number;
  /** Failed actions */
  failed: number;
  /** Queue size */
  size: number;
  /** Oldest pending action timestamp */
  oldestPending?: number;
}

// ─────────────────────────────────────────────────────────────
// Sync Result
// ─────────────────────────────────────────────────────────────

export interface SyncResult {
  /** Sync operation ID */
  syncId: string;
  /** Timestamp */
  timestamp: number;
  /** Number of actions synced */
  synced: number;
  /** Number of actions failed */
  failed: number;
  /** Number of conflicts */
  conflicts: number;
  /** Duration in ms */
  duration: number;
  /** Detailed results */
  details: SyncResultDetail[];
}

export interface SyncResultDetail {
  actionId: string;
  success: boolean;
  error?: string;
  conflict?: ConflictInfo;
  serverData?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Conflict Resolution
// ─────────────────────────────────────────────────────────────

export type ConflictStrategy = 
  | 'server_wins'
  | 'client_wins'
  | 'merge'
  | 'manual';

export interface ConflictInfo {
  /** Conflict type */
  type: 'data_mismatch' | 'deleted' | 'version_mismatch';
  /** Client version */
  clientVersion: Record<string, unknown>;
  /** Server version */
  serverVersion: Record<string, unknown>;
  /** Suggested resolution */
  suggestedStrategy: ConflictStrategy;
  /** Merge result (if applicable) */
  mergedData?: Record<string, unknown>;
}

export interface ConflictResolver {
  /** Strategy to use */
  strategy: ConflictStrategy;
  /** Custom merge function */
  merge?: (client: unknown, server: unknown) => unknown;
  /** Fields to prefer from client */
  preferClientFields?: string[];
  /** Fields to prefer from server */
  preferServerFields?: string[];
}

// ─────────────────────────────────────────────────────────────
// Offline Storage
// ─────────────────────────────────────────────────────────────

export interface OfflineStorageConfig {
  /** Storage prefix */
  prefix: string;
  /** Maximum storage size in bytes */
  maxSize: number;
  /** Default TTL in ms */
  defaultTTL: number;
}

export interface OfflineEntry<T = unknown> {
  /** Entry key */
  key: string;
  /** Stored value */
  value: T;
  /** Created timestamp */
  createdAt: number;
  /** Last accessed timestamp */
  accessedAt: number;
  /** Expiration timestamp */
  expiresAt?: number;
  /** Entry size in bytes */
  size: number;
  /** Tags for grouping */
  tags?: string[];
  /** Is this entry dirty (needs sync) */
  dirty: boolean;
}

export interface OfflineQueryOptions {
  /** Filter by tags */
  tags?: string[];
  /** Include expired entries */
  includeExpired?: boolean;
  /** Include only dirty entries */
  onlyDirty?: boolean;
  /** Sort by field */
  sortBy?: 'createdAt' | 'accessedAt' | 'size';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Limit results */
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Offline Manager State
// ─────────────────────────────────────────────────────────────

export interface OfflineState {
  /** Is offline mode active */
  isOffline: boolean;
  /** Is sync in progress */
  isSyncing: boolean;
  /** Last successful sync */
  lastSyncAt?: number;
  /** Sync queue stats */
  queueStats: SyncQueueStats;
  /** Storage usage */
  storageUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  /** Pending actions count */
  pendingActions: number;
}

// ─────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────

export type OfflineEventType = 
  | 'offline'
  | 'online'
  | 'sync_start'
  | 'sync_complete'
  | 'sync_error'
  | 'action_added'
  | 'action_synced'
  | 'action_failed'
  | 'conflict_detected'
  | 'storage_full'
  | 'storage_cleared';

export interface OfflineEvent {
  type: OfflineEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type OfflineEventListener = (event: OfflineEvent) => void;

// ─────────────────────────────────────────────────────────────
// Resource Types for Offline
// ─────────────────────────────────────────────────────────────

export interface OfflineResourceConfig {
  /** Resource name */
  name: string;
  /** Endpoint for sync */
  endpoint: string;
  /** Primary key field */
  primaryKey: string;
  /** TTL for cached data */
  ttl: number;
  /** Conflict resolution strategy */
  conflictStrategy: ConflictStrategy;
  /** Should cache locally */
  cacheLocally: boolean;
  /** Should queue mutations */
  queueMutations: boolean;
}

export const DEFAULT_OFFLINE_RESOURCES: OfflineResourceConfig[] = [
  {
    name: 'destinations',
    endpoint: '/api/destinations',
    primaryKey: 'id',
    ttl: 3600000, // 1 hour
    conflictStrategy: 'server_wins',
    cacheLocally: true,
    queueMutations: false,
  },
  {
    name: 'itineraries',
    endpoint: '/api/itineraries',
    primaryKey: 'id',
    ttl: 300000, // 5 minutes
    conflictStrategy: 'merge',
    cacheLocally: true,
    queueMutations: true,
  },
  {
    name: 'trips',
    endpoint: '/api/trips',
    primaryKey: 'id',
    ttl: 300000,
    conflictStrategy: 'merge',
    cacheLocally: true,
    queueMutations: true,
  },
  {
    name: 'favorites',
    endpoint: '/api/favorites',
    primaryKey: 'id',
    ttl: 60000, // 1 minute
    conflictStrategy: 'merge',
    cacheLocally: true,
    queueMutations: true,
  },
  {
    name: 'messages',
    endpoint: '/api/messages',
    primaryKey: 'id',
    ttl: 0, // No cache
    conflictStrategy: 'server_wins',
    cacheLocally: false,
    queueMutations: true,
  },
  {
    name: 'user_preferences',
    endpoint: '/api/preferences',
    primaryKey: 'userId',
    ttl: 86400000, // 24 hours
    conflictStrategy: 'merge',
    cacheLocally: true,
    queueMutations: true,
  },
];

// ─────────────────────────────────────────────────────────────
// Default Configurations
// ─────────────────────────────────────────────────────────────

export const DEFAULT_SYNC_QUEUE_CONFIG: SyncQueueConfig = {
  maxSize: 1000,
  autoSync: true,
  syncInterval: 30000, // 30 seconds
  maxRetries: 5,
  batchSize: 10,
  backoffBase: 1000, // 1 second
  backoffMax: 60000, // 1 minute
};

export const DEFAULT_OFFLINE_STORAGE_CONFIG: OfflineStorageConfig = {
  prefix: 'offline_',
  maxSize: 50 * 1024 * 1024, // 50 MB
  defaultTTL: 86400000, // 24 hours
};