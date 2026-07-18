/**
 * AI Travel Intelligence Engine
 * Core engine for generating intelligent insights, predictions, and personalization
 */

import {
  TravelDNA,
  TravelPersonality,
  AIInsight,
  TravelPrediction,
  FinancialHealth,
  SpendingCategory,
  UserLevel,
  TravelStreak,
  Badge,
  Achievement,
  TravelStory,
  EnhancedTravelStats,
  BudgetPrediction,
} from "@/types/travelIntelligence";
import { TravelStats } from "@/services/stats";

// ─────────────────────────────────────────────────────────────
// PERSONALITY PROFILES
// ─────────────────────────────────────────────────────────────

const PERSONALITY_PROFILES: Record<string, Partial<TravelPersonality>> = {
  explorer: {
    type: "The Cultural Explorer",
    tagline: "You seek authentic local experiences",
    icon: "🗺️",
    color: "#4ECDC4",
    description:
      "You thrive on discovering hidden gems and immersing yourself in local cultures.",
    strengths: [
      "Finding authentic experiences",
      "Connecting with locals",
      "Off-the-beaten-path discoveries",
    ],
    tips: [
      "Try local homestays for authentic experiences",
      "Learn basic local phrases",
    ],
  },
  luxury: {
    type: "The Luxury Seeker",
    tagline: "You travel in style and comfort",
    icon: "✨",
    color: "#FFD700",
    description:
      "You appreciate the finer things in travel and seek premium experiences.",
    strengths: [
      "Finding best hotels",
      "Curating premium experiences",
      "Attention to detail",
    ],
    tips: [
      "Book during off-peak for better rates",
      "Use loyalty programs strategically",
    ],
  },
  budget: {
    type: "The Smart Traveler",
    tagline: "You maximize experiences while minimizing costs",
    icon: "💡",
    color: "#10B981",
    description:
      "You have a knack for finding great deals and stretching your travel budget.",
    strengths: [
      "Finding deals",
      "Budget optimization",
      "Value-for-money experiences",
    ],
    tips: [
      "Book flights 6-8 weeks in advance",
      "Use price alerts for accommodations",
    ],
  },
  adventurer: {
    type: "The Thrill Seeker",
    tagline: "Adventure calls and you answer",
    icon: "🏔️",
    color: "#F59E0B",
    description:
      "You crave adrenaline and seek out challenging outdoor experiences.",
    strengths: [
      "Finding adventure spots",
      "Outdoor activities",
      "Pushing boundaries",
    ],
    tips: ["Always have travel insurance", "Research local safety guidelines"],
  },
  foodie: {
    type: "The Culinary Wanderer",
    tagline: "You travel with your taste buds",
    icon: "🍜",
    color: "#EF4444",
    description:
      "Food is your gateway to understanding cultures and destinations.",
    strengths: ["Finding local cuisine", "Food photography", "Cooking classes"],
    tips: [
      "Research food festivals before traveling",
      "Ask locals for hidden gems",
    ],
  },
  relaxer: {
    type: "The Mindful Traveler",
    tagline: "You travel to recharge and find peace",
    icon: "🧘",
    color: "#8B5CF6",
    description: "Your trips are about wellness, relaxation, and inner peace.",
    strengths: ["Finding peaceful spots", "Wellness activities", "Slow travel"],
    tips: ["Book spa treatments in advance", "Consider wellness retreats"],
  },
  social: {
    type: "The Social Butterfly",
    tagline: "You travel to connect and share",
    icon: "🦋",
    color: "#EC4899",
    description:
      "Group travel and making connections defines your travel style.",
    strengths: [
      "Group coordination",
      "Meeting new people",
      "Shared experiences",
    ],
    tips: ["Join travel groups", "Stay in social accommodations"],
  },
};

// ─────────────────────────────────────────────────────────────
// BADGE DEFINITIONS
// ─────────────────────────────────────────────────────────────

const BADGE_DEFINITIONS: Omit<Badge, "earnedAt" | "progress">[] = [
  // Exploration Badges
  {
    id: "first_trip",
    name: "First Steps",
    description: "Completed your first trip",
    icon: "👶",
    category: "exploration",
    rarity: "common",
    target: 1,
    isUnlocked: false,
    xpReward: 50,
  },
  {
    id: "explorer_5",
    name: "Wanderer",
    description: "Visited 5 destinations",
    icon: "🚶",
    category: "exploration",
    rarity: "common",
    target: 5,
    isUnlocked: false,
    xpReward: 100,
  },
  {
    id: "explorer_10",
    name: "Explorer",
    description: "Visited 10 destinations",
    icon: "🧭",
    category: "exploration",
    rarity: "rare",
    target: 10,
    isUnlocked: false,
    xpReward: 250,
  },
  {
    id: "explorer_25",
    name: "Adventurer",
    description: "Visited 25 destinations",
    icon: "🌏",
    category: "exploration",
    rarity: "epic",
    target: 25,
    isUnlocked: false,
    xpReward: 500,
  },
  {
    id: "explorer_50",
    name: "World Traveler",
    description: "Visited 50 destinations",
    icon: "🌍",
    category: "exploration",
    rarity: "legendary",
    target: 50,
    isUnlocked: false,
    xpReward: 1000,
  },
  {
    id: "globetrotter",
    name: "Globetrotter",
    description: "Visited 5 countries",
    icon: "🌎",
    category: "exploration",
    rarity: "epic",
    target: 5,
    isUnlocked: false,
    xpReward: 400,
  },

  // Planning Badges
  {
    id: "planner_pro",
    name: "Planner Pro",
    description: "Created 10 trip plans",
    icon: "📋",
    category: "planning",
    rarity: "common",
    target: 10,
    isUnlocked: false,
    xpReward: 150,
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Booked 5 trips in advance",
    icon: "🌅",
    category: "planning",
    rarity: "rare",
    target: 5,
    isUnlocked: false,
    xpReward: 200,
  },

  // Financial Badges
  {
    id: "budget_master",
    name: "Budget Master",
    description: "Stayed under budget on 5 trips",
    icon: "💰",
    category: "financial",
    rarity: "rare",
    target: 5,
    isUnlocked: false,
    xpReward: 200,
  },
  {
    id: "saver",
    name: "Smart Saver",
    description: "Saved ₹10,000 through deals",
    icon: "💎",
    category: "financial",
    rarity: "epic",
    target: 10000,
    isUnlocked: false,
    xpReward: 300,
  },

  // Social Badges
  {
    id: "storyteller",
    name: "Storyteller",
    description: "Shared 10 travel stories",
    icon: "📖",
    category: "social",
    rarity: "common",
    target: 10,
    isUnlocked: false,
    xpReward: 100,
  },
  {
    id: "photographer",
    name: "Travel Photographer",
    description: "Uploaded 100 photos",
    icon: "📸",
    category: "social",
    rarity: "rare",
    target: 100,
    isUnlocked: false,
    xpReward: 250,
  },
  {
    id: "influencer",
    name: "Travel Influencer",
    description: "Got 100 likes on your content",
    icon: "⭐",
    category: "social",
    rarity: "epic",
    target: 100,
    isUnlocked: false,
    xpReward: 400,
  },

  // Special Badges
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "7-day travel streak",
    icon: "🔥",
    category: "special",
    rarity: "rare",
    target: 7,
    isUnlocked: false,
    xpReward: 150,
  },
  {
    id: "streak_30",
    name: "Month Master",
    description: "30-day travel streak",
    icon: "🔥",
    category: "special",
    rarity: "epic",
    target: 30,
    isUnlocked: false,
    xpReward: 500,
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Booked a trip after midnight",
    icon: "🦉",
    category: "special",
    rarity: "common",
    target: 1,
    isUnlocked: false,
    xpReward: 50,
  },
];

// ─────────────────────────────────────────────────────────────
// LEVEL CONFIGURATION
// ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG = [
  { level: 1, title: "Novice Explorer", xpRequired: 0, icon: "🌱" },
  { level: 2, title: "Casual Traveler", xpRequired: 100, icon: "🌿" },
  { level: 3, title: "Wanderer", xpRequired: 300, icon: "🚶" },
  { level: 4, title: "Explorer", xpRequired: 600, icon: "🧭" },
  { level: 5, title: "Adventurer", xpRequired: 1000, icon: "🏔️" },
  { level: 6, title: "Journeyman", xpRequired: 1500, icon: "✈️" },
  { level: 7, title: "Globe Trotter", xpRequired: 2200, icon: "🌏" },
  { level: 8, title: "World Traveler", xpRequired: 3000, icon: "🌍" },
  { level: 9, title: "Nomad", xpRequired: 4000, icon: "🎒" },
  { level: 10, title: "Travel Master", xpRequired: 5500, icon: "👑" },
  { level: 11, title: "Legendary Explorer", xpRequired: 7500, icon: "🏆" },
  { level: 12, title: "Travel Guru", xpRequired: 10000, icon: "⭐" },
];

// ─────────────────────────────────────────────────────────────
// AI INTELLIGENCE ENGINE CLASS
// ─────────────────────────────────────────────────────────────

class TravelIntelligenceEngine {
  // ───────────────────────────────────────────────────────────
  // TRAVEL DNA COMPUTATION
  // ───────────────────────────────────────────────────────────

  computeTravelDNA(
    stats: TravelStats,
    behaviorData?: Record<string, unknown>,
  ): TravelDNA {
    const totalTrips = stats.trips.total || 1;
    const totalSpent = stats.total_spent || 0;
    const avgTripCost = totalSpent / totalTrips;

    // Base DNA from spending patterns
    const spendingBreakdown = stats.spending_breakdown || {};
    const totalSpending = Object.values(spendingBreakdown).reduce(
      (a: number, b) => a + Number(b || 0),
      0,
    );

    // Compute percentages safely
    const getSpendingPercent = (category: string): number => {
      if (totalSpending === 0) return 0;
      const amount = spendingBreakdown[category] || 0;
      return Math.min(100, Math.round((amount / totalSpending) * 100));
    };

    // Explorer score: Based on unique destinations
    const explorerScore = Math.min(
      100,
      Math.round(stats.destinations_visited * 10 + stats.places_visited * 2),
    );

    // Luxury score: Based on hotel/premium spending
    const luxuryScore = Math.min(
      100,
      Math.round(
        getSpendingPercent("hotels") * 0.8 +
          getSpendingPercent("flights") * 0.5 +
          (avgTripCost > 15000 ? 30 : avgTripCost > 10000 ? 20 : 10),
      ),
    );

    // Budget score: Inverse of luxury + budget booking patterns
    const budgetScore = Math.min(
      100,
      Math.round(
        100 -
          luxuryScore * 0.6 +
          (avgTripCost < 5000 ? 40 : avgTripCost < 10000 ? 20 : 0),
      ),
    );

    // Foodie score
    const foodieScore = Math.min(
      100,
      Math.round(
        getSpendingPercent("food") * 1.5 +
          getSpendingPercent("restaurants") * 1.2,
      ),
    );

    // Adventure score
    const adventureScore = Math.min(
      100,
      Math.round(
        getSpendingPercent("activities") * 1.5 +
          getSpendingPercent("tours") * 1.2,
      ),
    );

    // Culture score
    const cultureScore = Math.min(
      100,
      Math.round(
        getSpendingPercent("museums") * 2 +
          getSpendingPercent("culture") * 1.5 +
          stats.places_visited * 3,
      ),
    );

    // Relax score
    const relaxScore = Math.min(
      100,
      Math.round(
        getSpendingPercent("spa") * 1.5 +
          getSpendingPercent("wellness") * 1.5 +
          (stats.total_travel_days > 7 ? 20 : 0),
      ),
    );

    // Social score
    const socialScore = Math.min(
      100,
      Math.round(stats.favorites_count * 2 + stats.reservations.total * 5),
    );

    // Planner score
    const plannerScore = Math.min(
      100,
      Math.round(stats.trips.planning * 15 + stats.reservations.total * 5),
    );

    // Spontaneous score
    const spontaneousScore = Math.min(
      100,
      Math.round(100 - plannerScore * 0.5 + stats.trips.active * 10),
    );

    return {
      explorer: explorerScore,
      luxury: luxuryScore,
      budget: budgetScore,
      foodie: foodieScore,
      adventure: adventureScore,
      culture: cultureScore,
      relax: relaxScore,
      social: socialScore,
      planner: plannerScore,
      spontaneous: spontaneousScore,
    };
  }

  // ───────────────────────────────────────────────────────────
  // PERSONALITY DETERMINATION
  // ───────────────────────────────────────────────────────────

  determinePersonality(dna: TravelDNA): TravelPersonality {
    const scores = [
      { key: "explorer", score: dna.explorer },
      { key: "luxury", score: dna.luxury },
      { key: "budget", score: dna.budget },
      { key: "adventure", score: dna.adventure },
      { key: "foodie", score: dna.foodie },
      { key: "relaxer", score: dna.relax },
      { key: "social", score: dna.social },
    ];

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Get dominant personality
    const dominant = scores[0].key;
    const profile =
      PERSONALITY_PROFILES[dominant] || PERSONALITY_PROFILES.explorer;

    return {
      type: profile.type || "The Explorer",
      tagline: profile.tagline || "You love to explore",
      icon: profile.icon || "🗺️",
      color: profile.color || "#4ECDC4",
      description: profile.description || "You are a curious traveler.",
      strengths: profile.strengths || ["Exploring new places"],
      tips: profile.tips || ["Keep exploring!"],
    };
  }

  // ───────────────────────────────────────────────────────────
  // INSIGHT GENERATION
  // ───────────────────────────────────────────────────────────

  generateInsights(stats: TravelStats, dna: TravelDNA): AIInsight[] {
    const insights: AIInsight[] = [];
    const now = new Date().toISOString();

    // Trip frequency insights
    if (stats.trips.total > 0) {
      const avgUserTrips = 4; // Industry average
      const ratio = stats.trips.total / avgUserTrips;

      if (ratio > 1.5) {
        insights.push({
          id: "insight_freq_high",
          type: "achievement",
          priority: "medium",
          icon: "🚀",
          title: "Frequent Traveler",
          description: `You travel ${Math.round(ratio * 100)}% more than average users. Your wanderlust is inspiring!`,
          createdAt: now,
          isRead: false,
          isDismissed: false,
        });
      } else if (ratio < 0.5) {
        insights.push({
          id: "insight_freq_low",
          type: "tip",
          priority: "low",
          icon: "💡",
          title: "Time to Explore",
          description:
            "You have opportunities for more adventures. Consider planning your next getaway!",
          actionLabel: "Plan a Trip",
          createdAt: now,
          isRead: false,
          isDismissed: false,
        });
      }
    }

    // Destination insights
    if (stats.destinations_visited >= 5) {
      insights.push({
        id: "insight_destinations",
        type: "milestone",
        priority: "high",
        icon: "🌍",
        title: "Globe Explorer",
        description: `You've explored ${stats.destinations_visited} destinations! Your travel map is growing beautifully.`,
        createdAt: now,
        isRead: false,
        isDismissed: false,
      });
    }

    // Spending insights
    if (stats.total_spent > 0) {
      const avgPerTrip = stats.total_spent / (stats.trips.total || 1);

      if (avgPerTrip < 5000) {
        insights.push({
          id: "insight_budget_smart",
          type: "achievement",
          priority: "medium",
          icon: "💰",
          title: "Budget Smart",
          description: `Your average trip cost of ₹${Math.round(avgPerTrip).toLocaleString()} shows excellent budget management!`,
          createdAt: now,
          isRead: false,
          isDismissed: false,
        });
      } else if (avgPerTrip > 20000) {
        insights.push({
          id: "insight_premium",
          type: "pattern",
          priority: "low",
          icon: "✨",
          title: "Premium Traveler",
          description:
            "You prefer premium experiences. Consider loyalty programs for better value.",
          createdAt: now,
          isRead: false,
          isDismissed: false,
        });
      }
    }

    // DNA-based insights
    if (dna.foodie > 60) {
      insights.push({
        id: "insight_foodie",
        type: "pattern",
        priority: "medium",
        icon: "🍜",
        title: "Culinary Explorer",
        description:
          "Your spending shows a love for food experiences. Try food tours on your next trip!",
        createdAt: now,
        isRead: false,
        isDismissed: false,
      });
    }

    if (dna.adventure > 70) {
      insights.push({
        id: "insight_adventure",
        type: "recommendation",
        priority: "medium",
        icon: "🏔️",
        title: "Adventure Seeker",
        description:
          "You crave adventure! Consider Rishikesh for rafting or Manali for trekking.",
        actionLabel: "Explore Adventure",
        createdAt: now,
        isRead: false,
        isDismissed: false,
      });
    }

    // Streak insights
    if (stats.trips.active > 0) {
      insights.push({
        id: "insight_active",
        type: "trend",
        priority: "high",
        icon: "🔥",
        title: "Active Traveler",
        description: `You have ${stats.trips.active} active trip${stats.trips.active > 1 ? "s" : ""}! Keep the momentum going.`,
        createdAt: now,
        isRead: false,
        isDismissed: false,
      });
    }

    // Planning insights
    if (stats.trips.planning > 0) {
      insights.push({
        id: "insight_planning",
        type: "tip",
        priority: "medium",
        icon: "📋",
        title: "In the Pipeline",
        description: `${stats.trips.planning} trip${stats.trips.planning > 1 ? "s are" : " is"} in planning. Turn those plans into adventures!`,
        actionLabel: "View Plans",
        createdAt: now,
        isRead: false,
        isDismissed: false,
      });
    }

    return insights;
  }

  // ───────────────────────────────────────────────────────────
  // PREDICTION ENGINE
  // ───────────────────────────────────────────────────────────

  generatePredictions(stats: TravelStats, dna: TravelDNA): TravelPrediction[] {
    const predictions: TravelPrediction[] = [];
    const now = new Date();

    // Next trip prediction based on patterns
    const avgTripsPerMonth = stats.trips.total / 12; // Simplified
    const weeksSinceLastTrip = stats.trips.active > 0 ? 0 : 4; // Simplified

    if (stats.trips.planning > 0 || weeksSinceLastTrip > 2) {
      const nextWeekend = new Date(now);
      nextWeekend.setDate(nextWeekend.getDate() + (6 - now.getDay()));

      predictions.push({
        type: "next_trip",
        confidence: stats.trips.planning > 0 ? 0.85 : 0.65,
        prediction: `You're likely to travel ${stats.trips.planning > 0 ? "this weekend" : "within 2 weeks"}`,
        reasoning:
          stats.trips.planning > 0
            ? "You have active trip plans"
            : "Your travel patterns suggest an upcoming trip",
        data: {
          likelyDate: nextWeekend.toISOString(),
          tripType:
            dna.adventure > 60
              ? "adventure"
              : dna.relax > 60
                ? "relaxation"
                : "exploration",
        },
      });
    }

    // Destination prediction
    if (stats.top_destinations.length > 0) {
      const topDest = stats.top_destinations[0];
      predictions.push({
        type: "destination",
        confidence: 0.7,
        prediction: `${topDest.destination} could be your next destination`,
        reasoning: `You've visited ${topDest.destination} ${topDest.trips} times before`,
      });
    }

    // Budget prediction
    if (stats.total_spent > 0) {
      const monthlyAvg = stats.total_spent / 12;
      predictions.push({
        type: "budget",
        confidence: 0.8,
        prediction: `Expected monthly travel spend: ₹${Math.round(monthlyAvg * 1.1).toLocaleString()}`,
        reasoning: "Based on your spending patterns this year",
        data: {
          monthlyForecast: monthlyAvg * 1.1,
          yearlyForecast: monthlyAvg * 12,
        },
      });
    }

    // Seasonal prediction
    const month = now.getMonth();
    if (month >= 9 || month <= 2) {
      predictions.push({
        type: "season",
        confidence: 0.75,
        prediction: "Perfect time for hill stations and wildlife safaris!",
        reasoning: "Winter season is ideal for outdoor adventures in India",
      });
    } else if (month >= 5 && month <= 7) {
      predictions.push({
        type: "season",
        confidence: 0.7,
        prediction: "Consider hill stations or coastal getaways",
        reasoning: "Monsoon season - great for scenic destinations",
      });
    }

    return predictions;
  }

  // ───────────────────────────────────────────────────────────
  // FINANCIAL INTELLIGENCE
  // ───────────────────────────────────────────────────────────

  computeFinancialHealth(stats: TravelStats): FinancialHealth {
    const totalSpent = stats.total_spent || 0;
    const totalTrips = stats.trips.total || 1;
    const avgTripCost = totalSpent / totalTrips;

    // Calculate spending breakdown safely
    const spendingBreakdown = stats.spending_breakdown || {};
    const categories = Object.entries(spendingBreakdown);

    // Financial health score (0-100)
    let score = 50; // Base score

    // Positive factors
    if (avgTripCost < 8000) score += 20;
    else if (avgTripCost < 15000) score += 10;

    if (stats.trips.completed > stats.trips.planning) score += 10;
    if (totalTrips > 5) score += 10;

    // Negative factors
    if (avgTripCost > 25000) score -= 15;
    if (stats.trips.planning > stats.trips.completed) score -= 10;

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine grade
    let grade: "A" | "B" | "C" | "D" | "F";
    let status: "excellent" | "good" | "fair" | "needs-attention" | "critical";

    if (score >= 90) {
      grade = "A";
      status = "excellent";
    } else if (score >= 75) {
      grade = "B";
      status = "good";
    } else if (score >= 60) {
      grade = "C";
      status = "fair";
    } else if (score >= 40) {
      grade = "D";
      status = "needs-attention";
    } else {
      grade = "F";
      status = "critical";
    }

    // Generate insights
    const insights: AIInsight[] = [];
    const now = new Date().toISOString();

    if (score >= 75) {
      insights.push({
        id: "fin_health_good",
        type: "achievement",
        priority: "medium",
        icon: "📈",
        title: "Great Financial Health",
        description: `Your travel spending is well managed with an average of ₹${Math.round(avgTripCost).toLocaleString()} per trip.`,
        createdAt: now,
        isRead: false,
        isDismissed: false,
      });
    }

    if (categories.length > 0 && totalSpent > 0) {
      const topCategory = categories.reduce((a, b) =>
        (b[1] as number) > (a[1] as number) ? b : a,
      );
      const topPercent = Math.round(
        ((topCategory[1] as number) / totalSpent) * 100,
      );

      insights.push({
        id: "fin_category_top",
        type: "pattern",
        priority: "low",
        icon: "📊",
        title: "Top Spending Category",
        description: `${topPercent}% of your spending goes to ${topCategory[0]}`,
        createdAt: now,
        isRead: false,
        isDismissed: false,
      });
    }

    return {
      score,
      grade,
      status,
      insights,
      recommendations: this.getFinancialRecommendations(
        score,
        avgTripCost,
        categories,
      ),
      budgetUtilization: score,
      savingsRate: Math.max(0, 100 - score) / 100,
      avgTripCost,
      costTrend: 0,
    };
  }

  private getFinancialRecommendations(
    score: number,
    avgCost: number,
    categories: Array<[string, number]>,
  ): string[] {
    const recommendations: string[] = [];

    if (avgCost > 15000) {
      recommendations.push("Consider off-season travel for better rates");
      recommendations.push(
        "Look for package deals to save on combined bookings",
      );
    }

    if (score < 60) {
      recommendations.push("Set a monthly travel budget and track expenses");
      recommendations.push("Use price comparison tools before booking");
    }

    const hotelSpending = categories.find((c) => c[0] === "hotels");
    if (hotelSpending && (hotelSpending[1] as number) > avgCost * 0.5) {
      recommendations.push(
        "Try alternative accommodations like homestays or Airbnb",
      );
    }

    return recommendations;
  }

  computeSpendingCategories(stats: TravelStats): SpendingCategory[] {
    const spendingBreakdown = stats.spending_breakdown || {};
    const totalSpent = stats.total_spent || 0;

    return Object.entries(spendingBreakdown).map(([name, amount]) => {
      const amt = amount as number;
      const percentage =
        totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0;

      return {
        name,
        amount: amt,
        percentage,
        trend: "stable",
        trendValue: 0,
        status:
          percentage > 40 ? "over" : percentage < 20 ? "under" : "on-track",
        insights: this.getCategoryInsights(name, amt, percentage),
      };
    });
  }

  private getCategoryInsights(
    category: string,
    amount: number,
    percentage: number,
  ): string[] {
    const insights: string[] = [];

    if (category === "food" && percentage > 30) {
      insights.push(
        "Consider trying local street food for authentic experiences",
      );
      insights.push("Look for lunch specials at premium restaurants");
    }

    if (category === "hotels" && percentage > 40) {
      insights.push("Compare prices across booking platforms");
      insights.push("Consider longer stays for discount rates");
    }

    if (category === "transport" && percentage > 25) {
      insights.push("Book flights 6-8 weeks in advance");
      insights.push("Consider trains for short distances");
    }

    return insights;
  }

  // ───────────────────────────────────────────────────────────
  // GAMIFICATION SYSTEM
  // ───────────────────────────────────────────────────────────

  computeUserLevel(totalXP: number): UserLevel {
    let currentLevel = LEVEL_CONFIG[0];
    let nextLevel = LEVEL_CONFIG[1];

    for (let i = LEVEL_CONFIG.length - 1; i >= 0; i--) {
      if (totalXP >= LEVEL_CONFIG[i].xpRequired) {
        currentLevel = LEVEL_CONFIG[i];
        nextLevel = LEVEL_CONFIG[i + 1] || LEVEL_CONFIG[i];
        break;
      }
    }

    const xpInLevel = totalXP - currentLevel.xpRequired;
    const xpNeeded = nextLevel.xpRequired - currentLevel.xpRequired;
    const progress = Math.round((xpInLevel / xpNeeded) * 100);

    return {
      level: currentLevel.level,
      xp: totalXP,
      xpToNext: nextLevel.xpRequired - totalXP,
      title: currentLevel.title,
      progress: Math.min(100, progress),
      benefits: this.getLevelBenefits(currentLevel.level),
      icon: currentLevel.icon,
    };
  }

  private getLevelBenefits(level: number): string[] {
    const benefits: string[] = ["Access to travel insights"];

    if (level >= 3) benefits.push("Priority support");
    if (level >= 5) benefits.push("Exclusive deals");
    if (level >= 7) benefits.push("Early access to features");
    if (level >= 10) benefits.push("Premium travel concierge");

    return benefits;
  }

  computeStreaks(stats: TravelStats): TravelStreak[] {
    return [
      {
        current: stats.trips.active > 0 ? stats.trips.active : 0,
        longest: Math.max(stats.trips.completed, stats.trips.active),
        type: "trips",
        lastActivity: new Date().toISOString(),
        isActive: stats.trips.active > 0,
        nextMilestone: Math.ceil((stats.trips.completed + 1) / 5) * 5,
        milestoneReward: 100,
      },
      {
        current: stats.total_travel_days,
        longest: stats.total_travel_days,
        type: "days",
        lastActivity: new Date().toISOString(),
        isActive: false,
        nextMilestone: Math.ceil((stats.total_travel_days + 1) / 10) * 10,
        milestoneReward: 50,
      },
    ];
  }

  computeBadges(stats: TravelStats): Badge[] {
    return BADGE_DEFINITIONS.map((badge) => {
      let progress = 0;

      // Calculate progress based on badge type
      switch (badge.id) {
        case "first_trip":
          progress = stats.trips.total >= 1 ? 100 : 0;
          break;
        case "explorer_5":
          progress = Math.min(100, (stats.destinations_visited / 5) * 100);
          break;
        case "explorer_10":
          progress = Math.min(100, (stats.destinations_visited / 10) * 100);
          break;
        case "explorer_25":
          progress = Math.min(100, (stats.destinations_visited / 25) * 100);
          break;
        case "explorer_50":
          progress = Math.min(100, (stats.destinations_visited / 50) * 100);
          break;
        case "photographer":
          progress = Math.min(100, (stats.photos_uploaded / 100) * 100);
          break;
        case "planner_pro":
          progress = Math.min(100, (stats.trips.total / 10) * 100);
          break;
        default:
          progress = 0;
      }

      return {
        ...badge,
        progress: Math.round(progress),
        isUnlocked: progress >= 100,
        earnedAt: progress >= 100 ? new Date().toISOString() : undefined,
      };
    });
  }

  computeAchievements(stats: TravelStats): Achievement[] {
    const achievements: Achievement[] = [];
    const now = new Date().toISOString();

    // First trip achievement
    if (stats.trips.total >= 1) {
      achievements.push({
        id: "ach_first_trip",
        type: "milestone",
        title: "First Adventure",
        description: "Completed your first trip!",
        icon: "🎯",
        unlockedAt: now,
        isSecret: false,
        xpEarned: 50,
      });
    }

    // Destination milestones
    if (stats.destinations_visited >= 5) {
      achievements.push({
        id: "ach_5_destinations",
        type: "milestone",
        title: "Wanderer",
        description: "Explored 5 destinations",
        icon: "🗺️",
        unlockedAt: now,
        isSecret: false,
        xpEarned: 100,
      });
    }

    if (stats.destinations_visited >= 10) {
      achievements.push({
        id: "ach_10_destinations",
        type: "milestone",
        title: "Explorer",
        description: "Explored 10 destinations",
        icon: "🧭",
        unlockedAt: now,
        isSecret: false,
        xpEarned: 200,
      });
    }

    // Travel days milestone
    if (stats.total_travel_days >= 30) {
      achievements.push({
        id: "ach_30_days",
        type: "milestone",
        title: "Month on the Road",
        description: "Spent 30 days traveling",
        icon: "📅",
        unlockedAt: now,
        isSecret: false,
        xpEarned: 300,
      });
    }

    return achievements;
  }

  // ───────────────────────────────────────────────────────────
  // STORYTELLING ENGINE
  // ───────────────────────────────────────────────────────────

  generateStories(stats: TravelStats): TravelStory[] {
    const stories: TravelStory[] = [];
    const year = new Date().getFullYear();

    // Overall journey story
    stories.push({
      id: "story_journey",
      type: "summary",
      period: `${year}`,
      title: `Your ${year} Travel Journey`,
      narrative: `You explored ${stats.destinations_visited} destinations across ${stats.trips.total} trips, spending ${stats.total_travel_days} days on the road.`,
      highlights: [
        `${stats.trips.total} trips completed`,
        `${stats.destinations_visited} destinations visited`,
        `${stats.total_travel_days} days traveling`,
      ],
      stats: {
        trips: stats.trips.total,
        destinations: stats.destinations_visited,
        days: stats.total_travel_days,
      },
      icon: "🌍",
      shareableText: `🌍 In ${year}, I explored ${stats.destinations_visited} destinations on ${stats.trips.total} trips! #TravelStats`,
    });

    // Photo story
    if (stats.photos_uploaded > 0) {
      stories.push({
        id: "story_photos",
        type: "memory",
        period: `${year}`,
        title: "Memory Keeper",
        narrative: `You captured ${stats.photos_uploaded} photos during your travels, preserving precious memories.`,
        highlights: [`${stats.photos_uploaded} photos uploaded`],
        stats: { photos: stats.photos_uploaded },
        icon: "📸",
        shareableText: `📸 Captured ${stats.photos_uploaded} travel memories this year! 🌟`,
      });
    }

    // Top destination story
    if (stats.top_destinations.length > 0) {
      const topDest = stats.top_destinations[0];
      stories.push({
        id: "story_top_dest",
        type: "milestone",
        period: `${year}`,
        title: "Your Favorite Destination",
        narrative: `${topDest.destination} holds a special place in your heart with ${topDest.trips} visits.`,
        highlights: [`${topDest.destination}: ${topDest.trips} visits`],
        stats: { visits: topDest.trips },
        icon: "❤️",
        shareableText: `❤️ My favorite destination: ${topDest.destination} (${topDest.trips} visits)!`,
      });
    }

    return stories;
  }

  // ───────────────────────────────────────────────────────────
  // XP CALCULATION
  // ───────────────────────────────────────────────────────────

  calculateTotalXP(stats: TravelStats, achievements: Achievement[]): number {
    let xp = 0;

    // XP from trips
    xp += stats.trips.total * 50;
    xp += stats.trips.completed * 25;

    // XP from destinations
    xp += stats.destinations_visited * 30;
    xp += stats.places_visited * 10;

    // XP from engagement
    xp += stats.photos_uploaded * 2;
    xp += stats.favorites_count * 5;
    xp += stats.reservations.total * 15;

    // XP from achievements
    xp += achievements.reduce((sum, a) => sum + a.xpEarned, 0);

    return xp;
  }

  // ───────────────────────────────────────────────────────────
  // ENHANCED STATS COMPUTATION
  // ───────────────────────────────────────────────────────────

  computeEnhancedStats(stats: TravelStats): EnhancedTravelStats {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return {
      trips: {
        total: stats.trips.total,
        thisMonth: Math.floor(stats.trips.total / 12), // Simplified
        thisYear: stats.trips.total, // Simplified
        lastYear: Math.floor(stats.trips.total * 0.8), // Simplified
        trend: stats.trips.total > 5 ? "up" : "stable",
        trendValue: stats.trips.total > 5 ? 20 : 0,
        avgDuration:
          stats.trips.total > 0
            ? Math.round(stats.total_travel_days / stats.trips.total)
            : 0,
        longestTrip: stats.total_travel_days,
        shortestTrip: stats.total_travel_days > 0 ? 1 : 0,
      },
      destinations: {
        total: stats.destinations_visited,
        countries: Math.ceil(stats.destinations_visited / 5), // Simplified
        cities: stats.destinations_visited,
        thisYear: stats.destinations_visited,
        mostVisited: stats.top_destinations[0]?.destination || "N/A",
        wishlist: stats.favorites_count,
      },
      spending: {
        total: stats.total_spent,
        thisMonth: Math.round(stats.total_spent / 12),
        thisYear: stats.total_spent,
        avgPerTrip:
          stats.trips.total > 0
            ? Math.round(stats.total_spent / stats.trips.total)
            : 0,
        avgPerDay:
          stats.total_travel_days > 0
            ? Math.round(stats.total_spent / stats.total_travel_days)
            : 0,
        currency: "INR",
      },
      engagement: {
        photosUploaded: stats.photos_uploaded,
        journalsWritten: 0, // From journal data
        placesSaved: stats.favorites_count,
        tripsShared: 0, // From sharing data
      },
      time: {
        totalDays: stats.total_travel_days,
        avgTripLength:
          stats.trips.total > 0
            ? Math.round(stats.total_travel_days / stats.trips.total)
            : 0,
        longestStreak: stats.trips.completed,
        currentStreak: stats.trips.active,
      },
      comparisons: {
        vsLastMonth: {
          trips: 0,
          spending: 0,
          destinations: 0,
        },
        vsLastYear: {
          trips: 20,
          spending: 15,
          destinations: 25,
        },
        vsAverageUser: {
          trips: stats.trips.total > 4 ? 50 : -20,
          spending: 0,
          destinations: stats.destinations_visited > 5 ? 30 : 0,
        },
      },
    };
  }
}

// Export singleton instance
export const travelIntelligenceEngine = new TravelIntelligenceEngine();
export default travelIntelligenceEngine;
