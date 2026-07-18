import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";

import { APPLE_SIGN_IN_ENABLED, AUTH_SCHEME, GOOGLE_OAUTH_CONFIG, GOOGLE_OAUTH_ENABLED } from "../config";
import { formatDisplayName } from "../utils";
import { signInWithApple, signInWithGoogle } from "../services/socialAuthService";
import type { AuthProvider } from "../types";

WebBrowser.maybeCompleteAuthSession();

async function createNonce(length = 16): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(length);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface UseSocialAuthResult {
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  isGoogleReady: boolean;
  isAppleReady: boolean;
  loadingProvider: AuthProvider | null;
  googleHint: string;
  appleHint: string;
}

export function useSocialAuth(): UseSocialAuthResult {
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);
  const [isAppleReady, setIsAppleReady] = useState(APPLE_SIGN_IN_ENABLED);

  const googleClientId = useMemo(
    () =>
      GOOGLE_OAUTH_CONFIG.expoClientId ||
      GOOGLE_OAUTH_CONFIG.webClientId ||
      GOOGLE_OAUTH_CONFIG.iosClientId ||
      GOOGLE_OAUTH_CONFIG.androidClientId ||
      "disabled-google-client",
    [],
  );

  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_OAUTH_CONFIG.expoClientId || googleClientId,
    iosClientId: GOOGLE_OAUTH_CONFIG.iosClientId || googleClientId,
    androidClientId: GOOGLE_OAUTH_CONFIG.androidClientId || googleClientId,
    webClientId: GOOGLE_OAUTH_CONFIG.webClientId || googleClientId,
    scopes: ["openid", "profile", "email"],
    redirectUri: AuthSession.makeRedirectUri({ scheme: AUTH_SCHEME, path: "auth" }),
  });

  useEffect(() => {
    let mounted = true;

    if (Platform.OS !== "ios") {
      setIsAppleReady(false);
      return undefined;
    }

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) {
          setIsAppleReady(available);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsAppleReady(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signInWithGoogleProvider = useCallback(async () => {
    if (!GOOGLE_OAUTH_ENABLED) {
      throw new Error("Google sign-in is not configured yet.");
    }

    if (!request) {
      throw new Error("Google sign-in is still loading.");
    }

    setLoadingProvider("google");

    try {
      const result = await promptAsync();

      if (result.type !== "success") {
        if (result.type === "cancel" || result.type === "dismiss") {
          return;
        }

        throw new Error("Google sign-in was not completed.");
      }

      const accessToken =
        result.authentication?.accessToken ||
        (result.params as Record<string, string | undefined> | undefined)?.access_token;

      if (!accessToken) {
        throw new Error("Google did not return an access token.");
      }

      await signInWithGoogle({
        access_token: accessToken,
        id_token: (result.params as Record<string, string | undefined> | undefined)?.id_token ?? null,
      });
    } finally {
      setLoadingProvider(null);
    }
  }, [promptAsync, request]);

  const signInWithAppleProvider = useCallback(async () => {
    if (!isAppleReady) {
      throw new Error("Apple sign-in is only available on iPhone or iPad.");
    }

    setLoadingProvider("apple");

    try {
      const nonce = await createNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }

      await signInWithApple({
        identity_token: credential.identityToken,
        authorization_code: credential.authorizationCode ?? null,
        email: credential.email ?? null,
        name: formatDisplayName(credential.fullName),
        nonce,
      });
    } finally {
      setLoadingProvider(null);
    }
  }, [isAppleReady]);

  return {
    signInWithGoogle: signInWithGoogleProvider,
    signInWithApple: signInWithAppleProvider,
    isGoogleReady: GOOGLE_OAUTH_ENABLED && Boolean(request),
    isAppleReady,
    loadingProvider,
    googleHint: GOOGLE_OAUTH_ENABLED
      ? ""
      : "Set EXPO_PUBLIC_GOOGLE_* client IDs to enable Google sign-in.",
    appleHint: isAppleReady
      ? ""
      : "Apple sign-in is available on Apple devices only.",
  };
}