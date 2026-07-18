/**
 * useTripsFeatures Hook - Dynamic Feature Management
 * Handles feature loading, filtering, and recommendations
 */

import { useMemo, useCallback, useEffect } from 'react';
import { useTripsStore } from '@/stores/tripsStore';
import { useUserBehaviorStore } from '@/stores/userBehaviorStore';
import { 
  FeatureConfig, 
  FeatureCategory, 
  FeatureRecommendation 
} from '@/components/Trips/types';
import { 
  FEATURE_CONFIGS, 
  getActiveFeatures, 
  getFeaturesByCategory,
  CATEGORY_CONFIG 
} from '@/components/Trips/featureConfig';

// ─────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────

export const useTripsFeatures = () => {
  const { 
    recentlyUsed, 
    favorites, 
    selectedCategory,
    isLoading,
    setLoading,
    trackFeatureClick,
  } = useTripsStore();

  const { getTopCategories } = useUserBehaviorStore();

  // Initialize features
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [setLoading]);

  // Get filtered features based on selected category
  const filteredFeatures = useMemo(() => {
    if (selectedCategory === 'all') {
      return getActiveFeatures();
    }
    return getFeaturesByCategory(selectedCategory);
  }, [selectedCategory]);

  // Get recent features
  const recentFeatures = useMemo(() => {
    return recentlyUsed
      .map(id => FEATURE_CONFIGS.find(f => f.id === id))
      .filter((f): f is FeatureConfig => f !== undefined && f.status === 'active');
  }, [recentlyUsed]);

  // Get favorite features
  const favoriteFeatures = useMemo(() => {
    return favorites
      .map(id => FEATURE_CONFIGS.find(f => f.id === id))
      .filter((f): f is FeatureConfig => f !== undefined && f.status === 'active');
  }, [favorites]);

  // Check if feature is favorite
  const isFavorite = useCallback((featureId: string) => {
    return favorites.includes(featureId);
  }, [favorites]);

  // Get category config
  const getCategoryConfig = useCallback((category: FeatureCategory) => {
    return CATEGORY_CONFIG[category];
  }, []);

  // Get categories with feature counts
  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    FEATURE_CONFIGS.forEach(f => {
      if (f.status !== 'disabled') {
        counts[f.category] = (counts[f.category] || 0) + 1;
      }
    });
    
    return Object.entries(CATEGORY_CONFIG).map(([key, config]) => ({
      key: key as FeatureCategory,
      ...config,
      count: counts[key] || 0,
    }));
  }, []);

  return {
    features: filteredFeatures,
    recentFeatures,
    favoriteFeatures,
    isLoading,
    isFavorite,
    getCategoryConfig,
    categoriesWithCounts,
    trackFeatureClick,
  };
};

// ─────────────────────────────────────────────────────────────
// RECOMMENDATIONS HOOK
// ─────────────────────────────────────────────────────────────

export const useFeatureRecommendations = () => {
  const { recentlyUsed } = useTripsStore();
  const { getTopCategories, level } = useUserBehaviorStore();

  const recommendations = useMemo((): FeatureRecommendation[] => {
    const recs: FeatureRecommendation[] = [];
    const topCategories = getTopCategories(3);
    const hour = new Date().getHours();

    // Time-based recommendations
    if (hour >= 6 && hour < 12) {
      const itinerary = FEATURE_CONFIGS.find(f => f.id === 'Itinerary');
      if (itinerary) {
        recs.push({
          feature: itinerary,
          score: 90,
          reason: 'Perfect time to plan your day!',
          context: 'time_based',
        });
      }
    }

    if (hour >= 18 && hour < 22) {
      const journal = FEATURE_CONFIGS.find(f => f.id === 'TravelJournal');
      if (journal) {
        recs.push({
          feature: journal,
          score: 85,
          reason: 'Document your travel memories',
          context: 'time_based',
        });
      }
    }

    // Behavior-based recommendations
    topCategories.forEach((pref, index) => {
      const categoryFeatures = getFeaturesByCategory(pref.category as FeatureCategory);
      const unusedFeature = categoryFeatures.find(f => !recentlyUsed.includes(f.id));
      
      if (unusedFeature) {
        recs.push({
          feature: unusedFeature,
          score: 80 - (index * 10),
          reason: `Based on your ${pref.category} interests`,
          context: 'behavior_based',
        });
      }
    });

    // Popular features (for new users)
    if (level.level <= 2) {
      const popular = ['TripWorkspace', 'Itinerary', 'Budget', 'Packing'];
      popular.forEach(id => {
        const feature = FEATURE_CONFIGS.find(f => f.id === id);
        if (feature && !recentlyUsed.includes(id)) {
          recs.push({
            feature,
            score: 70,
            reason: 'Popular with travelers',
            context: 'popular',
          });
        }
      });
    }

    // Seasonal recommendations
    const month = new Date().getMonth();
    if (month >= 4 && month <= 6) { // Summer
      const places = FEATURE_CONFIGS.find(f => f.id === 'Places');
      if (places) {
        recs.push({
          feature: places,
          score: 75,
          reason: 'Summer travel season',
          context: 'seasonal',
        });
      }
    }

    // Remove duplicates and sort by score
    const unique = recs.filter((rec, index, self) => 
      index === self.findIndex(r => r.feature.id === rec.feature.id)
    );

    return unique.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [recentlyUsed, getTopCategories, level.level]);

  return recommendations;
};

// ─────────────────────────────────────────────────────────────
// QUICK ACTIONS HOOK
// ─────────────────────────────────────────────────────────────

export const useQuickActions = () => {
  const quickActions = useMemo(() => {
    const actions = [];
    const hour = new Date().getHours();

    // Resume trip (if there's an upcoming trip)
    actions.push({
      id: 'resume_trip',
      type: 'resume_trip' as const,
      title: 'Continue Planning',
      subtitle: 'Your Goa trip awaits',
      icon: 'arrow-forward',
      emoji: '▶️',
      urgency: 'high' as const,
    });

    // Time-based actions
    if (hour >= 8 && hour < 12) {
      actions.push({
        id: 'check_weather',
        type: 'check_weather' as const,
        title: 'Check Weather',
        subtitle: 'Plan your outfit',
        icon: 'sunny',
        emoji: '☀️',
        urgency: 'low' as const,
      });
    }

    // Common actions
    actions.push({
      id: 'add_expense',
      type: 'add_expense' as const,
      title: 'Add Expense',
      subtitle: 'Track your spending',
      icon: 'wallet',
      emoji: '💵',
      urgency: 'medium' as const,
    });

    actions.push({
      id: 'add_note',
      type: 'add_note' as const,
      title: 'Quick Note',
      subtitle: 'Capture a moment',
      icon: 'create',
      emoji: '✏️',
      urgency: 'low' as const,
    });

    return actions;
  }, []);

  return quickActions;
};

// ─────────────────────────────────────────────────────────────
// GREETING HOOK
// ─────────────────────────────────────────────────────────────

export const usePersonalizedGreeting = () => {
  const { level, streak } = useUserBehaviorStore();

  return useMemo(() => {
    const hour = new Date().getHours();
    let greeting = 'Hello';
    let emoji = '👋';

    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning';
      emoji = '🌅';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
      emoji = '☀️';
    } else if (hour >= 17 && hour < 21) {
      greeting = 'Good evening';
      emoji = '🌆';
    } else {
      greeting = 'Night owl?';
      emoji = '🌙';
    }

    // Add streak message
    let streakMessage = '';
    if (streak.current >= 7) {
      streakMessage = `🔥 ${streak.current} day streak!`;
    }

    // Level-based message
    const levelMessage = level.level >= 5 
      ? `Level ${level.level} ${level.title}` 
      : level.title;

    return {
      greeting,
      emoji,
      streakMessage,
      levelMessage,
      xpProgress: (level.xp / level.xpToNext) * 100,
    };
  }, [level, streak]);
};

export default useTripsFeatures;