/**
 * Trip Sharing Service
 * Backend: /api/share
 */
import { APP_WEB_URL } from "@/constants/config";
import apiService from "./api";

export interface SharedTrip {
  id: number;
  share_token: string;
  title: string;
  trip_id?: number;
  notes?: string;
  view_count: number;
  is_active: boolean;
  share_url: string;
  created_at?: string;
  expires_at?: string | null;
  expires_in_days?: number | null;
}

export interface CreateSharePayload {
  title: string;
  trip_id?: number;
  itinerary_json?: Record<string, unknown>;
  notes?: string;
}

export interface ShareResponse {
  share: SharedTrip;
  share_url: string;
}

export interface SharesResponse {
  shares: SharedTrip[];
}

const SHARE_PATH_PREFIX = "/shared";

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const stripLeadingSlash = (value: string): string => value.replace(/^\/+/, "");

const joinUrl = (baseUrl: string, path: string): string =>
  `${stripTrailingSlash(baseUrl)}/${stripLeadingSlash(path)}`;

const isAbsoluteUrl = (value: string): boolean =>
  /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);

const normalizeShareUrl = (
  shareUrl: string | undefined,
  shareToken: string,
): string => {
  if (shareUrl && shareUrl.trim()) {
    const trimmed = shareUrl.trim();
    if (isAbsoluteUrl(trimmed)) {
      return trimmed;
    }

    return joinUrl(APP_WEB_URL, trimmed);
  }

  return joinUrl(APP_WEB_URL, `${SHARE_PATH_PREFIX}/${shareToken}`);
};

const normalizeShare = (share: SharedTrip): SharedTrip => ({
  ...share,
  share_url: normalizeShareUrl(share.share_url, share.share_token),
});

export const sharingService = {
  buildShareUrl(shareToken: string): string {
    return joinUrl(APP_WEB_URL, `${SHARE_PATH_PREFIX}/${shareToken}`);
  },

  resolveShareUrl(
    share: Pick<SharedTrip, "share_token" | "share_url">,
  ): string {
    return normalizeShareUrl(share.share_url, share.share_token);
  },

  normalizeShare(share: SharedTrip): SharedTrip {
    return normalizeShare(share);
  },

  async createShare(data: CreateSharePayload): Promise<ShareResponse> {
    const response = await apiService.post<ShareResponse>("/share", data, {
      skipRetry: true,
    });

    if (!response?.share || !response.share.share_token) {
      throw new Error("Invalid share response from server");
    }

    const share = normalizeShare(response.share);

    return {
      share,
      share_url: normalizeShareUrl(response.share_url, share.share_token),
    };
  },

  async listShares(): Promise<SharesResponse> {
    const response = await apiService.get<SharesResponse>("/share");

    if (!response || !Array.isArray(response.shares)) {
      throw new Error("Invalid shares response from server");
    }

    return {
      shares: response.shares.map(normalizeShare),
    };
  },

  async viewShared(token: string): Promise<unknown> {
    return apiService.get(`/share/${token}`);
  },

  async revokeShare(token: string): Promise<void> {
    await apiService.delete(`/share/${token}`, { skipRetry: true });
  },
};

export default sharingService;
