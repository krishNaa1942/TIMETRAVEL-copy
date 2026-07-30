/**
 * Explore Feature — Responsive Layout Utilities
 */

import { spacing } from "@/theme/colors";

/** Compute responsive column count based on window width */
export const getColumnCount = (width: number): number => {
  if (width >= 1200) return 4; // Desktop web
  if (width >= 768) return 3; // Tablet / iPad
  return 2; // Phone
};

/** Compute card width from screen width and column count */
export const getCardWidth = (screenWidth: number, cols: number): number => {
  const totalHorizontalPadding = spacing.lg * 2;
  const totalGaps = spacing.md * (cols - 1);
  return (screenWidth - totalHorizontalPadding - totalGaps) / cols;
};
