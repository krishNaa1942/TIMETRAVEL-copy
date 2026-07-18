/**
 * usePlaces Hook - AI-Powered Place Discovery Engine
 * Handles fetching, scoring, filtering, and caching of places
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { placesService, Place } from '@/services/places';
import { useDebounce } from '@/hooks/useDebounce';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface EnhancedPlace extends Place {
  aiScore: number;
  aiReason: string;
  distanceKm: number;
  etaMinutes: number | null;
  popularityLevel: 'low' | 'medium' | 'high';
  timeFit: boolean;
}

export interface PlaceFilters {
  maxDistance: number; // km
  minRating: number;
  priceLevel: number[]; // 1-4
  openNow: boolean;
  categories: string[];
}

export interface UsePlacesReturn {
  places: EnhancedPlace[];
  rawPlaces: Place[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  filters: PlaceFilters;
  setFilters: (filters: Partial<PlaceFilters>) => void;
  search: (lat: number, lon: number, situation: string) => Promise<void>;
  refresh: () => Promise<void>;
  selectedPlace: EnhancedPlace | null;
  selectPlace: (place: EnhancedPlace | null) => void;
  serviceAvailable: boolean;
  isOffline: boolean;
  clearFilters: () => void;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const PLACES_CACHE_KEY = '@places_cache';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const USER_PREFS_KEY = '@user_place_preferences';

const DEFAULT_FILTERS: PlaceFilters = {
  maxDistance: 50,
  minRating: 0,
  priceLevel: [1, 2, 3, 4],
  openNow: false,
  categories: [],
};

// Situation weights for AI scoring
const SITUATION_WEIGHTS: Record<string, Record<string, number>> = {
  exploring: { rating: 0.4, distance: 0.2, popularity: 0.3, timeFit: 0.1 },
  hungry: { rating: 0.3, distance: 0.4, popularity: 0.1, timeFit: 0.2 },
  relaxing: { rating: 0.3, distance: 0.2, popularity: 0.2, timeFit: 0.3 },
  shopping: { rating: 0.2, distance: 0.3, popularity: 0.3, timeFit: 0.2 },
  nightlife: { rating: 0.3, distance: 0.2, popularity: 0.4, timeFit: 0.1 },
  family: { rating: 0.3, distance: 0.3, popularity: 0.2, timeFit: 0.2 },
  emergency: { rating: 0.1, distance: 0.7, popularity: 0.0, timeFit: 0.2 },
};

// Category keywords for situation matching
const SITUATION_CATEGORIES: Record<string, string[]> = {
  exploring: ['landmark', 'museum', 'temple', 'park', 'monument', 'attraction', 'historic', 'viewpoint'],
  hungry: ['restaurant', 'cafe', 'food', 'bakery', 'diner', 'eatery', 'bar'],
  relaxing: ['spa', 'park', 'beach', 'resort', 'garden', 'yoga', 'wellness'],
  shopping: ['shop', 'store', 'market', 'mall', 'boutique', 'souvenir'],
  nightlife: ['bar', 'club', 'pub', 'lounge', 'nightclub', 'live music'],
  family: ['park', 'zoo', 'aquarium', 'amusement', 'playground', 'museum'],
  emergency: ['hospital', 'pharmacy', 'clinic', 'police', 'embassy'],
};

// Time-based recommendations
const TIME_RECOMMENDATIONS = {
  morning: { categories: ['cafe', 'bakery', 'park', 'temple'], situation: 'exploring' },
  afternoon: { categories: ['restaurant', 'museum', 'shopping'], situation: 'exploring' },
  evening: { categories: ['restaurant', 'bar', 'viewpoint'], situation: 'relaxing' },
  night: { categories: ['bar', 'club', 'restaurant'], situation: 'nightlife' },
};

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const estimateETA = (distanceKm: number): number => {
  // Average walking speed 5 km/h, driving 30 km/h in city
  const walkingSpeed = 5;
  const drivingSpeed = 30;
  
  if (distanceKm < 2) {
    return Math.round((distanceKm / walkingSpeed) * 60); // Walking
  }
  return Math.round((distanceKm / drivingSpeed) * 60); // Driving
};

const getPopularityLevel = (rating?: number, popularity?: number): 'low' | 'medium' | 'high' => {
  if (!rating) return 'low';
  if (rating >= 4.5 && (popularity || 0) > 100) return 'high';
  if (rating >= 4.0) return 'medium';
  return 'low';
};

const checkTimeFit = (place: Place, situation: string): boolean => {
  const timeOfDay = getTimeOfDay();
  const category = (place.category || '').toLowerCase();
  
  // Check if place matches time-appropriate categories
  const timeCategories = TIME_RECOMMENDATIONS[timeOfDay].categories;
  return timeCategories.some(tc => category.includes(tc));
};

const generateAIReason = (place: EnhancedPlace, situation: string): string => {
  const reasons: string[] = [];
  
  if (place.rating && place.rating >= 4.5) {
    reasons.push('Excellent ratings');
  } else if (place.rating && place.rating >= 4.0) {
    reasons.push('Great reviews');
  }
  
  if (place.distanceKm < 1) {
    reasons.push('very close by');
  } else if (place.distanceKm < 5) {
    reasons.push('nearby');
  }
  
  if (place.is_open) {
    reasons.push('open now');
  }
  
  if (place.popularityLevel === 'high') {
    reasons.push('popular spot');
  }
  
  if (place.timeFit) {
    reasons.push('perfect for this time');
  }
  
  // Situation-specific reasons
  const situationCategories = SITUATION_CATEGORIES[situation] || [];
  const category = (place.category || '').toLowerCase();
  if (situationCategories.some(sc => category.includes(sc))) {
    reasons.push(`great for ${situation}`);
  }
  
  if (reasons.length === 0) {
    return 'Worth exploring';
  }
  
  return reasons.slice(0, 3).join(', ') + '.';
};

const calculateAIScore = (
  place: Place,
  userLat: number,
  userLon: number,
  situation: string,
  userPreferences: Record<string, number>
): { score: number; place: EnhancedPlace } => {
  const weights = SITUATION_WEIGHTS[situation] || SITUATION_WEIGHTS.exploring;
  
  // Calculate distance
  const distanceKm = place.distance 
    ? place.distance / 1000 
    : calculateDistance(userLat, userLon, place.lat, place.lon);
  
  // Normalize scores (0-1)
  const ratingScore = (place.rating || 0) / 5;
  const distanceScore = Math.max(0, 1 - (distanceKm / 50)); // 50km max
  const popularityScore = place.rating && place.rating >= 4.5 ? 1 : place.rating && place.rating >= 4 ? 0.7 : 0.4;
  const timeFitScore = checkTimeFit(place, situation) ? 1 : 0.5;
  
  // User preference boost
  const category = (place.category || '').toLowerCase();
  const prefBoost = userPreferences[category] ? Math.min(userPreferences[category] / 10, 0.2) : 0;
  
  // Open now bonus
  const openBonus = place.is_open ? 0.1 : 0;
  
  // Calculate weighted score
  const score = (
    ratingScore * weights.rating +
    distanceScore * weights.distance +
    popularityScore * weights.popularity +
    timeFitScore * weights.timeFit +
    prefBoost +
    openBonus
  ) * 100;
  
  const etaMinutes = estimateETA(distanceKm);
  const popularityLevel = getPopularityLevel(place.rating, place.popularity);
  const timeFit = checkTimeFit(place, situation);
  
  const enhancedPlace: EnhancedPlace = {
    ...place,
    aiScore: Math.round(score),
    aiReason: '',
    distanceKm: Math.round(distanceKm * 10) / 10,
    etaMinutes,
    popularityLevel,
    timeFit,
  };
  
  enhancedPlace.aiReason = generateAIReason(enhancedPlace, situation);
  
  return { score, place: enhancedPlace };
};

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function usePlaces(): UsePlacesReturn {
  const [rawPlaces, setRawPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<PlaceFilters>(DEFAULT_FILTERS);
  const [selectedPlace, setSelectedPlace] = useState<EnhancedPlace | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [userPreferences, setUserPreferences] = useState<Record<string, number>>({});
  
  const lastSearchParams = useRef<{ lat: number; lon: number; situation: string } | null>(null);

  // Load user preferences on mount
  useEffect(() => {
    loadUserPreferences();
    checkServiceStatus();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const saved = await AsyncStorage.getItem(USER_PREFS_KEY);
      if (saved) {
        setUserPreferences(JSON.parse(saved));
      }
    } catch (e) {
      // Ignore
    }
  };

  const checkServiceStatus = async () => {
    try {
      const available = await placesService.checkStatus();
      setServiceAvailable(available);
    } catch (e) {
      setServiceAvailable(false);
    }
  };

  const recordInteraction = useCallback(async (place: Place) => {
    const category = (place.category || '').toLowerCase();
    const newPrefs = { ...userPreferences };
    newPrefs[category] = (newPrefs[category] || 0) + 1;
    setUserPreferences(newPrefs);
    
    try {
      await AsyncStorage.setItem(USER_PREFS_KEY, JSON.stringify(newPrefs));
    } catch (e) {
      // Ignore
    }
  }, [userPreferences]);

  const loadCachedPlaces = async (cacheKey: string): Promise<Place[] | null> => {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          return data;
        }
      }
    } catch (e) {
      // Ignore
    }
    return null;
  };

  const search = useCallback(async (lat: number, lon: number, situation: string) => {
    setLoading(true);
    setError(null);
    lastSearchParams.current = { lat, lon, situation };
    
    const cacheKey = `${PLACES_CACHE_KEY}_${situation}_${Math.round(lat)}_${Math.round(lon)}`;
    
    try {
      // Try cache first
      const cached = await loadCachedPlaces(cacheKey);
      if (cached) {
        setRawPlaces(cached);
        setLoading(false);
        return;
      }
      
      // Fetch from API
      const response = await placesService.recommend(lat, lon, situation);
      const places = response.places || [];
      
      setRawPlaces(places);
      setIsOffline(false);
      
      // Cache results
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data: places,
        timestamp: Date.now(),
      }));
    } catch (e: any) {
      // Try to load cached data
      const cached = await loadCachedPlaces(PLACES_CACHE_KEY);
      if (cached) {
        setRawPlaces(cached);
        setIsOffline(true);
        setError('Using cached data. Check your connection.');
      } else {
        setError(e.message || 'Failed to load places');
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!lastSearchParams.current) return;
    
    setRefreshing(true);
    const { lat, lon, situation } = lastSearchParams.current;
    
    // Clear cache for fresh data
    const cacheKey = `${PLACES_CACHE_KEY}_${situation}_${Math.round(lat)}_${Math.round(lon)}`;
    await AsyncStorage.removeItem(cacheKey);
    
    await search(lat, lon, situation);
    setRefreshing(false);
  }, [search]);

  const setFilters = useCallback((newFilters: Partial<PlaceFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const selectPlace = useCallback((place: EnhancedPlace | null) => {
    setSelectedPlace(place);
    if (place) {
      recordInteraction(place);
    }
  }, [recordInteraction]);

  // Apply AI scoring and filters
  const places = useMemo(() => {
    if (!lastSearchParams.current) return [];
    
    const { lat, lon, situation } = lastSearchParams.current;
    
    // Calculate AI scores
    const scoredPlaces = rawPlaces.map(place => 
      calculateAIScore(place, lat, lon, situation, userPreferences)
    );
    
    // Sort by AI score
    scoredPlaces.sort((a, b) => b.score - a.score);
    
    // Apply filters
    let filtered = scoredPlaces.map(sp => sp.place);
    
    if (filters.maxDistance < 50) {
      filtered = filtered.filter(p => p.distanceKm <= filters.maxDistance);
    }
    
    if (filters.minRating > 0) {
      filtered = filtered.filter(p => (p.rating || 0) >= filters.minRating);
    }
    
    if (filters.priceLevel.length < 4) {
      filtered = filtered.filter(p => {
        if (!p.price_level) return true;
        const priceNum = typeof p.price_level === 'string' 
          ? p.price_level.length 
          : p.price_level;
        return filters.priceLevel.includes(priceNum);
      });
    }
    
    if (filters.openNow) {
      filtered = filtered.filter(p => p.is_open === true);
    }
    
    if (filters.categories.length > 0) {
      filtered = filtered.filter(p => {
        const category = (p.category || '').toLowerCase();
        return filters.categories.some(c => category.includes(c.toLowerCase()));
      });
    }
    
    return filtered;
  }, [rawPlaces, filters, userPreferences]);

  return {
    places,
    rawPlaces,
    loading,
    refreshing,
    error,
    filters,
    setFilters,
    search,
    refresh,
    selectedPlace,
    selectPlace,
    serviceAvailable,
    isOffline,
    clearFilters,
  };
}