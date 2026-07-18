/**
 * Token manager core used by the shared API client.
 * Keeps token lifecycle and secure storage isolated from HTTP logic.
 */

import axios from "axios";
import { API_BASE_URL } from "@/constants/config";
import { secureStorage } from "./secureStorage";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

class TokenManagerCore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry = 0;
  private refreshPromise: Promise<boolean> | null = null;
  private listeners: Set<(authenticated: boolean) => void> = new Set();

  subscribe(callback: (authenticated: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(authenticated: boolean): void {
    this.listeners.forEach((callback) => callback(authenticated));
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.tokenExpiry = Date.now() + tokens.expires_in * 1000 - 60000;

    await secureStorage.storeTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: this.tokenExpiry,
      tokenType: "Bearer",
    });

    this.notify(true);
  }

  async getAccessToken(): Promise<string | null> {
    return this.accessToken;
  }

  async getRefreshToken(): Promise<string | null> {
    return this.refreshToken;
  }

  async peekRefreshToken(): Promise<string | null> {
    return this.refreshToken;
  }

  async isTokenExpired(): Promise<boolean> {
    return !this.accessToken || Date.now() >= this.tokenExpiry;
  }

  async loadTokensFromStorage(): Promise<void> {
    try {
      const storedAccessToken = await secureStorage.getAccessToken();
      const storedRefreshToken = await secureStorage.getRefreshToken();
      const storedExpiry = await secureStorage.getTokenExpiry();

      if (storedAccessToken && storedRefreshToken) {
        this.accessToken = storedAccessToken;
        this.refreshToken = storedRefreshToken;
        this.tokenExpiry = storedExpiry || 0;
      }
    } catch (error) {
      console.error("🔐 Failed to load tokens from storage:", error);
    }
  }

  async resetTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;

    await secureStorage.clearTokens();
    this.notify(false);
  }

  async clearTokens(): Promise<void> {
    await this.resetTokens();
  }

  private async doRefresh(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/v2/refresh`,
        {
          refresh_token: this.refreshToken,
        },
        {
          timeout: 10000,
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.data?.tokens) {
        await this.setTokens(response.data.tokens);
        return true;
      }

      return false;
    } catch (error) {
      console.warn("🔐 Token refresh failed, redirecting to login:", error);
      await this.resetTokens();
      return false;
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async getValidToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.accessToken) {
      await this.loadTokensFromStorage();
    }

    if (!this.accessToken || !this.refreshToken) {
      return null;
    }

    if (Date.now() >= this.tokenExpiry) {
      const refreshed = await this.refreshAccessToken();
      return refreshed ? this.accessToken : null;
    }

    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiry;
  }
}

export const tokenManager = new TokenManagerCore();
export default tokenManager;
