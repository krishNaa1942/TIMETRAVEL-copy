/**
 * 🔄 WEATHER ADAPTER
 * Transforms API response to UI-ready data
 */

import { WeatherAPIResponse, WeatherData, AIWeatherInsights } from '../types';
import {
  createTemperatureValue,
  createSpeedValue,
  getConditionInfo,
  isDayCondition,
  degreesToCompass,
  sanitizeTemperature,
  sanitizeHumidity,
} from '../utils/weatherUtils';

export function adaptWeatherResponse(response: WeatherAPIResponse): WeatherData {
  const lastUpdated = response.last_updated ? new Date(response.last_updated) : new Date();
  const isStale = Date.now() - lastUpdated.getTime() > 30 * 60 * 1000; // 30 mins

  const conditionInfo = getConditionInfo(response.condition_code);

  return {
    current: {
      temperature: createTemperatureValue(sanitizeTemperature(response.temperature_c)),
      feelsLike: createTemperatureValue(sanitizeTemperature(response.feels_like_c)),
      humidity: sanitizeHumidity(response.humidity),
      windSpeed: createSpeedValue(response.wind_speed_kmh || 0),
      windDirection: response.wind_direction ? degreesToCompass(response.wind_direction) : undefined,
      pressure: response.pressure,
      uvIndex: response.uv_index,
      visibility: response.visibility_km,
      precipitationChance: response.precipitation_chance,
      condition: {
        code: response.condition_code,
        icon: conditionInfo.icon,
        gradient: conditionInfo.gradient,
        isDay: isDayCondition(response.condition_code),
      },
      description: response.description || conditionInfo.description,
    },
    forecast: response.forecast,
    hourly: response.hourly,
    alerts: response.alerts || [],
    insights: adaptInsights(response.ai_insights, response),
    lastUpdated,
    isStale,
  };
}

function adaptInsights(insights: AIWeatherInsights | undefined, response: WeatherAPIResponse): AIWeatherInsights {
  if (insights) return insights;

  // Generate basic insights from weather data
  const temp = response.temperature_c;
  const humidity = response.humidity;
  const isRaining = response.condition_code.startsWith('10') || response.condition_code.startsWith('09');

  const clothingSuggestions: { item: string; reason: string; priority: 'essential' | 'recommended' | 'optional' }[] = [];
  const healthAlerts: string[] = [];
  const safetyWarnings: string[] = [];
  const activityRecommendations: string[] = [];

  // Temperature-based suggestions
  if (temp < 10) {
    clothingSuggestions.push({ item: 'Winter coat', reason: 'Cold weather', priority: 'essential' as const });
    healthAlerts.push('Risk of hypothermia if exposed for long periods');
  } else if (temp < 20) {
    clothingSuggestions.push({ item: 'Light jacket', reason: 'Mild weather', priority: 'recommended' as const });
  } else if (temp > 30) {
    clothingSuggestions.push({ item: 'Light cotton clothes', reason: 'Hot weather', priority: 'essential' as const });
    healthAlerts.push('Stay hydrated and avoid direct sunlight');
  }

  // Rain-based suggestions
  if (isRaining) {
    clothingSuggestions.push({ item: 'Umbrella', reason: 'Rain expected', priority: 'essential' as const });
    clothingSuggestions.push({ item: 'Waterproof shoes', reason: 'Wet conditions', priority: 'recommended' as const });
  }

  // Humidity alerts
  if (humidity > 80) {
    healthAlerts.push('High humidity – stay hydrated');
  }

  return {
    risk_score: calculateRiskScore(response),
    travel_advisory_level: determineAdvisoryLevel(response),
    clothing_suggestions: clothingSuggestions,
    health_alerts: healthAlerts,
    activity_recommendations: activityRecommendations,
    safety_warnings: safetyWarnings,
  };
}

function calculateRiskScore(response: WeatherAPIResponse): number {
  let score = 0;
  
  if (response.condition_code.startsWith('11')) score += 40; // Thunderstorm
  else if (response.condition_code.startsWith('13')) score += 30; // Snow
  else if (response.condition_code.startsWith('10')) score += 20; // Rain
  
  if (response.temperature_c > 35 || response.temperature_c < 0) score += 20;
  if (response.wind_speed_kmh > 50) score += 15;
  if (response.alerts?.length > 0) score += response.alerts.length * 5;
  
  return Math.min(100, score);
}

function determineAdvisoryLevel(response: WeatherAPIResponse): 'none' | 'caution' | 'warning' | 'danger' {
  const riskScore = calculateRiskScore(response);
  if (riskScore >= 70) return 'danger';
  if (riskScore >= 50) return 'warning';
  if (riskScore >= 25) return 'caution';
  return 'none';
}

export function validateWeatherResponse(data: unknown): data is WeatherAPIResponse {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.temperature_c === 'number' &&
    typeof d.humidity === 'number' &&
    typeof d.condition_code === 'string'
  );
}