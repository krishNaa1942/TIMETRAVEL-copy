/**
 * Explore Feature — Constants
 * Category configurations and seasonal logic
 */

import { colors } from "@/theme/colors";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface CategoryConfig {
  id: string;
  label: string;
  icon: string;
  color: string;
  gradient: string[];
}

// ─────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────

export const CATEGORIES: CategoryConfig[] = [
  {
    id: "all",
    label: "For You",
    icon: "star-four-points",
    color: "#8B5CF6",
    gradient: ["#8B5CF6", "#6366F1"],
  },
  {
    id: "beach",
    label: "Beaches",
    icon: "beach",
    color: "#0EA5E9",
    gradient: ["#0EA5E9", "#06B6D4"],
  },
  {
    id: "mountain",
    label: "Mountains",
    icon: "image-filter-hdr",
    color: "#10B981",
    gradient: ["#10B981", "#059669"],
  },
  {
    id: "city",
    label: "Cities",
    icon: "city-variant",
    color: "#F59E0B",
    gradient: ["#F59E0B", "#D97706"],
  },
  {
    id: "spiritual",
    label: "Spiritual",
    icon: "temple-buddhist",
    color: "#EC4899",
    gradient: ["#EC4899", "#DB2777"],
  },
  {
    id: "adventure",
    label: "Adventure",
    icon: "hiking",
    color: "#EF4444",
    gradient: ["#EF4444", "#DC2626"],
  },
];

// ─────────────────────────────────────────────────────────────
// SEASONAL DETECTION
// ─────────────────────────────────────────────────────────────

export const CURRENT_SEASON = (() => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 5) return "summer";
  if (month >= 6 && month <= 9) return "monsoon";
  if (month >= 10 || month <= 1) return "winter";
  return "spring";
})();
