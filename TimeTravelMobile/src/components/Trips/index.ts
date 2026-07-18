/**
 * Trips Components - Barrel Export
 * Production-grade modular exports
 */

// Types
export type {
  FeatureCategory,
  FeatureStatus,
  FeatureBadge,
  FeatureRoute,
  FeatureConfig,
  QuickActionType,
  QuickAction,
  UpcomingTrip,
  TravelProgress,
  FeatureRecommendation,
  TripsState,
  FeatureClickEvent,
  FeatureUsageStats,
} from './types';

// Components
export { default as FeatureCard, FeatureCardSkeleton } from './FeatureCard';

// Configuration
export { FEATURE_CONFIGS, CATEGORY_CONFIG, getFeatureById, getFeaturesByCategory } from './featureConfig';
