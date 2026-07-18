/**
 * useChatAgent - Intelligent AI Travel Agent Hook
 * Provides conversational intelligence, intent detection, and smart suggestions
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { chatService } from "@/services/chat";
import { ChatMessage } from "@/types";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type DetectedIntent = 
  | "budget" 
  | "itinerary" 
  | "safety" 
  | "places" 
  | "weather" 
  | "transport" 
  | "packing" 
  | "food" 
  | "compare" 
  | "general";

export interface SmartSuggestion {
  id: string;
  label: string;
  message: string;
  icon: string;
  action?: {
    type: "navigate" | "query";
    screen?: string;
    params?: Record<string, unknown>;
  };
}

export interface ChatAgentState {
  messages: ChatMessage[];
  isTyping: boolean;
  error: string | null;
  detectedDestination: string | null;
  detectedIntent: DetectedIntent | null;
  suggestions: SmartSuggestion[];
  sessionId: string;
}

interface UseChatAgentOptions {
  initialDestination?: string;
  maxSuggestions?: number;
}

interface UseChatAgentReturn extends ChatAgentState {
  sendMessage: (text: string) => Promise<void>;
  retryLast: () => Promise<void>;
  clearChat: () => void;
  setDestination: (dest: string | null) => void;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<DetectedIntent, string[]> = {
  budget: ["budget", "cost", "price", "expense", "money", "cheapest", "expensive", "afford", "spend", "₹", "rs", "rupees"],
  itinerary: ["itinerary", "plan", "schedule", "day wise", "trip plan", "daily", "days trip", "visit"],
  safety: ["safe", "safety", "danger", "crime", "secure", "risk", "precaution", "caution"],
  places: ["places", "visit", "see", "attractions", "spots", "sightseeing", "destinations", "explore"],
  weather: ["weather", "climate", "temperature", "rain", "hot", "cold", "season", "best time"],
  transport: ["transport", "travel", "flight", "train", "bus", "car", "route", "distance", "drive", "road trip"],
  packing: ["pack", "packing", "carry", "clothes", "luggage", "checklist", "bring", "items"],
  food: ["food", "eat", "restaurant", "cuisine", "dish", "local food", "street food", "dining"],
  compare: ["compare", "vs", "versus", "difference", "better", "which is", "or"],
  general: [],
};

const DESTINATION_PATTERNS = [
  /(?:trip to|visit|travel to|go to|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:trip|tour|travel)/gi,
];

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "bot",
  text: `👋 Hi! I'm your **AI Travel Agent**.

I can help you with:
• 📋 Trip planning & itineraries
• 💰 Budget estimates
• 🗺️ Route planning
• 🛡️ Safety assessments
• 🧳 Packing lists
• 🍽️ Food & place recommendations

**Try asking:**
"Plan a 5-day Goa trip" or "What's the budget for Kerala?"`,
  timestamp: Date.now(),
};

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function detectIntent(text: string): DetectedIntent {
  const lowerText = text.toLowerCase();
  
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === "general") continue;
    if (keywords.some(kw => lowerText.includes(kw))) {
      return intent as DetectedIntent;
    }
  }
  return "general";
}

function detectDestination(text: string): string | null {
  for (const pattern of DESTINATION_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 2) {
        return match[1].trim();
      }
    }
  }
  
  // Common Indian destinations
  const destinations = [
    "Goa", "Kerala", "Jaipur", "Udaipur", "Manali", "Shimla", "Delhi", "Mumbai",
    "Varanasi", "Agra", "Ladakh", "Meghalaya", "Darjeeling", "Rishikesh", "Mysore"
  ];
  
  for (const dest of destinations) {
    if (text.toLowerCase().includes(dest.toLowerCase())) {
      return dest;
    }
  }
  
  return null;
}

function generateSuggestions(
  intent: DetectedIntent,
  destination: string | null,
  lastMessage: string
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  const dest = destination || "your destination";
  
  switch (intent) {
    case "budget":
      suggestions.push(
        { id: "1", label: "View Budget Planner", message: "", icon: "calculator", action: { type: "navigate", screen: "Budget" } },
        { id: "2", label: "Get full itinerary", message: `Create a detailed day-by-day itinerary for ${dest}`, icon: "map-outline" },
        { id: "3", label: "Compare costs", message: `Compare ${dest} with similar destinations for budget`, icon: "compare" }
      );
      break;
      
    case "itinerary":
      suggestions.push(
        { id: "1", label: "Open Itinerary Planner", message: "", icon: "calendar-check", action: { type: "navigate", screen: "Itinerary" } },
        { id: "2", label: "Add to packing list", message: `What should I pack for ${dest}?`, icon: "bag-suitcase" },
        { id: "3", label: "Check weather", message: `What's the weather like in ${dest}?`, icon: "weather-partly-cloudy" }
      );
      break;
      
    case "safety":
      suggestions.push(
        { id: "1", label: "View safety tips", message: `Detailed safety guide for ${dest}`, icon: "shield-check" },
        { id: "2", label: "Emergency numbers", message: `Emergency contacts and hospitals in ${dest}`, icon: "phone" },
        { id: "3", label: "Safe areas to stay", message: `Which areas in ${dest} are safest for tourists?`, icon: "home-city" }
      );
      break;
      
    case "places":
      suggestions.push(
        { id: "1", label: "Explore places", message: "", icon: "map-marker-multiple", action: { type: "navigate", screen: "Places" } },
        { id: "2", label: "Hidden gems", message: `Show me offbeat places near ${dest}`, icon: "diamond-stone" },
        { id: "3", label: "Plan route", message: `Create a route covering all places in ${dest}`, icon: "routes" }
      );
      break;
      
    case "food":
      suggestions.push(
        { id: "1", label: "Top restaurants", message: `Best rated restaurants in ${dest}`, icon: "silverware-fork-knife" },
        { id: "2", label: "Street food guide", message: `Must try street foods in ${dest}`, icon: "food" },
        { id: "3", label: "Food itinerary", message: `Plan a food tour of ${dest}`, icon: "map" }
      );
      break;
      
    case "weather":
      suggestions.push(
        { id: "1", label: "Best time to visit", message: `When is the best season to visit ${dest}?`, icon: "calendar-range" },
        { id: "2", label: "Packing for weather", message: `What to pack for ${dest} weather?`, icon: "tshirt-crew" },
        { id: "3", label: "Seasonal tips", message: `Travel tips for ${dest} weather conditions`, icon: "lightbulb" }
      );
      break;
      
    default:
      suggestions.push(
        { id: "1", label: "Plan my trip", message: `Help me plan a complete trip to ${dest}`, icon: "airplane" },
        { id: "2", label: "Get budget estimate", message: `What's the budget for a trip to ${dest}?`, icon: "cash" },
        { id: "3", label: "Compare destinations", message: "", icon: "compare", action: { type: "navigate", screen: "Compare" } }
      );
  }
  
  return suggestions.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useChatAgent(options: UseChatAgentOptions = {}): UseChatAgentReturn {
  const { initialDestination, maxSuggestions = 4 } = options;
  
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedDestination, setDetectedDestination] = useState<string | null>(initialDestination || null);
  const [detectedIntent, setDetectedIntent] = useState<DetectedIntent | null>(null);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [sessionId] = useState(generateId());
  
  // Refs
  const lastMessageRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text: text.trim(),
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setError(null);
    lastMessageRef.current = text;
    
    // Detect intent and destination from user message
    const intent = detectIntent(text);
    const dest = detectDestination(text);
    
    setDetectedIntent(intent);
    if (dest) {
      setDetectedDestination(dest);
    }
    
    try {
      const response = await chatService.sendAgentMessage(text, sessionId, {
        destination: detectedDestination || dest || undefined,
        routeContext: "travel_agent",
      });
      
      // Add bot response
      const botMsg: ChatMessage = {
        id: generateId(),
        role: "bot",
        text: response.reply,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, botMsg]);
      
      // Detect intent from bot response for better suggestions
      const responseIntent = detectIntent(response.reply);
      const finalIntent = intent !== "general" ? intent : responseIntent;
      
      // Generate smart suggestions based on intent and destination
      const newSuggestions = generateSuggestions(
        finalIntent,
        dest || detectedDestination,
        response.reply
      );
      setSuggestions(newSuggestions);
      
    } catch (err: any) {
      if (err.name === "AbortError") return;
      
      const errorMsg = err.message || "Something went wrong. Please try again.";
      setError(errorMsg);
      
      // Add error message
      const errMsg: ChatMessage = {
        id: generateId(),
        role: "bot",
        text: `⚠️ ${errorMsg}\n\nWould you like to try again?`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, sessionId, detectedDestination]);

  // Retry last message
  const retryLast = useCallback(async () => {
    if (lastMessageRef.current) {
      // Remove last error message
      setMessages(prev => prev.slice(0, -1));
      await sendMessage(lastMessageRef.current);
    }
  }, [sendMessage]);

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setError(null);
    setDetectedIntent(null);
    setSuggestions([]);
    lastMessageRef.current = "";
  }, []);

  // Set destination
  const setDestination = useCallback((dest: string | null) => {
    setDetectedDestination(dest);
  }, []);

  return {
    messages,
    isTyping,
    error,
    detectedDestination,
    detectedIntent,
    suggestions,
    sessionId,
    sendMessage,
    retryLast,
    clearChat,
    setDestination,
  };
}

export default useChatAgent;