/**
 * 🌤️ WEATHER SYSTEM TYPES
 * Production-grade type definitions
 */

// Weather condition codes (OpenWeatherMap standard)
export type WeatherConditionCode = 
  | '01d' | '01n' // Clear
  | '02d' | '02n' // Few clouds
  | '03d' | '03n' // Scattered clouds
  | '04d' | '04n' // Broken clouds
  | '09d' | '09n' // Shower rain
  | '10d' | '10n' // Rain
  | '11d' | '11n' // Thunderstorm
  | '13d' | '13n' // Snow
  | '50d' | '50n'; // Mist/Fog

// Weather severity levels
export type WeatherSeverity = 'low' | 'moderate' | 'high' | 'extreme';

// Travel advisory levels
export type TravelAdvisoryLevel = 'none' | 'caution' | 'warning' | 'danger';

// Unit preferences
export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type SpeedUnit = 'kmh' | 'mph';

// Raw API response
export interface WeatherAPIResponse {
  temperature_c: number;
  temperature_f: number;
  feels_like_c: number;
  feels_like_f: number;
  humidity: number;
  pressure?: number;
  wind_speed_kmh: number;
  wind_speed_mph?: number;
  wind_direction?: number;
  condition_code: WeatherConditionCode;
  description: string;
  icon_url?: string;
  uv_index?: number;
  visibility_km?: number;
  precipitation_chance?: number;
  alerts: WeatherAlert[];
  packing_suggestions: string[];
  last_updated: string;
  // AI-enhanced fields
  ai_insights?: AIWeatherInsights;
  // Forecast data
  forecast?: WeatherForecast[];
  hourly?: HourlyForecast[];
}

// Weather alerts
export interface WeatherAlert {
  id: string;
  type: 'storm' | 'heat' | 'cold' | 'rain' | 'wind' | 'uv' | 'air_quality';
  severity: WeatherSeverity;
  title: string;
  description: string;
  start_time?: string;
  end_time?: string;
}

// AI-powered insights
export interface AIWeatherInsights {
  risk_score: number; // 0-100
  travel_advisory_level: TravelAdvisoryLevel;
  clothing_suggestions: ClothingSuggestion[];
  health_alerts: string[];
  activity_recommendations: string[];
  safety_warnings: string[];
  best_time_to_visit?: string;
}

// Clothing suggestions with reasoning
export interface ClothingSuggestion {
  item: string;
  reason: string;
  priority: 'essential' | 'recommended' | 'optional';
}

// Daily forecast
export interface WeatherForecast {
  date: string;
  temp_high_c: number;
  temp_low_c: number;
  temp_high_f: number;
  temp_low_f: number;
  condition_code: WeatherConditionCode;
  description: string;
  precipitation_chance: number;
}

// Hourly forecast
export interface HourlyForecast {
  hour: number;
  temperature_c: number;
  temperature_f: number;
  condition_code: WeatherConditionCode;
  precipitation_chance: number;
}

// Transformed UI-ready weather data
export interface WeatherData {
  current: CurrentWeather;
  forecast?: WeatherForecast[];
  hourly?: HourlyForecast[];
  alerts: WeatherAlert[];
  insights: AIWeatherInsights;
  lastUpdated: Date;
  isStale: boolean;
}

export interface CurrentWeather {
  temperature: TemperatureValue;
  feelsLike: TemperatureValue;
  humidity: number;
  windSpeed: SpeedValue;
  windDirection?: string;
  pressure?: number;
  uvIndex?: number;
  visibility?: number;
  precipitationChance?: number;
  condition: WeatherCondition;
  description: string;
}

export interface TemperatureValue {
  celsius: number;
  fahrenheit: number;
  display: string; // Formatted for display
}

export interface SpeedValue {
  kmh: number;
  mph: number;
  display: string;
}

export interface WeatherCondition {
  code: WeatherConditionCode;
  icon: string; // Icon name
  gradient: string[]; // Background gradient colors
  isDay: boolean;
}

// Component props
export interface WeatherCardProps {
  destination: string;
  showForecast?: boolean;
  showHourly?: boolean;
  compact?: boolean;
  units?: {
    temperature: TemperatureUnit;
    speed: SpeedUnit;
  };
  onRefresh?: () => void;
  onAlertPress?: (alert: WeatherAlert) => void;
}

export interface WeatherSkeletonProps {
  compact?: boolean;
}

export interface WeatherErrorProps {
  error: Error | string;
  onRetry: () => void;
  lastUpdated?: Date | null;
}

export interface PackingSuggestionsProps {
  suggestions: string[];
  clothingSuggestions: ClothingSuggestion[];
  healthAlerts: string[];
  safetyWarnings: string[];
}

export interface WeatherStatsProps {
  feelsLike: TemperatureValue;
  humidity: number;
  windSpeed: SpeedValue;
  uvIndex?: number;
  visibility?: number;
}

// Hook return types
export interface UseWeatherOptions {
  destination: string;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchInterval?: number;
}

export interface UseWeatherReturn {
  data: WeatherData | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
  isStale: boolean;
  lastUpdated: Date | null;
}

// Analytics events
export type WeatherAnalyticsEvent = 
  | 'weather_viewed'
  | 'weather_refresh_clicked'
  | 'packing_suggestions_clicked'
  | 'weather_alert_viewed'
  | 'forecast_expanded'
  | 'units_changed';