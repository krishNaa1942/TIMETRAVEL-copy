/**
 * Profile Feature Helpers
 * Constants, validators, and computed utilities for the Profile module
 */

import type {
  TravelDNA,
  TravelTrait,
  PersonalityConfig,
  PersonalityConfigMap,
  UserLevel,
  AIInsight,
  SmartAction,
  QuickAction,
  ProfileValidationErrors,
  UserProfile,
  PreferenceSettings,
} from "../types";

// ─────────────────────────────────────────────────────────────
// PERSONALITY CONFIGURATION
// ─────────────────────────────────────────────────────────────

export const PERSONALITY_CONFIG: PersonalityConfigMap = {
  explorer: {
    icon: "🌍",
    color: "#3B82F6",
    label: "Globe Trekker",
    description: "You seek new horizons and hidden gems!",
  },
  foodie: {
    icon: "🍽️",
    color: "#F59E0B",
    label: "Culinary Voyager",
    description: "You travel for tastes and culinary experiences!",
  },
  luxury: {
    icon: "💎",
    color: "#8B5CF6",
    label: "Luxury Connoisseur",
    description: "You appreciate the finer things!",
  },
  adventure: {
    icon: "🏔️",
    color: "#EF4444",
    label: "Thrill Seeker",
    description: "Adrenaline is your fuel!",
  },
  culture: {
    icon: "🏛️",
    color: "#EC4899",
    label: "Culture Enthusiast",
    description: "History and art captivate you!",
  },
  relaxation: {
    icon: "🧘",
    color: "#10B981",
    label: "Zen Wanderer",
    description: "Peace and tranquility guide you!",
  },
  budget: {
    icon: "💡",
    color: "#06B6D4",
    label: "Smart Traveler",
    description: "You maximize value!",
  },
  social: {
    icon: "🦋",
    color: "#F97316",
    label: "Social Butterfly",
    description: "Travel is better together!",
  },
};

// ─────────────────────────────────────────────────────────────
// LEVEL TITLES & XP CONFIGURATION
// ─────────────────────────────────────────────────────────────

export const LEVEL_TITLES: string[] = [
  "Newcomer",
  "Wanderer",
  "Explorer",
  "Adventurer",
  "Globe Trotter",
  "Jet Setter",
  "World Citizen",
  "Travel Master",
  "Globe Master",
  "Legendary Voyager",
];

export const XP_VALUES: Record<string, number> = {
  click: 1,
  view: 2,
  search: 3,
  save: 5,
  share: 10,
  rating: 8,
  book: 50,
};

export const calculateXPForLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

// ─────────────────────────────────────────────────────────────
// VALIDATORS
// ─────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_NAME_LENGTH = 100;

export const validateProfileInput = (
  name: string,
  email: string,
): ProfileValidationErrors => {
  const errors: ProfileValidationErrors = {};

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedName) {
    errors.name = "Name cannot be empty.";
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.name = "Name is too long.";
  }

  if (!trimmedEmail) {
    errors.email = "Email cannot be empty.";
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = "Please enter a valid email address.";
  }

  return errors;
};

export const isValidEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
};

export const isValidName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;
};

// ─────────────────────────────────────────────────────────────
// TRAVEL DNA COMPUTATIONS
// ─────────────────────────────────────────────────────────────

export const createDefaultTravelDNA = (): TravelDNA => ({
  explorer: 0,
  foodie: 0,
  luxury: 0,
  adventure: 0,
  culture: 0,
  relaxation: 0,
  budget: 0,
  social: 0,
});

export const computeTravelDNA = (
  viewedDestinations: string[],
  savedDestinations: string[],
  categoryPreferences: Array<{
    category: string;
    score: number;
    interactions: number;
  }>,
): TravelDNA => {
  const dna = createDefaultTravelDNA();
  const signalStrength =
    viewedDestinations.length +
    savedDestinations.length +
    categoryPreferences.length;

  // Base calculations from destination interactions
  dna.explorer = Math.min(100, viewedDestinations.length * 5);
  dna.social = Math.min(100, savedDestinations.length * 3);

  // Calculate from category preferences
  const categoryMap: Record<string, keyof TravelDNA> = {
    restaurant: "foodie",
    food: "foodie",
    museum: "culture",
    historical: "culture",
    culture: "culture",
    adventure: "adventure",
    outdoor: "adventure",
    beach: "relaxation",
    spa: "relaxation",
    resort: "luxury",
    hotel: "luxury",
    budget: "budget",
    hostel: "budget",
  };

  categoryPreferences.forEach((pref) => {
    const trait = categoryMap[pref.category.toLowerCase()];
    if (trait) {
      dna[trait] = Math.min(100, dna[trait] + Math.floor(pref.score / 2));
    }
  });

  // Deterministic fallback values derived from available signals.
  if (dna.foodie === 0) dna.foodie = Math.min(100, 25 + signalStrength * 2);
  if (dna.adventure === 0)
    dna.adventure = Math.min(
      100,
      22 + viewedDestinations.length * 3 + categoryPreferences.length * 2,
    );
  if (dna.culture === 0)
    dna.culture = Math.min(
      100,
      28 + savedDestinations.length * 2 + categoryPreferences.length * 2,
    );
  if (dna.relaxation === 0)
    dna.relaxation = Math.min(100, 20 + savedDestinations.length * 4);
  if (dna.luxury === 0) dna.luxury = Math.min(100, 18 + signalStrength * 2);
  if (dna.budget === 0)
    dna.budget = Math.min(
      100,
      30 + savedDestinations.length * 2 + categoryPreferences.length,
    );

  return dna;
};

export const getDominantPersonality = (dna: TravelDNA): PersonalityConfig => {
  const maxTrait = Object.entries(dna).reduce((a, b) => (a[1] > b[1] ? a : b));
  const trait = maxTrait[0] as TravelTrait;
  return PERSONALITY_CONFIG[trait] || PERSONALITY_CONFIG.explorer;
};

export const getDominantTrait = (dna: TravelDNA): TravelTrait => {
  const maxTrait = Object.entries(dna).reduce((a, b) => (a[1] > b[1] ? a : b));
  return maxTrait[0] as TravelTrait;
};

// ─────────────────────────────────────────────────────────────
// USER LEVEL COMPUTATIONS
// ─────────────────────────────────────────────────────────────

export const createUserLevel = (
  level: number,
  xp: number,
  xpToNext: number,
): UserLevel => {
  const progress = Math.min(100, (xp / xpToNext) * 100);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

  return {
    level,
    xp,
    xpToNext,
    title,
    progress,
  };
};

export const computeLevelFromXP = (totalXP: number): UserLevel => {
  let level = 1;
  let remainingXP = totalXP;
  let xpForCurrentLevel = 100;

  while (remainingXP >= xpForCurrentLevel && level < 100) {
    remainingXP -= xpForCurrentLevel;
    level++;
    xpForCurrentLevel = calculateXPForLevel(level);
  }

  return createUserLevel(level, remainingXP, xpForCurrentLevel);
};

// ─────────────────────────────────────────────────────────────
// INSIGHTS GENERATION
// ─────────────────────────────────────────────────────────────

export const generateAIInsights = (
  tripCount: number,
  completedTrips: number,
  streakCurrent: number,
  favoritesCount: number,
  level: number,
  levelTitle: string,
  viewedDestinations: number,
): AIInsight[] => {
  const insights: AIInsight[] = [];

  // Achievement insights
  if (completedTrips > 0) {
    insights.push({
      id: "insight-trips",
      type: "achievement",
      icon: "🎉",
      message: `You've completed ${completedTrips} amazing trip${completedTrips > 1 ? "s" : ""}!`,
      actionable: false,
    });
  }

  if (streakCurrent >= 3) {
    insights.push({
      id: "insight-streak",
      type: "achievement",
      icon: "🔥",
      message: `${streakCurrent} day planning streak! Keep it up!`,
      actionable: false,
    });
  }

  if (level >= 5) {
    insights.push({
      id: "insight-level",
      type: "achievement",
      icon: "⭐",
      message: `Level ${level} ${levelTitle} - you're a travel pro!`,
      actionable: false,
    });
  }

  // Suggestion insights
  if (favoritesCount >= 5) {
    insights.push({
      id: "insight-favorites",
      type: "suggestion",
      icon: "💡",
      message: `${favoritesCount} destinations saved - time to book your next adventure!`,
      actionable: true,
      actionLabel: "View Saved",
      actionRoute: "Favorites",
    });
  }

  if (viewedDestinations >= 10 && tripCount === 0) {
    insights.push({
      id: "insight-explore",
      type: "suggestion",
      icon: "✈️",
      message: `You've explored ${viewedDestinations} places! Ready to plan your first trip?`,
      actionable: true,
      actionLabel: "Plan Trip",
      actionRoute: "TripWorkspace",
    });
  }

  // Trend insights
  if (tripCount > 3) {
    insights.push({
      id: "insight-trend",
      type: "trend",
      icon: "📊",
      message:
        "Your travel activity is trending upward! Keep the momentum going.",
      actionable: false,
    });
  }

  return insights;
};

// ─────────────────────────────────────────────────────────────
// SMART ACTIONS GENERATION
// ─────────────────────────────────────────────────────────────

export const generateSmartActions = (
  activeTrips: number,
  savedDestinations: number,
  hasLocation: boolean,
): SmartAction[] => {
  const actions: SmartAction[] = [];

  // Resume planning action (highest priority if active trips)
  if (activeTrips > 0) {
    actions.push({
      id: "action-resume",
      icon: "🗺️",
      title: "Resume Planning",
      subtitle: "Continue your trip",
      color: "#3B82F6",
      route: "TripWorkspace",
      priority: 1,
      visible: true,
    });
  }

  // Discover new places
  actions.push({
    id: "action-discover",
    icon: "✨",
    title: "Discover New Places",
    subtitle: "Server-ranked recommendations for you",
    color: "#8B5CF6",
    route: "Places",
    priority: 2,
    visible: true,
  });

  // Explore nearby
  if (hasLocation) {
    actions.push({
      id: "action-nearby",
      icon: "📍",
      title: "Explore Nearby",
      subtitle: "Find places around you",
      color: "#10B981",
      route: "Places",
      priority: 3,
      visible: true,
    });
  }

  // Budget planning
  actions.push({
    id: "action-budget",
    icon: "💰",
    title: "Plan Budget",
    subtitle: "Track your travel spending",
    color: "#F59E0B",
    route: "Budget",
    priority: 4,
    visible: true,
  });

  return actions
    .filter((a) => a.visible)
    .sort((a, b) => a.priority - b.priority);
};

// ─────────────────────────────────────────────────────────────
// QUICK ACTIONS GENERATION
// ─────────────────────────────────────────────────────────────

export const generateQuickActions = (
  tripCount: number,
  favoritesCount: number,
  placesVisited: number,
): QuickAction[] => [
  {
    id: "quick-trips",
    icon: "🧳",
    label: "My Trips",
    count: tripCount,
    route: "TripWorkspace",
  },
  {
    id: "quick-saved",
    icon: "❤️",
    label: "Saved",
    count: favoritesCount,
    route: "Favorites",
  },
  {
    id: "quick-stats",
    icon: "📊",
    label: "Stats",
    count: placesVisited,
    route: "TravelStats",
  },
  {
    id: "quick-settings",
    icon: "⚙️",
    label: "Settings",
    count: null,
    route: "RoutePlanner",
  },
];

// ─────────────────────────────────────────────────────────────
// DEFAULT VALUES
// ─────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: PreferenceSettings = {
  darkMode: false,
  tripAlerts: true,
  priceAlerts: false,
  pushNotifications: true,
};

export const DEFAULT_USER_LEVEL: UserLevel = {
  level: 1,
  xp: 0,
  xpToNext: 100,
  title: LEVEL_TITLES[0],
  progress: 0,
};

// ─────────────────────────────────────────────────────────────
// FORMATTING UTILITIES
// ─────────────────────────────────────────────────────────────

export const formatTripCount = (count: number): string => {
  if (count === 0) return "No trips";
  if (count === 1) return "1 trip";
  return `${count} trips`;
};

export const formatCurrency = (amount: number, currency = "USD"): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const getAvatarSource = (user: UserProfile | null): string | null => {
  return user?.avatar_url || user?.avatar || null;
};
