/**
 * 🔄 REQUEST DEDUPLICATOR
 * Prevents duplicate in-flight requests by returning same promise
 * 
 * Key Features:
 * - Detects identical in-flight requests
 * - Returns same promise to all callers
 * - Auto-cleanup after resolution
 */

import { HttpMethod, ApiResponse, DedupeEntry } from './types';

// ─────────────────────────────────────────────────────────────
// DEDUPLICATOR CLASS
// ─────────────────────────────────────────────────────────────
export class RequestDeduplicator {
  private pendingRequests: Map<string, DedupeEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly maxAge = 60000; // 1 minute max pending time

  constructor() {
    this.startCleanup();
  }

  /**
   * Generate deduplication key
   */
  private generateKey(
    method: HttpMethod,
    path: string,
    data?: unknown
  ): string {
    const dataHash = data ? this.hashData(data) : '';
    return `${method}:${path}:${dataHash}`;
  }

  /**
   * Simple hash function for request data
   */
  private hashData(data: unknown): string {
    try {
      const str = JSON.stringify(data);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    } catch {
      return 'unhashable';
    }
  }

  /**
   * Check if request is already pending
   */
  isPending(method: HttpMethod, path: string, data?: unknown): boolean {
    const key = this.generateKey(method, path, data);
    return this.pendingRequests.has(key);
  }

  /**
   * Get existing promise or create new one
   * Returns [promise, isNew] where isNew indicates if this is a new request
   */
  getOrCreate<T>(
    method: HttpMethod,
    path: string,
    data: unknown,
    factory: () => Promise<ApiResponse<T>>
  ): { promise: Promise<ApiResponse<T>>; isNew: boolean } {
    const key = this.generateKey(method, path, data);

    // Check for existing pending request
    const existing = this.pendingRequests.get(key);
    if (existing) {
      return {
        promise: existing.promise as Promise<ApiResponse<T>>,
        isNew: false,
      };
    }

    // Create new request
    const promise = factory()
      .finally(() => {
        // Cleanup after resolution
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, {
      key,
      promise: promise as Promise<ApiResponse<unknown>>,
      timestamp: Date.now(),
    });

    return { promise, isNew: true };
  }

  /**
   * Cancel a pending request
   */
  cancel(method: HttpMethod, path: string, data?: unknown): boolean {
    const key = this.generateKey(method, path, data);
    return this.pendingRequests.delete(key);
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get count of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get all pending keys
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.pendingRequests.forEach((entry, key) => {
        if (now - entry.timestamp > this.maxAge) {
          this.pendingRequests.delete(key);
        }
      });
    }, 10000);
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.pendingRequests.clear();
  }
}

// Singleton instance
export const requestDeduplicator = new RequestDeduplicator();
export default RequestDeduplicator;