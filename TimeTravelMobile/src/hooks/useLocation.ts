/**
 * useLocation Hook - Real-time GPS with intelligent fallbacks
 * Handles permissions, reverse geocoding, and location tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  city: string;
  country: string;
  timestamp: number;
}

export interface UseLocationReturn {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
  getCurrentPosition: () => Promise<{ lat: number; lng: number } | null>;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

const LOCATION_CACHE_KEY = '@last_known_location';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Default fallback cities
const DEFAULT_CITIES: Record<string, { lat: number; lon: number }> = {
  "Goa": { lat: 15.4909, lon: 73.8278 },
  "Jaipur": { lat: 26.9124, lon: 75.7873 },
  "Mumbai": { lat: 19.0760, lon: 72.8777 },
  "Delhi": { lat: 28.6139, lon: 77.2090 },
  "Manali": { lat: 32.2396, lon: 77.1887 },
  "Varanasi": { lat: 25.3176, lon: 82.9739 },
  "Kochi": { lat: 9.9312, lon: 76.2673 },
  "Agra": { lat: 27.1767, lon: 78.0081 },
};

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  const watchId = useRef<Location.LocationSubscription | null>(null);

  // Load cached location on mount
  useEffect(() => {
    loadCachedLocation();
  }, []);

  const loadCachedLocation = async () => {
    try {
      const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp < CACHE_TTL) {
          setLocation(data);
        }
      }
    } catch (e) {
      // Ignore cache errors
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      
      if (!granted) {
        setError('Location permission denied. Using default city.');
      }
      
      return granted;
    } catch (e) {
      setHasPermission(false);
      setError('Failed to request permission');
      return false;
    }
  }, []);

  const reverseGeocode = async (lat: number, lon: number): Promise<{ city: string; country: string }> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (results && results[0]) {
        return {
          city: results[0].city || results[0].region || 'Unknown',
          country: results[0].country || 'Unknown',
        };
      }
    } catch (e) {
      // Fallback to default
    }
    return { city: 'Unknown', country: 'Unknown' };
  };

  const refreshLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const granted = await requestPermission();
      
      if (!granted) {
        // Use default city (Goa)
        const defaultCity = DEFAULT_CITIES['Goa'];
        const locationData: LocationData = {
          latitude: defaultCity.lat,
          longitude: defaultCity.lon,
          accuracy: null,
          city: 'Goa',
          country: 'India',
          timestamp: Date.now(),
        };
        setLocation(locationData);
        await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData));
        setLoading(false);
        return;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });

      const { latitude, longitude, accuracy } = position.coords;
      const { city, country } = await reverseGeocode(latitude, longitude);

      const locationData: LocationData = {
        latitude,
        longitude,
        accuracy,
        city,
        country,
        timestamp: Date.now(),
      };

      setLocation(locationData);
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData));
    } catch (e: any) {
      setError(e.message || 'Failed to get location');
      
      // Load cached or default
      const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (cached) {
        setLocation(JSON.parse(cached));
      } else {
        const defaultCity = DEFAULT_CITIES['Goa'];
        setLocation({
          latitude: defaultCity.lat,
          longitude: defaultCity.lon,
          accuracy: null,
          city: 'Goa',
          country: 'India',
          timestamp: Date.now(),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [requestPermission]);

  const startTracking = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) return;

    setIsTracking(true);
    
    watchId.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 100,
      },
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const { city, country } = await reverseGeocode(latitude, longitude);

        const locationData: LocationData = {
          latitude,
          longitude,
          accuracy,
          city,
          country,
          timestamp: Date.now(),
        };

        setLocation(locationData);
        await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData));
      }
    );
  }, [requestPermission]);

  const stopTracking = useCallback(() => {
    if (watchId.current) {
      watchId.current.remove();
      watchId.current = null;
    }
    setIsTracking(false);
  }, []);

  const getCurrentPosition = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const granted = await requestPermission();
      if (!granted) {
        // Return default location
        return { lat: DEFAULT_CITIES['Goa'].lat, lng: DEFAULT_CITIES['Goa'].lon };
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (e) {
      // Return existing location or default
      if (location) {
        return { lat: location.latitude, lng: location.longitude };
      }
      return { lat: DEFAULT_CITIES['Goa'].lat, lng: DEFAULT_CITIES['Goa'].lon };
    }
  }, [requestPermission, location]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current) {
        watchId.current.remove();
      }
    };
  }, []);

  return {
    location,
    loading,
    error,
    hasPermission,
    requestPermission,
    refreshLocation,
    getCurrentPosition,
    isTracking,
    startTracking,
    stopTracking,
  };
}

export { DEFAULT_CITIES };