/**
 * Packing Checklist Service
 * Generate, toggle, add custom, delete items
 */

import apiService from "./api";

export interface PackingItem {
  id: number;
  destination: string;
  item_text: string;
  is_checked: boolean;
  is_custom: boolean;
}

export const packingService = {
  async generate(destination: string): Promise<{ items: PackingItem[]; weather_available: boolean }> {
    return apiService.post("/packing/generate", { destination });
  },

  async getChecklist(destination?: string): Promise<{ items: PackingItem[]; total: number; checked: number; progress: number }> {
    const q = destination ? `?destination=${encodeURIComponent(destination)}` : "";
    return apiService.get(`/packing${q}`);
  },

  async toggleItem(itemId: number): Promise<{ item: PackingItem }> {
    return apiService.put(`/packing/${itemId}/toggle`, {});
  },

  async addCustom(destination: string, itemText: string): Promise<{ item: PackingItem }> {
    return apiService.post("/packing/custom", { destination, item_text: itemText });
  },

  async deleteItem(itemId: number): Promise<void> {
    return apiService.delete(`/packing/${itemId}`);
  },
};

export default packingService;
