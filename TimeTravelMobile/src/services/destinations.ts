/**
 * Destinations Service
 * Handles destination listing and image fetching
 */

import apiService from "./api";
import { Destination, UnsplashImage } from "@/types";

export const destinationsService = {
  /** Fetch all supported destinations */
  async getDestinations(): Promise<Destination[]> {
    const response = await apiService.get<{ destinations: Destination[] }>(
      "/destinations"
    );
    return response.destinations;
  },

  /** Fetch images for a single destination */
  async getDestinationImages(name: string): Promise<UnsplashImage[]> {
    const response = await apiService.get<{
      images: UnsplashImage[];
      count: number;
      destination: string;
    }>(`/images/destination/${encodeURIComponent(name)}`);
    return response.images;
  },

  /** Fetch a single hero/banner image */
  async getHeroImage(name: string): Promise<UnsplashImage | null> {
    try {
      const images = await this.getDestinationImages(name);
      return images.length > 0 ? images[0] : null;
    } catch {
      return null;
    }
  },

  /**
   * Fetch one image per destination for gallery cards.
   * API returns { images: { "agra": { url_thumb, ... }, "goa": { ... } } }
   * We convert to Record<id, UnsplashImage> for easy lookup.
   */
  async getAllDestinationImages(): Promise<Record<string, UnsplashImage>> {
    const response = await apiService.get<{
      images: Record<string, UnsplashImage>;
    }>("/images/destinations");
    return response.images;
  },
};

export default destinationsService;
