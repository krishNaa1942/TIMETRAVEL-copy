/**
 * Profile Feature Types
 * Type definitions for the Profile feature module
 */

// ─────────────────────────────────────────────────────────────
// USER PROFILE TYPES
// ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  avatar?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileUpdatePayload {
  name: string;
  email: string;
}

export interface ProfileValidationErrors {
  name?: string;
  email?: string;
}

// ─────────────────────────────────────────────────────────────
// TRAVEL STATS TYPES
// ─────────────────────────────────────────────────────────────

export interface TripStats {
  total: number;
  active: number;
  completed: number;
  upcoming: number;
}

export interface TravelStats {
  trips: TripStats;
  favorites_count: number;
  places_visited: number;
  total_spent: number;
  top_destinations: TopDestination[];
  travel_days?: number;
  countries_visited?: number;
}

export interface TopDestination {
  id: string;
  name: string;
  visits: number;
  last_visited?: string;
}

// ─────────────────────────────────────────────────────────────
// TRAVEL DNA TYPES
// ─────────────────────────────────────────────────────────────

export type TravelTrait =
  | "explorer"
  | "foodie"
  | "luxury"
  | "adventure"
  | "culture"
  | "relaxation"
  | "budget"
  | "social";

export interface TravelDNA {
  explorer: number;
  foodie: number;
  luxury: number;
  adventure: number;
  culture: number;
  relaxation: number;
  budget: number;
  social: number;
}

export interface PersonalityConfig {
  icon: string;
  color: string;
  label: string;
  description: string;
}

export type PersonalityConfigMap = Record<TravelTrait, PersonalityConfig>;

// ─────────────────────────────────────────────────────────────
// XP & LEVEL TYPES
// ─────────────────────────────────────────────────────────────

export interface UserLevel {
  level: number;
  xp: number;
  xpToNext: number;
  title: string;
  progress: number;
}

export interface UserStreak {
  current: number;
  longest: number;
  lastActivity: string | null;
}

// ─────────────────────────────────────────────────────────────
// INSIGHTS TYPES
// ─────────────────────────────────────────────────────────────

export interface AIInsight {
  id: string;
  type: "achievement" | "suggestion" | "trend" | "reminder";
  icon: string;
  message: string;
  actionable?: boolean;
  actionLabel?: string;
  actionRoute?: string;
}

// ─────────────────────────────────────────────────────────────
// SMART ACTION TYPES
// ─────────────────────────────────────────────────────────────

export interface SmartAction {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  route?: string;
  onPress?: () => void;
  priority: number;
  visible: boolean;
}

// ─────────────────────────────────────────────────────────────
// QUICK ACTION TYPES
// ─────────────────────────────────────────────────────────────

export interface QuickAction {
  id: string;
  icon: string;
  label: string;
  count: number | null;
  route?: string;
  onPress?: () => void;
}

// ─────────────────────────────────────────────────────────────
// SETTINGS TYPES
// ─────────────────────────────────────────────────────────────

export interface SettingItem {
  id: string;
  icon: string;
  label: string;
  type: "toggle" | "link" | "button";
  value?: boolean;
  onPress?: () => void;
  route?: string;
}

export interface PreferenceSettings {
  darkMode: boolean;
  tripAlerts: boolean;
  priceAlerts: boolean;
  pushNotifications: boolean;
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS TYPES
// ─────────────────────────────────────────────────────────────

export interface ProfileAnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
}

export type ProfileEventType =
  | "screen_view"
  | "edit_profile"
  | "logout"
  | "smart_action_click"
  | "quick_action_click"
  | "setting_toggle"
  | "refresh";

// ─────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────

export interface ProfileAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StatsAPIResponse {
  stats: TravelStats;
}

export interface ProfileSummary {
  profile: UserProfile;
  stats: TravelStats;
  preferences: Record<string, unknown>;
  summary: string | null;
  summaryMeta: Record<string, unknown>;
  level: UserLevel;
  travelDNA: TravelDNA;
  personality: PersonalityConfig;
  insights: AIInsight[];
  smartActions: SmartAction[];
  quickActions: QuickAction[];
  generatedAt?: string | null;
}

export interface ProfileSummaryAPIResponse {
  success: boolean;
  data?: ProfileSummary;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT PROP TYPES
// ─────────────────────────────────────────────────────────────

export interface ProfileHeaderProps {
  user: UserProfile | null;
  level?: UserLevel;
  summary?: string | null;
  onEditProfile?: () => void;
}

export interface XPProgressCardProps {
  level: UserLevel;
  animated?: boolean;
}

export interface TravelDNACardProps {
  dna: TravelDNA;
  personality: PersonalityConfig;
}

export interface InsightsCardProps {
  insights: AIInsight[];
  onInsightPress?: (insight: AIInsight) => void;
}

export interface SmartActionsProps {
  actions: SmartAction[];
  onActionPress: (action: SmartAction) => void;
}

export interface QuickActionsGridProps {
  actions: QuickAction[];
  onActionPress: (action: QuickAction) => void;
}

export interface SettingsSectionProps {
  settings: SettingItem[];
  onToggle: (id: string, value: boolean) => void;
}

export interface SkeletonLoaderProps {
  visible: boolean;
}

export interface ErrorStateProps {
  error: Error | string | null;
  onRetry: () => void;
}

// ─────────────────────────────────────────────────────────────
// STORE TYPES
// ─────────────────────────────────────────────────────────────

export interface ProfileState {
  isEditing: boolean;
  setEditing: (value: boolean) => void;

  editedName: string;
  setEditedName: (value: string) => void;

  editedEmail: string;
  setEditedEmail: (value: string) => void;

  preferences: PreferenceSettings;
  updatePreference: <K extends keyof PreferenceSettings>(
    key: K,
    value: PreferenceSettings[K],
  ) => void;

  reset: () => void;
}

export interface ProfileStore extends ProfileState {}
