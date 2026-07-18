/**
 * 📊 TELEMETRY TYPES
 * ===================
 * Production-grade observability and telemetry types
 */

// ─────────────────────────────────────────────────────────────
// Log Types
// ─────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
  module?: string;
  traceId?: string;
  userId?: string;
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
  appVersion: string;
  deviceId: string;
  modelName?: string;
}

// ─────────────────────────────────────────────────────────────
// Metrics Types
// ─────────────────────────────────────────────────────────────

export interface MetricEntry {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timing';
}

export interface ApiMetric {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  cached: boolean;
  timestamp: number;
}

export interface CacheMetric {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  entries: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Analytics Types
// ─────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

export interface ScreenViewEvent {
  screenName: string;
  previousScreen?: string;
  duration?: number;
  timestamp: number;
}

export interface UserProperties {
  userId: string;
  email?: string;
  name?: string;
  createdAt: number;
  lastLoginAt: number;
  subscription?: 'free' | 'premium' | 'enterprise';
  preferences?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Error Tracking Types
// ─────────────────────────────────────────────────────────────

export interface ErrorReport {
  errorId: string;
  error: Error;
  errorContext: ErrorContext;
  timestamp: number;
  handled: boolean;
  breadcrumbs: Breadcrumb[];
  deviceInfo: DeviceInfo;
  appState?: AppState;
}

export interface ErrorContext {
  componentStack?: string;
  route?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface Breadcrumb {
  timestamp: number;
  category: 'navigation' | 'api' | 'user' | 'error' | 'log';
  message: string;
  data?: Record<string, unknown>;
}

export interface AppState {
  networkOnline: boolean;
  memoryUsage?: number;
  storageUsage?: number;
  activeScreen?: string;
}

// ─────────────────────────────────────────────────────────────
// Telemetry Config
// ─────────────────────────────────────────────────────────────

export interface TelemetryConfig {
  enabled: boolean;
  logLevel: LogLevel;
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  enableAnalytics: boolean;
  enablePerformanceTracking: boolean;
  enableCrashReporting: boolean;
  samplingRate: number;
  maxBreadcrumbs: number;
  flushInterval: number;
  remoteLogEndpoint?: string;
  analyticsKey?: string;
  crashReportingKey?: string;
}

export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: true,
  logLevel: __DEV__ ? 'debug' : 'info',
  enableConsoleLogging: __DEV__,
  enableRemoteLogging: !__DEV__,
  enableAnalytics: true,
  enablePerformanceTracking: true,
  enableCrashReporting: !__DEV__,
  samplingRate: __DEV__ ? 1.0 : 0.1,
  maxBreadcrumbs: 50,
  flushInterval: 30000, // 30 seconds
};

// ─────────────────────────────────────────────────────────────
// Telemetry Stats
// ─────────────────────────────────────────────────────────────

export interface TelemetryStats {
  logsEmitted: number;
  errorsTracked: number;
  eventsTracked: number;
  metricsRecorded: number;
  breadcrumbsStored: number;
  lastFlushAt?: number;
}

export type TelemetryEventListener = (event: AnalyticsEvent) => void;