/**
 * 📮 REQUEST QUEUE
 * Offline-first request queuing
 * 
 * Features:
 * - Queue requests when offline
 * - Auto-replay when online
 * - Persistent queue (survives app restart)
 * - Max retry attempts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueuedRequest, RequestConfig } from './types';
import { networkManager } from './NetworkManager';

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────
const QUEUE_STORAGE_KEY = 'offline_request_queue';
const MAX_QUEUE_SIZE = 50;
const MAX_ATTEMPTS = 3;

// ─────────────────────────────────────────────────────────────
// REQUEST QUEUE CLASS
// ─────────────────────────────────────────────────────────────
type RequestExecutor = (request: QueuedRequest) => Promise<unknown>;

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private executor: RequestExecutor | null = null;
  private listeners: Set<(queue: QueuedRequest[]) => void> = new Set();

  /**
   * Initialize queue from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Filter out old attempts
        this.queue = this.queue.filter(r => r.attempts < MAX_ATTEMPTS);
        this.log('Loaded from storage', { count: this.queue.length });
      }
    } catch (error) {
      this.logError('Failed to load queue', error);
    }
  }

  /**
   * Set request executor
   */
  setExecutor(executor: RequestExecutor): void {
    this.executor = executor;
  }

  /**
   * Add request to queue
   */
  async enqueue(
    method: QueuedRequest['method'],
    path: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<string> {
    const request: QueuedRequest = {
      id: this.generateId(),
      method,
      path,
      data,
      config,
      timestamp: Date.now(),
      attempts: 0,
    };

    // Enforce max queue size
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest request
      this.queue.shift();
      this.log('Queue full, removed oldest');
    }

    this.queue.push(request);
    await this.persist();
    this.notifyListeners();

    this.log('Enqueued request', { id: request.id, method, path });
    return request.id;
  }

  /**
   * Process all queued requests
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.executor) return;
    if (!networkManager.isOnline()) {
      this.log('Offline, skipping queue processing');
      return;
    }

    this.isProcessing = true;
    this.log('Processing queue', { count: this.queue.length });

    const failed: QueuedRequest[] = [];

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      request.attempts++;

      try {
        await this.executor(request);
        this.log('Request succeeded', { id: request.id });
      } catch (error) {
        this.logError('Request failed', { id: request.id, error });
        
        if (request.attempts < MAX_ATTEMPTS) {
          failed.push(request);
        } else {
          this.log('Max attempts reached, discarding', { id: request.id });
        }
      }
    }

    // Re-queue failed requests
    this.queue = failed;
    await this.persist();
    this.notifyListeners();

    this.isProcessing = false;
    this.log('Queue processing complete', { remaining: this.queue.length });
  }

  /**
   * Get queue status
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  /**
   * Get queue size
   */
  getSize(): number {
    return this.queue.length;
  }

  /**
   * Check if queue has pending requests
   */
  hasPending(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Clear queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.persist();
    this.notifyListeners();
    this.log('Queue cleared');
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: QueuedRequest[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Persist queue to storage
   */
  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      this.logError('Failed to persist queue', error);
    }
  }

  /**
   * Notify listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getQueue());
      } catch (error) {
        this.logError('Listener error', error);
      }
    });
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ─────────────────────────────────────────────────────────────
  // LOGGING
  // ─────────────────────────────────────────────────────────────

  private log(message: string, data?: unknown): void {
    if (__DEV__) {
      console.log(`📮 [RequestQueue] ${message}`, data ?? '');
    }
  }

  private logError(message: string, error: unknown): void {
    if (__DEV__) {
      console.error(`📮❌ [RequestQueue] ${message}`, error);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────
export const requestQueue = new RequestQueue();
export default requestQueue;