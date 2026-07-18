import { colors } from "@/theme/colors";

import type {
  ComparisonCategory,
  ComparisonDataSource,
  ComparisonTone,
} from "../types";

export interface ComparePalette {
  background: readonly [string, string, string];
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

const DESTINATION_COLORS = [
  "#2563EB",
  "#10B981",
  "#F97316",
  "#8B5CF6",
  "#EC4899",
] as const;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const formatCurrency = (
  value: number | null | undefined,
  currency = "INR",
): string => {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatScore = (
  value: number | null | undefined,
  max = 100,
): string => {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${Math.round(value)}/${max}`;
};

export const formatPercent = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${Math.round(value)}%`;
};

export const formatTemperature = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${Math.round(value)}°C`;
};

export const formatConfidence = (value: number): string =>
  `${Math.round(clamp(value, 0, 1) * 100)}% confidence`;

export const formatCompactNumber = (
  value: number | null | undefined,
): string => {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

export const formatTravelClass = (value: string): string =>
  value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatPriority = (value: string): string => {
  switch (value) {
    case "budget":
      return "Budget first";
    case "safety":
      return "Safety first";
    case "weather":
      return "Weather first";
    case "crowd":
      return "Low crowd";
    case "experience":
      return "Experience first";
    default:
      return "Balanced";
  }
};

export const formatDataSource = (
  source: ComparisonDataSource | null,
): string => {
  switch (source) {
    case "live":
      return "Live analysis";
    case "cache":
      return "Cached analysis";
    case "mock":
      return "Fallback analysis";
    default:
      return "Preparing analysis";
  }
};

export const formatDelta = (value: number, suffix = ""): string => {
  const rounded = Math.round(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${rounded}${suffix}`;
};

export const formatSignedPercent = (value: number): string =>
  `${value >= 0 ? "+" : "-"}${Math.round(Math.abs(value))}%`;

export const buildComparePalette = (isDark: boolean): ComparePalette =>
  isDark
    ? {
        background: ["#020617", "#0F172A", "#111827"],
        surface: "#0F172A",
        surfaceElevated: "rgba(15, 23, 42, 0.92)",
        border: "rgba(148, 163, 184, 0.18)",
        text: "#F8FAFC",
        muted: "#94A3B8",
        accent: "#60A5FA",
        accentSoft: "rgba(96, 165, 250, 0.16)",
        success: colors.success,
        warning: colors.warning,
        danger: "#F87171",
        info: colors.info,
      }
    : {
        background: ["#F8FAFC", "#EFF6FF", "#E0F2FE"],
        surface: "#FFFFFF",
        surfaceElevated: "rgba(255, 255, 255, 0.92)",
        border: "rgba(15, 23, 42, 0.08)",
        text: "#0F172A",
        muted: "#64748B",
        accent: colors.primary,
        accentSoft: "rgba(37, 99, 235, 0.12)",
        success: colors.success,
        warning: colors.warning,
        danger: colors.error,
        info: colors.info,
      };

export const getDestinationColor = (index: number): string =>
  DESTINATION_COLORS[index % DESTINATION_COLORS.length];

export const getToneColor = (
  tone: ComparisonTone,
  palette: ComparePalette,
): string => {
  switch (tone) {
    case "success":
      return palette.success;
    case "warning":
      return palette.warning;
    case "danger":
      return palette.danger;
    case "info":
    default:
      return palette.info;
  }
};

export const getCategoryLabel = (category: ComparisonCategory): string => {
  switch (category) {
    case "cost":
      return "Cost";
    case "comfort":
      return "Comfort";
    case "risk":
      return "Risk";
    case "experience":
    default:
      return "Experience";
  }
};

export const formatRelativeTimeLabel = (timestamp?: number | null): string => {
  if (!timestamp) {
    return "Updated just now";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Updated just now";
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays}d ago`;
};
