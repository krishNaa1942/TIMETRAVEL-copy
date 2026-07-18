/**
 * 🧠 INTENT PARSER AGENT
 * =====================
 * NLP-based intent parsing for travel queries
 * Production-grade AI agent with pattern matching and entity extraction
 */

import type {
  TravelIntent,
  TravelIntentType,
  ExtractedEntities,
  ConversationContext,
  IntentPattern,
  AgentResponse,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Intent Patterns Configuration
// ─────────────────────────────────────────────────────────────

const INTENT_PATTERNS: IntentPattern[] = [
  {
    type: "plan_trip",
    patterns: [
      /(?:plan|book|organize|schedule)\s+(?:a\s+)?trip/i,
      /(?:I\s+want\s+to\s+go|I'd\s+like\s+to\s+visit|take\s+me\s+to)/i,
      /(?:plan|book)\s+(?:my|a)\s+(?:vacation|holiday|getaway)/i,
    ],
    keywords: [
      "plan",
      "trip",
      "vacation",
      "holiday",
      "travel",
      "visit",
      "go to",
    ],
    priority: 10,
  },
  {
    type: "get_weather",
    patterns: [
      /(?:what's|what\s+is|how's)\s+(?:the\s+)?weather\s+(?:in|at|like\s+in)/i,
      /(?:weather|forecast|temperature)\s+(?:in|at|for)/i,
      /(?:is\s+it\s+(?:raining|sunny|cold|hot)\s+in)/i,
    ],
    keywords: [
      "weather",
      "forecast",
      "temperature",
      "rain",
      "sunny",
      "climate",
    ],
    priority: 9,
  },
  {
    type: "find_places",
    patterns: [
      /(?:find|show|search\s+for|look\s+for)\s+(?:places|restaurants|hotels|attractions)/i,
      /(?:where\s+(?:can|to)\s+(?:I\s+)?(?:eat|stay|visit|go))/i,
      /(?:best|top|good)\s+(?:restaurants|hotels|places|attractions)/i,
    ],
    keywords: [
      "find",
      "places",
      "restaurants",
      "hotels",
      "attractions",
      "visit",
      "eat",
      "stay",
    ],
    priority: 8,
  },
  {
    type: "get_recommendations",
    patterns: [
      /(?:recommend|suggest)\s+(?:some\s+)?(?:places|destinations|activities)/i,
      /(?:what\s+(?:are\s+)?(?:good|best)\s+(?:places|destinations))/i,
      /(?:any\s+)?(?:recommendations|suggestions)\s+(?:for|near)/i,
    ],
    keywords: [
      "recommend",
      "suggest",
      "best places",
      "must visit",
      "top destinations",
    ],
    priority: 8,
  },
  {
    type: "create_itinerary",
    patterns: [
      /(?:create|make|build|generate)\s+(?:an?|my)?\s*(?:itinerary|schedule|plan)/i,
      /(?:plan|schedule)\s+(?:my\s+)?(?:day|days|trip)/i,
      /(?:what\s+should\s+I\s+do\s+in)/i,
    ],
    keywords: ["itinerary", "schedule", "day plan", "daily plan", "route"],
    priority: 9,
  },
  {
    type: "modify_itinerary",
    patterns: [
      /(?:change|modify|update|edit)\s+(?:my\s+)?(?:itinerary|plan|schedule)/i,
      /(?:add|remove)\s+(?:to|from)\s+(?:my\s+)?(?:itinerary|plan)/i,
      /(?:reschedule|rearrange)\s+(?:my\s+)?(?:day|trip)/i,
    ],
    keywords: ["change", "modify", "update", "edit itinerary", "reschedule"],
    priority: 8,
  },
  {
    type: "get_directions",
    patterns: [
      /(?:how\s+do\s+I\s+get|directions\s+to|route\s+to|way\s+to)/i,
      /(?:navigate|drive|walk)\s+(?:to|from)/i,
      /(?:distance\s+between|how\s+far)/i,
    ],
    keywords: ["directions", "route", "navigate", "how to get", "distance"],
    priority: 8,
  },
  {
    type: "translate_phrase",
    patterns: [
      /(?:translate|say\s+in|how\s+do\s+you\s+say)/i,
      /(?:what's|what\s+is)\s+(?:the\s+)?(?:word|phrase)\s+for/i,
      /(?:meaning\s+of|define)/i,
    ],
    keywords: [
      "translate",
      "say in",
      "how do you say",
      "meaning",
      "phrasebook",
    ],
    priority: 7,
  },
  {
    type: "currency_convert",
    patterns: [
      /(?:convert|exchange)\s+(?:\w+\s+)?(?:to|into)/i,
      /(?:what's|what\s+is)\s+(?:\d+\s+)?(?:\w+)\s+in\s+\w+/i,
      /(?:currency|exchange\s+rate)/i,
    ],
    keywords: [
      "convert",
      "currency",
      "exchange",
      "rate",
      "dollars",
      "euros",
      "rupees",
    ],
    priority: 7,
  },
  {
    type: "general_query",
    patterns: [
      /(?:tell\s+me\s+about|information\s+about|what\s+(?:is|are))/i,
      /(?:help|assist|guide)\s+me/i,
      /(?:can\s+you|could\s+you)/i,
    ],
    keywords: ["tell me", "information", "help", "what is", "about"],
    priority: 1,
  },
];

// ─────────────────────────────────────────────────────────────
// Entity Extraction Patterns
// ─────────────────────────────────────────────────────────────

const DESTINATION_PATTERNS = [
  /(?:to|in|at|visit|travel\s+to)\s+([A-Z][a-zA-Z\s,]+?)(?:\s+(?:for|from|on|in|with|\?|$))/g,
  /(?:trip\s+to|vacation\s+in|holiday\s+in)\s+([A-Z][a-zA-Z\s,]+)/g,
];

const DATE_PATTERNS = [
  /(?:from|between)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{4})?)/gi,
  /(?:on|at)\s+((?:next|this)\s+(?:week|month|weekend|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))/gi,
  /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/g,
];

const BUDGET_PATTERNS = [
  /(?:budget|spend|cost)\s+(?:of|around|about)?\s*\$?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
  /\$?(\d+(?:,\d+)?)\s*(?:dollars|USD|budget)/gi,
  /(?:under|within|below)\s*\$?(\d+(?:,\d+)?)/gi,
];

const TRAVELERS_PATTERN =
  /(?:for|with)\s+(\d+|one|two|three|four|five)\s+(?:people|persons|travelers|adults|guests)/gi;

const DURATION_PATTERN =
  /(?:for|duration\s+of)\s+(\d+)\s*(?:days?|nights?|weeks?)/gi;

// ─────────────────────────────────────────────────────────────
// Intent Parser Agent Class
// ─────────────────────────────────────────────────────────────

export class IntentParserAgent {
  private static instance: IntentParserAgent;
  private cache: Map<string, TravelIntent> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): IntentParserAgent {
    if (!IntentParserAgent.instance) {
      IntentParserAgent.instance = new IntentParserAgent();
    }
    return IntentParserAgent.instance;
  }

  /**
   * Parse user input to extract travel intent
   */
  async parse(
    input: string,
    context?: ConversationContext,
  ): Promise<AgentResponse<TravelIntent>> {
    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = this.getCacheKey(input, context);
      const cached = this.getCached(cacheKey);
      if (cached) {
        return this.successResponse(cached, startTime);
      }

      // Normalize input
      const normalizedInput = this.normalizeInput(input);

      // Detect intent type
      const intentType = this.detectIntentType(normalizedInput);

      // Extract entities
      const entities = this.extractEntitiesInternal(normalizedInput, context);

      // Calculate confidence
      const confidence = this.calculateConfidence(
        intentType,
        entities,
        normalizedInput,
      );

      // Generate follow-up suggestions
      const suggestedFollowUp = this.generateFollowUps(intentType, entities);

      const intent: TravelIntent = {
        type: intentType,
        entities,
        confidence,
        rawInput: input,
        suggestedFollowUp,
      };

      // Cache result
      this.setCache(cacheKey, intent);

      return this.successResponse(intent, startTime);
    } catch (error) {
      return this.errorResponse(
        "INTENT_PARSE_ERROR",
        error instanceof Error ? error.message : "Failed to parse intent",
        startTime,
      );
    }
  }

  /**
   * Extract entities from user input (public method)
   */
  async extractEntitiesFromInput(
    input: string,
  ): Promise<AgentResponse<ExtractedEntities>> {
    const startTime = Date.now();

    try {
      const normalizedInput = this.normalizeInput(input);
      const entities = this.extractEntitiesInternal(normalizedInput);

      return this.successResponse(entities, startTime);
    } catch (error) {
      return this.errorResponse(
        "ENTITY_EXTRACTION_ERROR",
        error instanceof Error ? error.message : "Failed to extract entities",
        startTime,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private normalizeInput(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s?,.!-]/g, "");
  }

  private detectIntentType(input: string): TravelIntentType {
    let bestMatch: TravelIntentType = "unknown";
    let bestScore = 0;

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;

      // Check regex patterns
      for (const regex of pattern.patterns) {
        if (regex.test(input)) {
          score += pattern.priority * 2;
        }
      }

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (input.includes(keyword.toLowerCase())) {
          score += pattern.priority;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern.type;
      }
    }

    return bestMatch;
  }

  private extractEntitiesInternal(
    input: string,
    context?: ConversationContext,
  ): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract destination
    entities.destination = this.extractDestination(input);

    // Extract dates
    entities.dates = this.extractDates(input);

    // Extract budget
    entities.budget = this.extractBudget(input);

    // Extract number of travelers
    entities.travelers = this.extractTravelers(input);

    // Extract duration
    entities.duration = this.extractDuration(input);

    // Extract preferences/activities
    entities.preferences = this.extractPreferences(input);
    entities.activities = this.extractActivities(input);

    // Merge with context if available
    if (context?.userPreferences) {
      entities.preferences = [
        ...(entities.preferences || []),
        ...(context.userPreferences.interests || []),
      ];
    }

    return entities;
  }

  private extractDestination(input: string): string | undefined {
    for (const pattern of DESTINATION_PATTERNS) {
      const match = pattern.exec(input);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    // Common destinations lookup
    const commonDestinations = [
      "paris",
      "tokyo",
      "london",
      "new york",
      "bali",
      "dubai",
      "rome",
      "barcelona",
      "singapore",
      "sydney",
      "maldives",
      "bangkok",
      "amsterdam",
      "istanbul",
      "prague",
      "vienna",
      "san francisco",
      "los angeles",
      "miami",
      "seattle",
      "chicago",
      "boston",
      "india",
      "delhi",
      "mumbai",
      "bangalore",
      "jaipur",
      "goa",
    ];

    for (const dest of commonDestinations) {
      if (input.includes(dest)) {
        return dest.charAt(0).toUpperCase() + dest.slice(1);
      }
    }

    return undefined;
  }

  private extractDates(input: string): ExtractedEntities["dates"] {
    for (const pattern of DATE_PATTERNS) {
      const match = pattern.exec(input);
      if (match?.[1]) {
        return {
          start: match[1],
          end: match[2] || match[1],
        };
      }
    }

    // Handle relative dates
    if (input.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { start: tomorrow, end: tomorrow };
    }

    if (input.includes("next weekend")) {
      const saturday = new Date();
      saturday.setDate(saturday.getDate() + (6 - saturday.getDay() + 7));
      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);
      return { start: saturday, end: sunday };
    }

    return undefined;
  }

  private extractBudget(input: string): ExtractedEntities["budget"] {
    for (const pattern of BUDGET_PATTERNS) {
      const match = pattern.exec(input);
      if (match?.[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount)) {
          return { max: amount, currency: "USD" };
        }
      }
    }

    // Budget levels
    if (input.includes("budget") || input.includes("cheap")) {
      return { max: 500, currency: "USD" };
    }
    if (input.includes("luxury") || input.includes("premium")) {
      return { min: 2000, currency: "USD" };
    }

    return undefined;
  }

  private extractTravelers(input: string): number | undefined {
    const match = TRAVELERS_PATTERN.exec(input);
    if (match?.[1]) {
      const wordToNum: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
      };
      const num = wordToNum[match[1].toLowerCase()] ?? parseInt(match[1], 10);
      return isNaN(num) ? undefined : num;
    }

    if (input.includes("solo") || input.includes("alone")) {
      return 1;
    }
    if (input.includes("couple") || input.includes("honeymoon")) {
      return 2;
    }
    if (input.includes("family") || input.includes("kids")) {
      return 4;
    }

    return undefined;
  }

  private extractDuration(input: string): number | undefined {
    const match = DURATION_PATTERN.exec(input);
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  private extractPreferences(input: string): string[] | undefined {
    const preferences: string[] = [];
    const prefKeywords: Record<string, string[]> = {
      adventure: ["adventure", "hiking", "trekking", "outdoor", "extreme"],
      culture: ["culture", "museum", "history", "heritage", "art"],
      food: ["food", "culinary", "cooking", "restaurant", "cuisine", "eating"],
      beach: ["beach", "swimming", "sunbathing", "coastal", "seaside"],
      nightlife: ["nightlife", "party", "club", "bar", "entertainment"],
      shopping: ["shopping", "market", "souvenir", "mall", "store"],
      relaxation: ["spa", "wellness", "relaxation", "yoga", "meditation"],
      photography: [
        "photography",
        "instagram",
        "pictures",
        "scenic",
        "viewpoint",
      ],
    };

    for (const [pref, keywords] of Object.entries(prefKeywords)) {
      if (keywords.some((kw) => input.includes(kw))) {
        preferences.push(pref);
      }
    }

    return preferences.length > 0 ? preferences : undefined;
  }

  private extractActivities(input: string): string[] | undefined {
    const activities: string[] = [];
    const activityPatterns = [
      /(?:want\s+to|like\s+to|love\s+to)\s+(\w+)/gi,
      /(?:go\s+|do\s+)(\w+)/gi,
    ];

    for (const pattern of activityPatterns) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        if (
          match[1] &&
          !["to", "the", "a", "an", "and", "or"].includes(
            match[1].toLowerCase(),
          )
        ) {
          activities.push(match[1].toLowerCase());
        }
      }
    }

    return activities.length > 0 ? activities : undefined;
  }

  private calculateConfidence(
    type: TravelIntentType,
    entities: ExtractedEntities,
    input: string,
  ): number {
    let confidence = 0.5; // Base confidence

    // Intent type confidence
    if (type !== "unknown") {
      confidence += 0.2;
    }

    // Entity extraction confidence
    const entityCount = Object.values(entities).filter(
      (v) => v !== undefined,
    ).length;
    confidence += Math.min(entityCount * 0.05, 0.2);

    // Input quality confidence
    if (input.length > 10) confidence += 0.05;
    if (input.includes("?")) confidence += 0.05;

    return Math.min(confidence, 0.99);
  }

  private generateFollowUps(
    type: TravelIntentType,
    entities: ExtractedEntities,
  ): string[] | undefined {
    const followUps: string[] = [];

    if (type === "plan_trip" && !entities.destination) {
      followUps.push("Where would you like to go?");
    }
    if (type === "plan_trip" && !entities.dates) {
      followUps.push("When are you planning to travel?");
    }
    if (type === "plan_trip" && !entities.travelers) {
      followUps.push("How many people will be traveling?");
    }
    if (type === "get_weather" && !entities.destination) {
      followUps.push("Which city would you like weather for?");
    }
    if (type === "find_places" && !entities.destination) {
      followUps.push("Where are you looking for places?");
    }

    return followUps.length > 0 ? followUps : undefined;
  }

  // ─────────────────────────────────────────────────────────────
  // Cache Methods
  // ─────────────────────────────────────────────────────────────

  private getCacheKey(input: string, context?: ConversationContext): string {
    const contextId = context?.id || "none";
    return `${contextId}:${input}`;
  }

  private getCached(key: string): TravelIntent | null {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return null;

    if (Date.now() - timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key) || null;
  }

  private setCache(key: string, intent: TravelIntent): void {
    this.cache.set(key, intent);
    this.cacheTimestamps.set(key, Date.now());

    // Cleanup old entries if cache is too large
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.cacheTimestamps.delete(oldestKey);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Response Helpers
  // ─────────────────────────────────────────────────────────────

  private successResponse<T>(data: T, startTime: number): AgentResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        processingTime: Date.now() - startTime,
        model: "IntentParserAgent-v1",
      },
    };
  }

  private errorResponse<T>(
    code: string,
    message: string,
    startTime: number,
  ): AgentResponse<T> {
    return {
      success: false,
      error: { code, message },
      metadata: {
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────

export const intentParser = IntentParserAgent.getInstance();
export default IntentParserAgent;
