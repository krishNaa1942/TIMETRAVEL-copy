/**
 * 📈 USER ANALYTICS
 * =================
 * Track user events, screen views, and user properties
 */

import type { AnalyticsEvent, ScreenViewEvent, UserProperties, TelemetryEventListener } from './types';

export class Analytics {
  private events: AnalyticsEvent[] = [];
  private screenViews: ScreenViewEvent[] = [];
  private maxEvents = 200;
  private sessionId: string;
  private userId?: string;
  private userProperties?: UserProperties;
  private listeners: TelemetryEventListener[] = [];
  private currentScreen?: string;
  private screenEnterTime?: number;

  constructor() {
    this.sessionId = generateSessionId();
    this.listeners = [];
  }

  // ─────────────────────────────────────────────────────────────
  // User Management
  // ─────────────────────────────────────────────────────────────

  setUserId(userId: string | undefined): void {
    this.userId = userId;
  }

  setUserProperties(properties: UserProperties): void {
    this.userProperties = properties;
  }

  // ─────────────────────────────────────────────────────────────
  // Event Tracking
  // ─────────────────────────────────────────────────────────────

  trackEvent(name: string, properties?: Record<string, unknown>): void {
    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.shift();

    // Notify listeners
    this.listeners.forEach(listener => listener(event));

    // In production, send to analytics service
    this.sendToService(event);
  }

  // ─────────────────────────────────────────────────────────────
  // Screen Tracking
  // ─────────────────────────────────────────────────────────────

  trackScreenView(screenName: string): void {
    const now = Date.now();
    
    // Track previous screen duration
    if (this.currentScreen && this.screenEnterTime) {
      const duration = now - this.screenEnterTime;
      this.trackEvent('screen_exit', { screen: this.currentScreen, duration });
    }

    const viewEvent: ScreenViewEvent = {
      screenName,
      previousScreen: this.currentScreen,
      timestamp: now,
    };

    this.screenViews.push(viewEvent);
    this.currentScreen = screenName;
    this.screenEnterTime = now;

    this.trackEvent('screen_view', { screen: screenName });
  }

  getCurrentScreen(): string | undefined {
    return this.currentScreen;
  }

  // ─────────────────────────────────────────────────────────────
  // Listeners
  // ─────────────────────────────────────────────────────────────

  addListener(listener: TelemetryEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Data Access
  // ─────────────────────────────────────────────────────────────

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // ─────────────────────────────────────────────────────────────
  // Service Integration
  // ─────────────────────────────────────────────────────────────

  private async sendToService(_event: AnalyticsEvent): Promise<void> {
    // In production: Send to Mixpanel, Amplitude, Firebase Analytics, etc.
    if (__DEV__) {
      console.log('[Analytics]', _event.name, _event.properties);
    }
  }

  flush(): AnalyticsEvent[] {
    const events = [...this.events];
    this.events = [];
    return events;
  }

  reset(): void {
    this.sessionId = generateSessionId();
    this.events = [];
    this.screenViews = [];
    this.userId = undefined;
    this.userProperties = undefined;
    this.currentScreen = undefined;
    this.screenEnterTime = undefined;
  }
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// Singleton
let analyticsInstance: Analytics | null = null;
export const getAnalytics = (): Analytics => analyticsInstance ?? (analyticsInstance = new Analytics());
export const resetAnalytics = (): void => { analyticsInstance = null; };