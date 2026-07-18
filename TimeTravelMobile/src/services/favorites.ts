/**
 * Favorites / Wishlist Service
 * CRUD for bookmarked destinations and places
 *
 * Handles unauthenticated state gracefully - returns empty/default
 * results instead of throwing errors for better UX
 */

import apiService from "./api";
import { tokenManager } from "./tokenManager";

export interface Favorite {
  id: number;
  item_id?: string;
  item_type: "destination" | "place";
  item_name: string;
  notes: string | null;
  created_at: string;
}

export interface FavoriteCheckResult {
  is_favorite: boolean;
  favorite: Favorite | null;
}

/**
 * Check if user is authenticated before making API calls
 */
async function isAuthenticated(): Promise<boolean> {
  try {
    const token = await tokenManager.getValidToken();
    return !!token;
  } catch {
    return false;
  }
}

/**
 * Handle auth errors gracefully - return default value instead of throwing
 */
function handleAuthError(error: any, context: string): null {
  const status = error?.status || error?.response?.status;
  if (
    status === 401 ||
    error?.message?.includes("401") ||
    error?.message?.includes("Authentication")
  ) {
    console.log(`[Favorites] User not authenticated for ${context}`);
    return null;
  }
  console.warn(`[Favorites] Error in ${context}:`, error?.message || error);
  return null;
}

export const favoritesService = {
  /**
   * List all favorites for the current user.
   * Returns empty array for unauthenticated users.
   */
  async list(type?: string): Promise<Favorite[]> {
    // Check auth first to avoid unnecessary 401 calls
    if (!(await isAuthenticated())) {
      console.log("[Favorites] User not authenticated, returning empty list");
      return [];
    }

    try {
      const q = type ? `?type=${type}` : "";
      const res = await apiService.get<{ favorites: Favorite[] }>(
        `/favorites${q}`,
      );
      return res.favorites || [];
    } catch (error: any) {
      handleAuthError(error, "list");
      return [];
    }
  },

  /**
   * Add an item to favorites.
   * Returns null for unauthenticated users.
   */
  async add(
    itemName: string,
    itemType: "destination" | "place" = "destination",
    notes?: string,
  ): Promise<Favorite | null> {
    if (!(await isAuthenticated())) {
      console.log("[Favorites] Cannot add favorite - user not authenticated");
      return null;
    }

    try {
      const res = await apiService.post<{ favorite: Favorite }>("/favorites", {
        item_name: itemName,
        item_type: itemType,
        notes: notes || undefined,
      });
      return res.favorite;
    } catch (error: any) {
      return handleAuthError(error, "add");
    }
  },

  /**
   * Remove a favorite.
   * Returns false for unauthenticated users.
   */
  async remove(favId: number): Promise<boolean> {
    if (!(await isAuthenticated())) {
      console.log(
        "[Favorites] Cannot remove favorite - user not authenticated",
      );
      return false;
    }

    try {
      await apiService.delete(`/favorites/${favId}`);
      return true;
    } catch (error: any) {
      handleAuthError(error, "remove");
      return false;
    }
  },

  /**
   * Toggle favorite status.
   * Returns the new favorite state or null if operation failed.
   */
  async toggle(
    itemName: string,
    itemType: "destination" | "place" = "destination",
  ): Promise<{ isFavorite: boolean; favorite: Favorite | null }> {
    if (!(await isAuthenticated())) {
      console.log(
        "[Favorites] Cannot toggle favorite - user not authenticated",
      );
      return { isFavorite: false, favorite: null };
    }

    try {
      // First check current state
      const checkResult = await this.check(itemName, itemType);

      if (checkResult.is_favorite && checkResult.favorite) {
        // Remove from favorites
        const removed = await this.remove(checkResult.favorite.id);
        return { isFavorite: false, favorite: null };
      } else {
        // Add to favorites
        const favorite = await this.add(itemName, itemType);
        return { isFavorite: !!favorite, favorite };
      }
    } catch (error: any) {
      handleAuthError(error, "toggle");
      return { isFavorite: false, favorite: null };
    }
  },

  /**
   * Check if an item is favorited.
   * Returns default result for unauthenticated users.
   */
  async check(
    itemName: string,
    itemType: string = "destination",
  ): Promise<FavoriteCheckResult> {
    if (!(await isAuthenticated())) {
      return { is_favorite: false, favorite: null };
    }

    const params = new URLSearchParams({
      item_name: itemName,
      item_type: itemType,
    });
    try {
      return await apiService.get<FavoriteCheckResult>(
        `/favorites/check?${params}`,
      );
    } catch (error: any) {
      handleAuthError(error, "check");
      return { is_favorite: false, favorite: null };
    }
  },
};

export default favoritesService;
