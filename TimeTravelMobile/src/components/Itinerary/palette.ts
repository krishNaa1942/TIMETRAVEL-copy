/**
 * Itinerary palette — light/dark color tokens for the itinerary feature.
 */

export interface ItineraryPalette {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  success: string;
  successBg: string;
  danger: string;
  track: string;
  headerBg: string;
  inputText: string;
  markerBorder: string;
}

const LIGHT: ItineraryPalette = {
  isDark: false,
  background: "#E2E8F0",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#F1F5F9",
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  accent: "#0f766e",
  accentText: "#0f766e",
  success: "#16A34A",
  successBg: "#DCFCE7",
  danger: "#B91C1C",
  track: "#E2E8F0",
  headerBg: "rgba(255,255,255,0.95)",
  inputText: "#0F172A",
  markerBorder: "#FFFFFF",
};

const DARK: ItineraryPalette = {
  isDark: true,
  background: "#0F172A",
  surface: "#1E293B",
  surfaceAlt: "#0F172A",
  border: "#334155",
  text: "#F1F5F9",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  accent: "#14B8A6",
  accentText: "#5EEAD4",
  success: "#4ADE80",
  successBg: "rgba(74,222,128,0.15)",
  danger: "#F87171",
  track: "#334155",
  headerBg: "rgba(15,23,42,0.95)",
  inputText: "#F1F5F9",
  markerBorder: "#0F172A",
};

export function buildItineraryPalette(isDark: boolean): ItineraryPalette {
  return isDark ? DARK : LIGHT;
}
