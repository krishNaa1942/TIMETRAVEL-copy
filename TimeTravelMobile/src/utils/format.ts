/**
 * Canonical string/number formatters (single source of truth).
 * Locale is en-IN; currency helpers accept an explicit code.
 */

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-IN").format(value);

export const formatCurrency = (
  value: number | null | undefined,
  currency = "INR",
): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatPercent = (value: number): string => `${Math.round(value)}%`;

export const formatCompactNumber = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};