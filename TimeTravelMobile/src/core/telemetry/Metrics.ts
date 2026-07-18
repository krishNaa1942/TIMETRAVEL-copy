/**
 * 📊 PERFORMANCE METRICS
 * ======================
 * Track API latency, cache hits, and performance metrics
 */

import type { MetricEntry, ApiMetric, CacheMetric, PerformanceMetric } from './types';

export class Metrics {
  private metrics: MetricEntry[] = [];
  private apiMetrics: ApiMetric[] = [];
  private maxMetrics = 500;
  private apiLatencyBuckets: Record<string, number[]> = {};

  // ─────────────────────────────────────────────────────────────
  // API Metrics
  // ─────────────────────────────────────────────────────────────

  trackApiLatency(endpoint: string, method: string, duration: number, statusCode: number, cached: boolean): void {
    const metric: ApiMetric = { endpoint, method, duration, statusCode, cached, timestamp: Date.now() };
    this.apiMetrics.push(metric);
    if (this.apiMetrics.length > this.maxMetrics) this.apiMetrics.shift();

    // Track in buckets for percentile calculation
    const key = `${method}:${endpoint}`;
    if (!this.apiLatencyBuckets[key]) this.apiLatencyBuckets[key] = [];
    this.apiLatencyBuckets[key].push(duration);
    if (this.apiLatencyBuckets[key].length > 100) this.apiLatencyBuckets[key].shift();
  }

  getApiMetrics(endpoint?: string): ApiMetric[] {
    if (endpoint) return this.apiMetrics.filter(m => m.endpoint === endpoint);
    return [...this.apiMetrics];
  }

  getAverageLatency(endpoint: string): number {
    const key = `GET:${endpoint}`;
    const bucket = this.apiLatencyBuckets[key];
    if (!bucket?.length) return 0;
    return bucket.reduce((a, b) => a + b, 0) / bucket.length;
  }

  getP95Latency(endpoint: string): number {
    const key = `GET:${endpoint}`;
    const bucket = this.apiLatencyBuckets[key];
    if (!bucket?.length) return 0;
    const sorted = [...bucket].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Cache Metrics
  // ─────────────────────────────────────────────────────────────

  private cacheHits = 0;
  private cacheMisses = 0;

  trackCacheHit(): void { this.cacheHits++; }
  trackCacheMiss(): void { this.cacheMisses++; }

  getCacheMetrics(): CacheMetric {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.cacheHits + this.cacheMisses > 0 
        ? this.cacheHits / (this.cacheHits + this.cacheMisses) 
        : 0,
      size: 0, // Populated by CacheManager
      entries: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Custom Metrics
  // ─────────────────────────────────────────────────────────────

  recordMetric(name: string, value: number, type: MetricEntry['type'] = 'gauge', tags?: Record<string, string>): void {
    this.metrics.push({ name, value, type, tags, timestamp: Date.now() });
    if (this.metrics.length > this.maxMetrics) this.metrics.shift();
  }

  increment(name: string, tags?: Record<string, string>): void {
    const existing = this.metrics.filter(m => m.name === name).pop();
    this.recordMetric(name, (existing?.value ?? 0) + 1, 'counter', tags);
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.recordMetric(name, durationMs, 'timing', tags);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, 'gauge', tags);
  }

  // ─────────────────────────────────────────────────────────────
  // Performance Tracking
  // ─────────────────────────────────────────────────────────────

  private performanceMarks: Map<string, number> = new Map();

  startMeasure(name: string): void {
    this.performanceMarks.set(name, Date.now());
  }

  endMeasure(name: string): number {
    const start = this.performanceMarks.get(name);
    if (!start) return 0;
    const duration = Date.now() - start;
    this.performanceMarks.delete(name);
    this.timing(name, duration);
    return duration;
  }

  getMetrics(): MetricEntry[] { return [...this.metrics]; }
  
  flush(): MetricEntry[] {
    const all = [...this.metrics];
    this.metrics = [];
    return all;
  }
}

// Singleton
let metricsInstance: Metrics | null = null;
export const getMetrics = (): Metrics => metricsInstance ?? (metricsInstance = new Metrics());
export const resetMetrics = (): void => { metricsInstance = null; };