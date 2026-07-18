export const travelIntelligenceLogger = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log("[TravelIntelligence]", ...args);
  }
};

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-IN").format(value);

export const formatCurrency = (value: number, currency = "INR"): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export const formatPercent = (value: number): string => `${Math.round(value)}%`;

export const formatShortDate = (value?: string | null): string => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
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

export const getTimeOfDayGreeting = (): string => {
  const hour = new Date().getHours();

  if (hour < 5) return "Late Night Explorer";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Night Owl";
};

export const getSeasonTheme = (): {
  label: string;
  accent: string;
  background: readonly [string, string, string];
} => {
  const month = new Date().getMonth();

  if (month >= 2 && month <= 5) {
    return {
      label: "Summer",
      accent: "#F59E0B",
      background: ["#1D2B64", "#2A5298", "#3A7BD5"] as const,
    };
  }

  if (month >= 6 && month <= 9) {
    return {
      label: "Monsoon",
      accent: "#0EA5E9",
      background: ["#0F2027", "#203A43", "#2C5364"] as const,
    };
  }

  if (month >= 10 || month <= 1) {
    return {
      label: "Winter",
      accent: "#8B5CF6",
      background: ["#090979", "#1A1A2E", "#16213E"] as const,
    };
  }

  return {
    label: "Spring",
    accent: "#10B981",
    background: ["#134E5E", "#1F8A70", "#A8E063"] as const,
  };
};
