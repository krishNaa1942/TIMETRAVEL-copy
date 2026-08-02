/**
 * Explore Feature — Search Intent & Destination Scoring
 *
 * NOTE: This is the regex-based fallback engine. Wave 2 will add
 * a semantic search path via backend embeddings. This module stays
 * as the offline/instant fallback.
 */

import { Destination } from "@/types";
import { CURRENT_SEASON } from "../constants/categories";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface SearchIntent {
  type: "destination" | "activity" | "vibe" | "season" | "budget" | "unknown";
  confidence: number;
  entities: string[];
}

export interface FilterState {
  budget: "all" | "budget" | "mid" | "luxury";
  duration: "all" | "weekend" | "week" | "extended";
  vibe:
    | "all"
    | "adventure"
    | "relaxation"
    | "cultural"
    | "romantic"
    | "family"
    | "spiritual";
  season: "all" | "summer" | "winter" | "monsoon" | "spring";
}

export interface AIInsight {
  id: string;
  type:
    | "recommendation"
    | "trending"
    | "seasonal"
    | "personalized"
    | "hidden_gems"
    | "weekend";
  title: string;
  subtitle: string;
  destinations: Destination[];
  reason?: string;
  cta?: string;
}

// ─────────────────────────────────────────────────────────────
// SEARCH INTENT ANALYSIS
// ─────────────────────────────────────────────────────────────

export const analyzeSearchIntent = (query: string): SearchIntent => {
  const q = query.toLowerCase().trim();

  // Activity-based intent
  if (/\b(swim|surf|beach|sunbathe|scuba|snorkel)\b/.test(q)) {
    return { type: "activity", confidence: 0.9, entities: ["beach", "water"] };
  }
  if (/\b(trek|hike|climb|camp|adventure)\b/.test(q)) {
    return {
      type: "activity",
      confidence: 0.9,
      entities: ["mountain", "adventure"],
    };
  }
  if (/\b(temple|spiritual|meditation|yoga|peace)\b/.test(q)) {
    return {
      type: "vibe",
      confidence: 0.85,
      entities: ["spiritual", "peaceful"],
    };
  }

  // Budget intent
  if (/\b(cheap|budget|affordable|low cost)\b/.test(q)) {
    return { type: "budget", confidence: 0.8, entities: ["budget"] };
  }
  if (/\b(luxury|premium|expensive|high-end)\b/.test(q)) {
    return { type: "budget", confidence: 0.8, entities: ["luxury"] };
  }

  // Season intent
  if (/\b(summer|hot|sunny)\b/.test(q)) {
    return { type: "season", confidence: 0.75, entities: ["summer"] };
  }
  if (/\b(winter|snow|cold)\b/.test(q)) {
    return { type: "season", confidence: 0.75, entities: ["winter"] };
  }
  if (/\b(monsoon|rain|romantic)\b/.test(q)) {
    return { type: "season", confidence: 0.75, entities: ["monsoon"] };
  }

  // Vibe intent
  if (/\b(romantic|honeymoon|couple)\b/.test(q)) {
    return { type: "vibe", confidence: 0.85, entities: ["romantic", "couple"] };
  }
  if (/\b(family|kids|children)\b/.test(q)) {
    return { type: "vibe", confidence: 0.85, entities: ["family", "kids"] };
  }
  if (/\b(solo|alone|backpack)\b/.test(q)) {
    return { type: "vibe", confidence: 0.8, entities: ["solo", "adventure"] };
  }

  return { type: "destination", confidence: 0.6, entities: [q] };
};

// ─────────────────────────────────────────────────────────────
// DESTINATION SCORING
// ─────────────────────────────────────────────────────────────

export const calculateDestinationScore = (
  dest: Destination,
  filters: FilterState,
  searchIntent?: SearchIntent,
): number => {
  let score = 50; // Base score

  // Season bonus
  const destStr =
    `${dest.label} ${dest.region} ${dest.tagline || ""}`.toLowerCase();

  if (CURRENT_SEASON === "summer" && /beach|coast|goa|andaman/.test(destStr)) {
    score += 20;
  } else if (
    CURRENT_SEASON === "winter" &&
    /mountain|hill|snow|manali|shimla/.test(destStr)
  ) {
    score += 20;
  } else if (
    CURRENT_SEASON === "monsoon" &&
    /hill|green|kerala|coorg/.test(destStr)
  ) {
    score += 15;
  }

  // Filter matching
  if (
    filters.vibe === "adventure" &&
    /trek|hike|adventure|mountain/.test(destStr)
  ) {
    score += 25;
  } else if (
    filters.vibe === "relaxation" &&
    /beach|resort|spa|backwater/.test(destStr)
  ) {
    score += 25;
  } else if (
    filters.vibe === "spiritual" &&
    /temple|spiritual|varanasi|rishikesh/.test(destStr)
  ) {
    score += 25;
  }

  // Search intent matching
  if (searchIntent?.entities) {
    for (const entity of searchIntent.entities) {
      if (destStr.includes(entity)) {
        score += 30 * searchIntent.confidence;
      }
    }
  }

  return Math.min(score, 100);
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

export const formatCount = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
};

/** Match a destination string against a category */
export const matchesCategory = (
  destStr: string,
  category: string,
): boolean => {
  switch (category) {
    case "beach":
      return /beach|goa|andaman|coast/.test(destStr);
    case "mountain":
      return /mountain|hill|manali|shimla|leh/.test(destStr);
    case "city":
      return /mumbai|delhi|bangalore|city/.test(destStr);
    case "spiritual":
      return /varanasi|rishikesh|temple|spiritual/.test(destStr);
    case "adventure":
      return /trek|adventure|hiking|camp/.test(destStr);
    default:
      return true;
  }
};

/** Match a destination string against a season */
export const matchesSeason = (destStr: string, season: string): boolean => {
  switch (season) {
    case "summer":
      return /beach|hill|coast|manali/.test(destStr);
    case "winter":
      return /goa|kerala|rajasthan|desert/.test(destStr);
    case "monsoon":
      return /hill|kerala|coorg|lonavala/.test(destStr);
    default:
      return true;
  }
};
