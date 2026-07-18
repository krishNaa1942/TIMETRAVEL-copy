/**
 * 📝 STRUCTURED LOGGER
 * ====================
 * Production-grade logging with levels, context, and remote transport
 */

import type { LogLevel, LogEntry, DeviceInfo } from './types';

// Level priority for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export class Logger {
  private module: string;
  private minLevel: LogLevel;
  private enableConsole: boolean;
  private enableRemote: boolean;
  private deviceInfo?: DeviceInfo;
  private userId?: string;
  private buffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor(config: {
    module: string;
    minLevel: LogLevel;
    enableConsole?: boolean;
    enableRemote?: boolean;
    deviceInfo?: DeviceInfo;
  }) {
    this.module = config.module;
    this.minLevel = config.minLevel;
    this.enableConsole = config.enableConsole ?? __DEV__;
    this.enableRemote = config.enableRemote ?? !__DEV__;
    this.deviceInfo = config.deviceInfo;
  }

  setUserId(userId: string | undefined): void {
    this.userId = userId;
  }

  setDeviceInfo(info: DeviceInfo): void {
    this.deviceInfo = info;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, { ...context, errorName: error?.name, errorMessage: error?.message, errorStack: error?.stack });
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('fatal', message, { ...context, errorName: error?.name, errorMessage: error?.message, errorStack: error?.stack });
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      module: this.module,
      context,
      userId: this.userId,
      deviceInfo: this.deviceInfo,
      traceId: generateTraceId(),
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) this.buffer.shift();

    if (this.enableConsole) this.logToConsole(entry);
    if (this.enableRemote) this.logToRemote(entry);
  }

  private logToConsole(entry: LogEntry): void {
    const styles: Record<LogLevel, string> = {
      debug: 'color: gray',
      info: 'color: blue',
      warn: 'color: orange',
      error: 'color: red',
      fatal: 'color: white; background: red',
    };

    const prefix = `[${entry.level.toUpperCase()}] [${entry.module}]`;
    console.log(`%c${prefix}`, styles[entry.level], entry.message, entry.context ?? '');
  }

  private async logToRemote(_entry: LogEntry): Promise<void> {
    // In production, send to logging service (Sentry, LogRocket, etc.)
  }

  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  flush(): LogEntry[] {
    const entries = [...this.buffer];
    this.buffer = [];
    return entries;
  }

  createChildModule(module: string): Logger {
    return new Logger({
      module: `${this.module}:${module}`,
      minLevel: this.minLevel,
      enableConsole: this.enableConsole,
      enableRemote: this.enableRemote,
      deviceInfo: this.deviceInfo,
    });
  }
}

function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Default logger instance
export const createLogger = (module: string, config?: Partial<ConstructorParameters<typeof Logger>[0]>): Logger =>
  new Logger({ module, minLevel: __DEV__ ? 'debug' : 'info', ...config });