/**
 * UI Store (Zustand)
 * Manages theme and UI preferences
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UIStore {
  themeDark: boolean;
  toggleTheme: () => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useUIStore = create<UIStore>((set, get) => ({
  themeDark: false,

  toggleTheme: async () => {
    const next = !get().themeDark;
    set({ themeDark: next });
    try {
      await AsyncStorage.setItem("themeDark", JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to persist theme:", e);
    }
  },

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem("themeDark");
      if (stored !== null) {
        set({ themeDark: JSON.parse(stored) });
      }
    } catch (e) {
      console.warn("Failed to load theme:", e);
    }
  },
}));

export default useUIStore;
