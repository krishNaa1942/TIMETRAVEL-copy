import { ApiError, apiClient, tokenManager } from "@/services/apiClient";
import { useAuthStore, type User } from "@/stores/authStore";

import type {
  AppleExchangePayload,
  GoogleExchangePayload,
  OAuthExchangeResponse,
  OAuthUserPayload,
  TokenBundle,
} from "../types";
import { normalizeEmail } from "../utils";

function normalizeUser(user: OAuthUserPayload): User {
  return {
    id: String(user.id),
    name: user.name,
    email: normalizeEmail(user.email),
    avatar: user.avatarUrl ?? user.avatar_url,
    avatar_url: user.avatar_url,
    preferences: user.preferences ?? {},
  };
}

async function commitAuthResponse(
  response: OAuthExchangeResponse,
): Promise<User> {
  if (!response.success) {
    throw new ApiError({
      code: "INVALID_RESPONSE",
      message: response.error || "Invalid OAuth response",
      status: 500,
      retryable: false,
      userMessage: response.error || "Authentication failed. Please try again.",
    });
  }

  const tokens: TokenBundle | undefined = response.tokens;

  if (!response.user || !tokens) {
    throw new ApiError({
      code: "INVALID_RESPONSE",
      message: "Invalid OAuth response",
      status: 500,
      retryable: false,
      userMessage: "Authentication failed. Please try again.",
    });
  }

  await tokenManager.setTokens(tokens);

  const user = normalizeUser(response.user);
  useAuthStore.getState().setUser(user);

  return user;
}

export async function signInWithGoogle(
  payload: GoogleExchangePayload,
): Promise<User> {
  const response = await apiClient.post<OAuthExchangeResponse>(
    "/auth/v2/oauth/google",
    payload,
    { skipDedup: true, skipRetry: true },
  );

  return commitAuthResponse(response);
}

export async function signInWithApple(
  payload: AppleExchangePayload,
): Promise<User> {
  const response = await apiClient.post<OAuthExchangeResponse>(
    "/auth/v2/oauth/apple",
    payload,
    { skipDedup: true, skipRetry: true },
  );

  return commitAuthResponse(response);
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await apiClient.post<{ success: boolean; message: string }>(
    "/auth/v2/password-reset",
    { email: normalizeEmail(email) },
    { skipDedup: true, skipRetry: true },
  );

  return response.message;
}
