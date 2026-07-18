/**
 * News Service
 * Backend: /api/news
 */
import apiService from "./api";

export interface NewsArticle {
  title: string;
  description?: string;
  url: string;
  image_url?: string;
  source?: string;
  published_at?: string;
}

export const newsService = {
  async getTravelNews(destination?: string, category?: string, limit?: number): Promise<{ articles: NewsArticle[]; count: number }> {
    const params = new URLSearchParams();
    if (destination) params.append("destination", destination);
    if (category) params.append("category", category);
    if (limit) params.append("limit", String(limit));
    return apiService.get(`/news/travel?${params}`);
  },

  async getTrending(limit?: number): Promise<{ articles: NewsArticle[] }> {
    return apiService.get(`/news/trending?limit=${limit || 10}`);
  },

  async getSafetyNews(destination?: string): Promise<{ articles: NewsArticle[] }> {
    const q = destination ? `?destination=${encodeURIComponent(destination)}` : "";
    return apiService.get(`/news/safety${q}`);
  },

  async getStatus(): Promise<{ available: boolean }> {
    return apiService.get("/news/status");
  },
};

export default newsService;
