/**
 * Secure Token Manager compatibility wrapper
 *
 * The API client now owns the token lifecycle and stores tokens in
 * secure storage. This wrapper keeps the older auth utilities working
 * while delegating every operation to the shared singleton.
 */

import { tokenManager as apiTokenManager } from "./tokenManagerCore";

class TokenManager {
  subscribe(callback: (authenticated: boolean) => void): () => void {
    return apiTokenManager.subscribe(callback);
  }

  async storeTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn?: number,
  ): Promise<void> {
    await apiTokenManager.setTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: expiresIn ?? 15 * 60,
    });
  }

  async getAccessToken(): Promise<string | null> {
    await apiTokenManager.loadTokensFromStorage();
    return apiTokenManager.getAccessToken();
  }

  async getRefreshToken(): Promise<string | null> {
    await apiTokenManager.loadTokensFromStorage();
    return apiTokenManager.peekRefreshToken();
  }

  async isTokenExpired(): Promise<boolean> {
    await apiTokenManager.loadTokensFromStorage();
    return apiTokenManager.isTokenExpired();
  }

  async refreshAccessToken(): Promise<string | null> {
    const refreshed = await apiTokenManager.refreshAccessToken();
    if (!refreshed) {
      return null;
    }

    return apiTokenManager.getValidToken();
  }

  async getValidToken(): Promise<string | null> {
    return apiTokenManager.getValidToken();
  }

  async clearTokens(): Promise<void> {
    await apiTokenManager.resetTokens();
  }

  isAuthenticated(): boolean {
    return apiTokenManager.isAuthenticated();
  }

  async loadTokensFromStorage(): Promise<void> {
    await apiTokenManager.loadTokensFromStorage();
  }

  async logout(): Promise<void> {
    await apiTokenManager.resetTokens();
  }
}

export const tokenManager = new TokenManager();
export default tokenManager;