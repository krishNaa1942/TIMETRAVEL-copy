/**
 * TimeTravelMobile - Core Theme Configuration
 * Defines colors, spacing, and typography for the entire app
 */

import { MD3LightTheme, MD3DarkTheme } from "react-native-paper";

// ─────────────────────────────────────────────────────────────
// COLOR PALETTE
// ─────────────────────────────────────────────────────────────
export const colors = {
  // Primary & Secondary
  primary: "#2563EB", // Blue (main brand color)
  primaryDark: "#1D4ED8", // Darker blue for gradients
  secondary: "#EC4899", // Pink (accent)
  accent: "#F59E0B", // Amber (highlights)

  // Neutral
  background: "#FFFFFF", // Light mode background
  surface: "#F9FAFB", // Light mode surface
  text: "#1F2937", // Dark text
  textSecondary: "#6B7280", // Secondary text
  textTertiary: "#9CA3AF", // Tertiary/muted text
  gray: "#9CA3AF", // Gray text/disabled

  // Status Colors
  error: "#DC2626", // Red
  success: "#16A34A", // Green
  warning: "#EA580C", // Orange
  info: "#0EA5E9", // Cyan

  // Dark Mode
  darkBackground: "#0F172A",
  darkSurface: "#1E293B",
  darkText: "#F1F5F9",

  // Borders
  border: "#E5E7EB",
};

// ─────────────────────────────────────────────────────────────
// SPACING SCALE
// ─────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4, // Extra small
  sm: 8, // Small
  md: 16, // Medium (default)
  lg: 24, // Large
  xl: 32, // Extra large
  xxl: 48, // 2X Large
};

// ─────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────
export const typography = {
  displayLarge: {
    fontSize: 57,
    fontWeight: "400",
    lineHeight: 64,
  },
  displayMedium: {
    fontSize: 45,
    fontWeight: "400",
    lineHeight: 52,
  },
  displaySmall: {
    fontSize: 36,
    fontWeight: "400",
    lineHeight: 44,
  },
  headlineLarge: {
    fontSize: 32,
    fontWeight: "400",
    lineHeight: 40,
  },
  headlineMedium: {
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 36,
  },
  headlineSmall: {
    fontSize: 24,
    fontWeight: "400",
    lineHeight: 32,
  },
  titleLarge: {
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 28,
  },
  titleMedium: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
  titleSmall: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
  },
};

// ─────────────────────────────────────────────────────────────
// LIGHT THEME (Paper)
// ─────────────────────────────────────────────────────────────
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    error: colors.error,
    success: colors.success,
    warning: colors.warning,
  },
};

// ─────────────────────────────────────────────────────────────
// DARK THEME (Paper)
// ─────────────────────────────────────────────────────────────
export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    background: colors.darkBackground,
    surface: colors.darkSurface,
    text: colors.darkText,
    error: colors.error,
    success: colors.success,
    warning: colors.warning,
  },
};

export default {
  colors,
  spacing,
  typography,
  lightTheme,
  darkTheme,
};
