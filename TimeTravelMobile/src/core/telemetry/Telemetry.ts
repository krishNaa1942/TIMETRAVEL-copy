/**
 * 📊 TELEMETRY ORCHESTRATOR
 * =========================
 * Unified observability system combining logging, metrics, and analytics
 */

import { Logger, createLogger } from './Logger';
import { Metrics, getMetrics } from './Metrics';
import { Analytics, getAnalytics } from './Analytics';
import type { TelemetryConfig, TelemetryStats, Breadcrumb, DeviceInfo } from './types';
import { DEFAULT_TELEMETRY_CONFIG } from './types';

export class Telemetry {
  private config: TelemetryConfig;
  private logger: Logger;
  private metrics: Metrics;
  private analytics: Analytics;
  private breadcrumbs: Breadcrumb[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private userId?: string;
  private deviceInfo?: DeviceInfo;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_TELEMETRY_CONFIG, ...config };
    this.logger = createLogger('telemetry', {
      minLevel: this.config.logLevel,
      enableConsole: this.config.enableConsoleLogging,
      enableRemote: this.config.enableRemoteLogging,
    });
    this.metrics = getMetrics();
    this.analytics = getAnalytics();

    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // User & Device Context
  // ─────────────────────────────────────────────────────────────

  setUserId(userId: string | undefined): void {
    this.userId = userId;
    this.logger.setUserId(userId);
    this.analytics.setUserId(userId);
  }

  setDeviceInfo(info: DeviceInfo): void {
    this.deviceInfo = info;
    this.logger.setDeviceInfo(info);
  }

  // ─────────────────────────────────────────────────────────────
  // Logging
  // ─────────────────────────────────────────────────────────────

  log(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal', message: string, context?: Record<string, unknown>): void {
    if (!this.config.enabled) return;
    this.addBreadcrumb('log', message, context);
    if (level === 'error' || level === 'fatal') {
      this.logger[level](message, undefined, context);
    } else {
      this.logger[level](message, context);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Performance Tracking
  // ─────────────────────────────────────────────────────────────

  trackApiLatency(endpoint: string, method: string, duration: number, statusCode: number, cached: boolean): void {
    if (!this.config.enablePerformanceTracking) return;
    this.metrics.trackApiLatency(endpoint, method, duration, statusCode, cached);
    this.addBreadcrumb('api', `${method} ${endpoint}`, { duration, statusCode, cached });
  }

  trackCacheHit(): void { if (this.config.enablePerformanceTracking) this.metrics.trackCacheHit(); }
  trackCacheMiss(): void { if (this.config.enablePerformanceTracking) this.metrics.trackCacheMiss(); }

  startMeasure(name: string): void { this.metrics.startMeasure(name); }
  endMeasure(name: string): number { return this.metrics.endMeasure(name); }

  // ─────────────────────────────────────────────────────────────
  // Analytics
  // ─────────────────────────────────────────────────────────────

  trackEvent(name: string, properties?: Record<string, unknown>): void {
    if (!this.config.enableAnalytics) return;
    this.analytics.trackEvent(name, properties);
    this.addBreadcrumb('user', `Event: ${name}`, properties);
  }

  trackScreenView(screen: string): void {
    if (!this.config.enableAnalytics) return;
    this.analytics.trackScreenView(screen);
  }

  // ─────────────────────────────────────────────────────────────
  // Error Tracking
  // ─────────────────────────────────────────────────────────────

  trackError(error: Error, context?: Record<string, unknown>): void {
    if (!this.config.enableCrashReporting) return;
    this.logger.error('Error tracked', error, context);
    this.addBreadcrumb('error', error.message, { name: error.name, ...context });
    // In production: Send to Sentry, Bugsnag, etc.
  }

  // ─────────────────────────────────────────────────────────────
  // Breadcrumbs
  // ─────────────────────────────────────────────────────────────

  addBreadcrumb(category: Breadcrumb['category'], message: string, data?: Record<string, unknown>): void {
    if (this.breadcrumbs.length >= this.config.maxBreadcrumbs) this.breadcrumbs.shift();
    this.breadcrumbs.push({ timestamp: Date.now(), category, message, data });
  }

  getBreadcrumbs(): Breadcrumb[] { return [...this.breadcrumbs]; }

  // ─────────────────────────────────────────────────────────────
  // Stats & Flush
  // ─────────────────────────────────────────────────────────────

  getStats(): TelemetryStats {
    return {
      logsEmitted: this.logger.getBuffer().length,
      errorsTracked: this.logger.getBuffer().filter(l => l.level === 'error' || l.level === 'fatal').length,
      eventsTracked: this.analytics.getEvents().length,
      metricsRecorded: this.metrics.getMetrics().length,
      breadcrumbsStored: this.breadcrumbs.length,
    };
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
  }

  flush(): void {
    const logs = this.logger.flush();
    const events = this.analytics.flush();
    const metrics = this.metrics.flush();
    // In production: Send to telemetry service
    if (__DEV__ && (logs.length || events.length || metrics.length)) {
      console.log('[Telemetry] Flushed:', { logs: logs.length, events: events.length, metrics: metrics.length });
    }
  }

  reset(): void {
    this.breadcrumbs = [];
    this.userId = undefined;
    this.analytics.reset();
  }

  destroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
  }

  // Convenience getters
  getLogger(): Logger { return this.logger; }
  getMetricsInstance(): Metrics { return this.metrics; }
  getAnalyticsInstance(): Analytics { return this.analytics; }
}

// Singleton
let telemetryInstance: Telemetry | null = null;
export const getTelemetry = (config?: Partial<TelemetryConfig>): Telemetry =>
  telemetryInstance ?? (telemetryInstance = new Telemetry(config));
export const resetTelemetry = (): void => { telemetryInstance?.destroy(); telemetryInstance = null; };