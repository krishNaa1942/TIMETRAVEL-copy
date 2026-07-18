/**
 * App Configuration Constants - Canonical Runtime Config
 * ======================================================
 * Shared runtime config for the Expo app. Legacy compatibility modules
 * re-export from here so the app only has one source of truth.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

const API_PORT = 5001;
const isDevelopment = __DEV__;
const isProduction = !__DEV__;

function getExtraConfig(): { apiUrl?: string; webUrl?: string } {
  return (
    (Constants.expoConfig?.extra as
      | { apiUrl?: string; webUrl?: string }
      | undefined) ?? {}
  );
}

function buildApiUrl(host: string): string {
  return `http://${host}:${API_PORT}/api`;
}

function extractHost(value: string | undefined | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes("://") ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(normalized);
    return url.hostname || null;
  } catch {
    const hostPart = trimmed.split(":")[0];
    return hostPart || null;
  }
}

function isPrivateHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "10.0.2.2" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function getExpoHost(): string | null {
  const hostCandidates = [
    Constants.expoConfig?.hostUri,
    (Constants.expoConfig as any)?.debuggerHost,
    (Constants as any)?.manifest2?.debuggerHost,
    (Constants as any)?.manifest?.debuggerHost,
  ];

  for (const candidate of hostCandidates) {
    const host = extractHost(candidate);
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  }

  return null;
}

function resolveDevelopmentApiUrl(
  candidateUrl: string,
  expoHost: string | null,
): string {
  const candidateHost = extractHost(candidateUrl);

  if (!candidateHost || !isPrivateHost(candidateHost)) {
    return candidateUrl;
  }

  if (expoHost && candidateHost !== expoHost) {
    return `http://${expoHost}:5001/api`;
  }

  return candidateUrl;
}

function getWebAppUrl(): string {
  const extraConfig = getExtraConfig();
  const envWebUrl = process.env.EXPO_PUBLIC_WEB_URL;

  return (
    envWebUrl?.trim() || extraConfig.webUrl?.trim() || "https://timetravel.app"
  );
}

// API URLs - Use environment variables with fallbacks
const getApiUrl = (): string => {
  // Priority: Environment variable > Expo extra > Platform default
  const expoHost = getExpoHost();

  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) {
    return resolveDevelopmentApiUrl(envApiUrl, expoHost);
  }

  const extraApiUrl = getExtraConfig().apiUrl;
  if (extraApiUrl) {
    return resolveDevelopmentApiUrl(extraApiUrl, expoHost);
  }

  const lanIp = process.env.LAN_IP;
  if (lanIp) {
    if (expoHost && lanIp !== expoHost && isPrivateHost(lanIp)) {
      return `http://${expoHost}:5001/api`;
    }

    return `http://${lanIp}:5001/api`;
  }

  if (Platform.OS === "web") {
    // Web: Use same origin to avoid CORS issues
    return "/api";
  }

  // Mobile: Use environment-based or localhost for development
  if (isDevelopment) {
    // For development, you can set your machine's IP here
    // Or use: npx expo start --tunnel to get a public URL
    if (Platform.OS === "android") {
      if (Constants.isDevice) {
        if (expoHost) {
          return `http://${expoHost}:5001/api`;
        }
      }
      return "http://10.0.2.2:5001/api";
    }

    return `http://${expoHost || "127.0.0.1"}:5001/api`;
  }

  // Production mobile - should be set via EXPO_PUBLIC_API_URL
  // This fallback will likely fail in production
  console.warn(
    "No API URL configured for production. Set EXPO_PUBLIC_API_URL environment variable.",
  );
  return "https://api.timetotravel.app/api";
};

export const APP_WEB_URL = getWebAppUrl();
export const API_BASE_URL = getApiUrl();

export const API_TIMEOUT = 15000; // 15 seconds
export const API_RETRY_ATTEMPTS = 3;
export const API_RETRY_DELAY = 1000; // 1 second

// App Information
export const APP_NAME = "Time To Travel";
export const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

// Session Configuration (matches backend)
export const SESSION_LIFETIME_MINUTES = 60;
export const SESSION_REFRESH_THRESHOLD_MINUTES = 15;
export const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in ms

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Chat Configuration
export const MAX_MESSAGE_LENGTH = 2000;
export const CHAT_HISTORY_LIMIT = 50;

// Offline Configuration
export const OFFLINE_QUEUE_LIMIT = 100;
export const OFFLINE_SYNC_INTERVAL = 30 * 1000; // 30 seconds

// Feature Flags
export const FEATURES = {
  AI_RECOMMENDATIONS: true,
  OFFLINE_MODE: true,
  REAL_TIME_UPDATES: isProduction, // Only in production
  ANALYTICS: isProduction,
  CRASH_REPORTING: isProduction,
};

// Debug Configuration - ALWAYS false in production
export const DEBUG = {
  AUTH: isDevelopment,
  API: isDevelopment,
  STATE: isDevelopment,
  PERFORMANCE: isDevelopment,
};
