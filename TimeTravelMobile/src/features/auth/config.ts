import { Platform } from "react-native";

import type { OAuthClientConfig } from "./types";

export const AUTH_SCHEME = "timetravel";
export const AUTH_SUPPORT_EMAIL = "support@timetravel.app";
export const AUTH_TERMS_URL = "https://timetravel.app/terms";
export const AUTH_PRIVACY_URL = "https://timetravel.app/privacy";

export const GOOGLE_OAUTH_CONFIG: OAuthClientConfig = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  expoClientId:
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ??
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    "",
};

export const GOOGLE_OAUTH_ENABLED = Boolean(
  GOOGLE_OAUTH_CONFIG.webClientId ||
    GOOGLE_OAUTH_CONFIG.iosClientId ||
    GOOGLE_OAUTH_CONFIG.androidClientId ||
    GOOGLE_OAUTH_CONFIG.expoClientId,
);

export const APPLE_SIGN_IN_ENABLED = Platform.OS === "ios";