/**
 * 🌐 WEATHER SERVICE
 * API layer for weather data
 */

import { WeatherAPIResponse } from '../types';
import { adaptWeatherResponse, validateWeatherResponse } from '../adapters/weatherAdapter';
import apiService from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'weather_cache_';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

interface CachedWeather {
  data: WeatherAPIResponse;
  timestamp: number;
}

async function getCachedWeather(destination: string): Promise<WeatherAPIResponse | null> {
  try {
    const key = `${CACHE_KEY_PREFIX}${destination.toLowerCase()}`;
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    
    const parsed: CachedWeather = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_DURATION) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

async function setCachedWeather(destination: string, data: WeatherAPIResponse): Promise<void> {
  try {
    const key = `${CACHE_KEY_PREFIX}${destination.toLowerCase()}`;
    const cache: CachedWeather = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // Cache failed, continue without
  }
}

export async function fetchWeather(
  destination: string,
  signal?: AbortSignal,
): Promise<ReturnType<typeof adaptWeatherResponse>> {
  // Try cache first
  const cached = await getCachedWeather(destination);
  if (cached) {
    return adaptWeatherResponse(cached);
  }

  // Fetch from API — signal allows the caller to cancel in-flight requests
  const data = await apiService.get<WeatherAPIResponse>(
    `/weather?destination=${encodeURIComponent(destination)}`,
    { signal, skipRetry: true },
  );
  
  if (!validateWeatherResponse(data)) {
    throw new Error('Invalid weather response format');
  }

  // Cache successful response
  await setCachedWeather(destination, data);

  return adaptWeatherResponse(data);
}

export { adaptWeatherResponse };