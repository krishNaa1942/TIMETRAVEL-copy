/**
 * Feature Configuration - Dynamic Config-Driven System
 * Supports 50+ features with remote config capability
 */

import { FeatureConfig, FeatureCategory } from './types';

// ─────────────────────────────────────────────────────────────
// FEATURE DEFINITIONS
// ─────────────────────────────────────────────────────────────

export const FEATURE_CONFIGS: FeatureConfig[] = [
  // ═══════════════════════════════════════════════════════════
  // PLANNING FEATURES
  // ═══════════════════════════════════════════════════════════
  {
    id: 'TripWorkspace',
    title: 'Trip Workspace',
    description: 'Plan itineraries, add places & maps day-by-day.',
    emoji: '🗂️',
    category: 'planning',
    status: 'active',
    screen: 'TripWorkspace',
    gradient: ['#667EEA', '#764BA2'],
    accentColor: '#667EEA',
    analyticsEvent: 'trip_workspace_opened',
    analyticsCategory: 'planning',
    weight: 100,
    tags: ['planning', 'itinerary', 'maps', 'popular'],
  },
  {
    id: 'Itinerary',
    title: 'Smart Itinerary',
    description: 'AI-powered day-by-day trip planning.',
    emoji: '📅',
    category: 'planning',
    status: 'active',
    screen: 'Itinerary',
    gradient: ['#11998E', '#38EF7D'],
    accentColor: '#11998E',
    badge: { text: 'AI', color: '#FFFFFF', backgroundColor: '#10B981' },
    analyticsEvent: 'itinerary_opened',
    analyticsCategory: 'planning',
    weight: 95,
    tags: ['planning', 'ai', 'itinerary', 'smart'],
  },
  {
    id: 'Budget',
    title: 'Budget Planner',
    description: 'Estimate and track your trip expenses.',
    emoji: ' 💰',
    category: 'planning',
    status: 'active',
    screen: 'Budget',
    gradient: ['#F093FB', '#F5576C'],
    accentColor: '#F5576C',
    analyticsEvent: 'budget_opened',
    analyticsCategory: 'planning',
    weight: 90,
    tags: ['planning', 'budget', 'expenses'],
  },
  {
    id: 'Packing',
    title: 'Smart Packing',
    description: 'AI-generated packing lists for your trip.',
    emoji: '🎒',
    category: 'planning',
    status: 'active',
    screen: 'Packing',
    gradient: ['#4FACFE', '#00F2FE'],
    accentColor: '#4FACFE',
    analyticsEvent: 'packing_opened',
    analyticsCategory: 'planning',
    weight: 85,
    tags: ['planning', 'packing', 'ai'],
  },
  {
    id: 'TripPlanner',
    title: 'Trip Designer',
    description: 'Create complete trips from scratch.',
    emoji: '✨',
    category: 'planning',
    status: 'active',
    screen: 'TripPlanner',
    gradient: ['#FA709A', '#FEE140'],
    accentColor: '#FA709A',
    badge: { text: 'NEW', color: '#FFFFFF', backgroundColor: '#F59E0B' },
    analyticsEvent: 'trip_planner_opened',
    analyticsCategory: 'planning',
    weight: 88,
    tags: ['planning', 'create', 'designer'],
  },

  // ═══════════════════════════════════════════════════════════
  // MANAGEMENT FEATURES
  // ═══════════════════════════════════════════════════════════
  {
    id: 'Reservations',
    title: 'Reservations',
    description: 'Manage flights, hotels, and booking codes.',
    emoji: '🎫',
    category: 'management',
    status: 'active',
    screen: 'Reservations',
    gradient: ['#A18CD1', '#FBC2EB'],
    accentColor: '#A18CD1',
    analyticsEvent: 'reservations_opened',
    analyticsCategory: 'management',
    weight: 92,
    tags: ['management', 'bookings', 'flights', 'hotels'],
  },
  {
    id: 'Expenses',
    title: 'Expense Tracker',
    description: 'Log daily spending and balance your budget.',
    emoji: '💵',
    category: 'management',
    status: 'active',
    screen: 'Expenses',
    gradient: ['#96E6A1', '#D4FC79'],
    accentColor: '#96E6A1',
    analyticsEvent: 'expenses_opened',
    analyticsCategory: 'management',
    weight: 87,
    tags: ['management', 'expenses', 'tracking'],
  },
  {
    id: 'TripSharing',
    title: 'Collaborate & Share',
    description: 'Generate secure links for friends and family.',
    emoji: '🔗',
    category: 'management',
    status: 'active',
    screen: 'TripSharing',
    gradient: ['#84FAB0', '#8FD3F4'],
    accentColor: '#84FAB0',
    analyticsEvent: 'trip_sharing_opened',
    analyticsCategory: 'management',
    weight: 75,
    tags: ['management', 'sharing', 'collaboration'],
  },

  // ═══════════════════════════════════════════════════════════
  // SOCIAL FEATURES
  // ═══════════════════════════════════════════════════════════
  {
    id: 'TravelJournal',
    title: 'Travel Journal',
    description: 'Write notes, attach photos, share with community.',
    emoji: '📔',
    category: 'social',
    status: 'active',
    screen: 'TravelJournal',
    gradient: ['#FFC3A0', '#FFAFBD'],
    accentColor: '#FFC3A0',
    analyticsEvent: 'travel_journal_opened',
    analyticsCategory: 'social',
    weight: 82,
    tags: ['social', 'journal', 'memories', 'photos'],
  },
  {
    id: 'NewsFeed',
    title: 'Travel Feed',
    description: 'Discover stories from fellow travelers.',
    emoji: '📰',
    category: 'social',
    status: 'active',
    screen: 'NewsFeed',
    gradient: ['#D299C2', '#FEF9D7'],
    accentColor: '#D299C2',
    analyticsEvent: 'news_feed_opened',
    analyticsCategory: 'social',
    weight: 70,
    tags: ['social', 'feed', 'community'],
  },

  // ═══════════════════════════════════════════════════════════
  // TRACKING FEATURES
  // ═══════════════════════════════════════════════════════════
  {
    id: 'TravelStats',
    title: 'Travel Stats',
    description: 'View your globetrotter analytics & spending charts.',
    emoji: '📊',
    category: 'tracking',
    status: 'active',
    screen: 'TravelStats',
    gradient: ['#5EE7DF', '#B490CA'],
    accentColor: '#5EE7DF',
    analyticsEvent: 'travel_stats_opened',
    analyticsCategory: 'tracking',
    weight: 78,
    tags: ['tracking', 'stats', 'analytics'],
  },
  {
    id: 'TravelIntelligence',
    title: 'AI Travel Coach',
    description: 'Personalized insights and recommendations.',
    emoji: '🤖',
    category: 'tracking',
    status: 'active',
    screen: 'TravelIntelligence',
    gradient: ['#6A11CB', '#2575FC'],
    accentColor: '#6A11CB',
    badge: { text: 'PRO', color: '#FFFFFF', backgroundColor: '#8B5CF6' },
    isPremium: true,
    analyticsEvent: 'travel_intelligence_opened',
    analyticsCategory: 'tracking',
    weight: 80,
    tags: ['tracking', 'ai', 'insights', 'premium'],
  },

  // ═══════════════════════════════════════════════════════════
  // TOOLS FEATURES
  // ═══════════════════════════════════════════════════════════
  {
    id: 'Currency',
    title: 'Currency Converter',
    description: 'Real-time exchange rates and calculator.',
    emoji: '💱',
    category: 'tools',
    status: 'active',
    screen: 'Currency',
    gradient: ['#FFD89B', '#19547B'],
    accentColor: '#19547B',
    analyticsEvent: 'currency_opened',
    analyticsCategory: 'tools',
    weight: 72,
    tags: ['tools', 'currency', 'converter'],
  },
  {
    id: 'Phrasebook',
    title: 'Phrasebook',
    description: 'Essential phrases for your destination.',
    emoji: '🗣️',
    category: 'tools',
    status: 'active',
    screen: 'Phrasebook',
    gradient: ['#FDDB92', '#D1FDFF'],
    accentColor: '#FDDB92',
    analyticsEvent: 'phrasebook_opened',
    analyticsCategory: 'tools',
    weight: 65,
    tags: ['tools', 'language', 'phrases'],
  },
  {
    id: 'RoutePlanner',
    title: 'Route Planner',
    description: 'Optimize your travel routes between cities.',
    emoji: '🗺️',
    category: 'tools',
    status: 'active',
    screen: 'RoutePlanner',
    gradient: ['#3F5EFB', '#FC466B'],
    accentColor: '#3F5EFB',
    analyticsEvent: 'route_planner_opened',
    analyticsCategory: 'tools',
    weight: 68,
    tags: ['tools', 'route', 'navigation'],
  },

  // ═══════════════════════════════════════════════════════════
  // INSIGHTS FEATURES
  // ═══════════════════════════════════════════════════════════
  {
    id: 'Places',
    title: 'Discover Places',
    description: 'Find restaurants, attractions, and hidden gems.',
    emoji: '📍',
    category: 'insights',
    status: 'active',
    screen: 'Places',
    gradient: ['#F77062', '#FE5196'],
    accentColor: '#F77062',
    analyticsEvent: 'places_opened',
    analyticsCategory: 'insights',
    weight: 85,
    tags: ['insights', 'places', 'discover', 'restaurants'],
  },
  {
    id: 'Compare',
    title: 'Compare Destinations',
    description: 'Side-by-side destination comparison.',
    emoji: '⚖️',
    category: 'insights',
    status: 'active',
    screen: 'Compare',
    gradient: ['#7F7FD5', '#86A8E7'],
    accentColor: '#7F7FD5',
    analyticsEvent: 'compare_opened',
    analyticsCategory: 'insights',
    weight: 60,
    tags: ['insights', 'compare', 'destinations'],
  },

  // ═══════════════════════════════════════════════════════════
  // PREMIUM FEATURES
  // ═══════════════════════════════════════════════════════════
  {
    id: 'OfflineMaps',
    title: 'Offline Maps',
    description: 'Download maps for offline access anywhere.',
    emoji: '📥',
    category: 'premium',
    status: 'premium',
    screen: 'OfflineMaps',
    gradient: ['#373B44', '#4286F4'],
    accentColor: '#4286F4',
    badge: { text: 'PRO', color: '#FFFFFF', backgroundColor: '#8B5CF6' },
    isPremium: true,
    isOffline: true,
    analyticsEvent: 'offline_maps_opened',
    analyticsCategory: 'premium',
    weight: 55,
    tags: ['premium', 'offline', 'maps'],
  },
  {
    id: 'TripHistory',
    title: 'Trip Archive',
    description: 'Access your complete travel history.',
    emoji: '📚',
    category: 'insights',
    status: 'active',
    screen: 'TripHistory',
    gradient: ['#8E2DE2', '#4A00E0'],
    accentColor: '#8E2DE2',
    analyticsEvent: 'trip_history_opened',
    analyticsCategory: 'insights',
    weight: 50,
    tags: ['insights', 'history', 'archive'],
  },
  {
    id: 'TravelInsurance',
    title: 'Travel Insurance',
    description: 'Get coverage for your adventures.',
    emoji: '🛡️',
    category: 'premium',
    status: 'coming_soon',
    screen: 'TravelInsurance',
    gradient: ['#1A2980', '#26D0CE'],
    accentColor: '#26D0CE',
    badge: { text: 'SOON', color: '#FFFFFF', backgroundColor: '#6B7280' },
    isPremium: true,
    analyticsEvent: 'travel_insurance_viewed',
    analyticsCategory: 'premium',
    weight: 45,
    tags: ['premium', 'insurance', 'safety'],
  },
  {
    id: 'FlightTracker',
    title: 'Flight Tracker',
    description: 'Real-time flight status and alerts.',
    emoji: '✈️',
    category: 'premium',
    status: 'coming_soon',
    screen: 'FlightTracker',
    gradient: ['#00B4DB', '#0083B0'],
    accentColor: '#00B4DB',
    badge: { text: 'SOON', color: '#FFFFFF', backgroundColor: '#6B7280' },
    isPremium: true,
    analyticsEvent: 'flight_tracker_viewed',
    analyticsCategory: 'premium',
    weight: 48,
    tags: ['premium', 'flights', 'tracking'],
  },
];

// ─────────────────────────────────────────────────────────────
// CATEGORY CONFIGURATION
// ─────────────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<FeatureCategory, { label: string; emoji: string; color: string }> = {
  planning: { label: 'Planning', emoji: '📋', color: '#667EEA' },
  management: { label: 'Management', emoji: '⚙️', color: '#A18CD1' },
  tracking: { label: 'Tracking', emoji: '📊', color: '#5EE7DF' },
  social: { label: 'Social', emoji: '👥', color: '#FFC3A0' },
  tools: { label: 'Tools', emoji: '🛠️', color: '#19547B' },
  insights: { label: 'Insights', emoji: '💡', color: '#F77062' },
  premium: { label: 'Premium', emoji: '⭐', color: '#8B5CF6' },
};

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

export const getFeaturesByCategory = (category: FeatureCategory): FeatureConfig[] => {
  return FEATURE_CONFIGS.filter(f => f.category === category && f.status !== 'disabled');
};

export const getActiveFeatures = (): FeatureConfig[] => {
  return FEATURE_CONFIGS.filter(f => f.status === 'active' || f.status === 'beta');
};

export const getFeatureById = (id: string): FeatureConfig | undefined => {
  return FEATURE_CONFIGS.find(f => f.id === id);
};

export const getFeaturesByIds = (ids: string[]): FeatureConfig[] => {
  return ids.map(id => getFeatureById(id)).filter((f): f is FeatureConfig => f !== undefined);
};

export const searchFeatures = (query: string): FeatureConfig[] => {
  const lowerQuery = query.toLowerCase();
  return FEATURE_CONFIGS.filter(f => 
    f.title.toLowerCase().includes(lowerQuery) ||
    f.description.toLowerCase().includes(lowerQuery) ||
    f.tags.some(tag => tag.includes(lowerQuery))
  );
};

export const getFeatureCategories = (): FeatureCategory[] => {
  return Object.keys(CATEGORY_CONFIG) as FeatureCategory[];
};