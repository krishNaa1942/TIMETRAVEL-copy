import { useWindowDimensions, ScaledSize } from "react-native";
import { useMemo } from "react";

export const BREAKPOINTS = {
  PHONE: 0,
  TABLET_SMALL: 768,
  TABLET_LARGE: 1024,
  DESKTOP: 1280,
} as const;

export interface ResponsiveInfo {
  width: number;
  height: number;
  isTablet: boolean;
  isPhone: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  numColumns: number;
  contentMaxWidth: number;
  columnWidth: (gap: number, padding: number) => number;
  breakpoint: "phone" | "tablet-small" | "tablet-large" | "desktop";
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const isLandscape = width > height;
    const isPortrait = width <= height;
    const breakpoint =
      width >= BREAKPOINTS.DESKTOP ? "desktop"
      : width >= BREAKPOINTS.TABLET_LARGE ? "tablet-large"
      : width >= BREAKPOINTS.TABLET_SMALL ? "tablet-small"
      : "phone";
    const isTablet = breakpoint !== "phone";
    const isPhone = !isTablet;
    const numColumns = isTablet ? (width >= 1024 ? 3 : 2) : 1;
    const contentMaxWidth = isTablet ? 960 : width;

    const columnWidth = (gap: number, padding: number) =>
      (width - padding * 2 - gap * (numColumns - 1)) / numColumns;

    return {
      width,
      height,
      isTablet,
      isPhone,
      isLandscape,
      isPortrait,
      numColumns,
      contentMaxWidth,
      columnWidth,
      breakpoint,
    };
  }, [width, height]);
}
