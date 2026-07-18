/**
 * 🌤️ WEATHER UTILITIES
 * Formatting, conversions, and helpers
 */

import {
  WeatherConditionCode,
  TemperatureUnit,
  SpeedUnit,
  TemperatureValue,
  SpeedValue,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// TEMPERATURE CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════════

export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return Math.round(((fahrenheit - 32) * 5) / 9);
}

export function formatTemperature(
  celsius: number,
  unit: TemperatureUnit = 'celsius'
): string {
  const value = unit === 'fahrenheit' ? celsiusToFahrenheit(celsius) : celsius;
  return `${value}°`;
}

export function createTemperatureValue(celsius: number): TemperatureValue {
  return {
    celsius: Math.round(celsius),
    fahrenheit: celsiusToFahrenheit(celsius),
    display: `${Math.round(celsius)}°C`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SPEED CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════════

export function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

export function mphToKmh(mph: number): number {
  return Math.round(mph * 1.60934);
}

export function formatSpeed(kmh: number, unit: SpeedUnit = 'kmh'): string {
  const value = unit === 'mph' ? kmhToMph(kmh) : kmh;
  return `${value} ${unit === 'mph' ? 'mph' : 'km/h'}`;
}

export function createSpeedValue(kmh: number): SpeedValue {
  return {
    kmh: Math.round(kmh),
    mph: kmhToMph(kmh),
    display: `${Math.round(kmh)} km/h`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WEATHER CONDITION MAPPING
// ═══════════════════════════════════════════════════════════════════════════

interface ConditionInfo {
  icon: string;
  gradient: string[];
  description: string;
}

const CONDITION_MAP: Record<WeatherConditionCode, ConditionInfo> = {
  // Clear
  '01d': {
    icon: 'weather-sunny',
    gradient: ['#FFD700', '#FF8C00', '#FF6347'],
    description: 'Clear sky',
  },
  '01n': {
    icon: 'weather-night',
    gradient: ['#1a1a2e', '#16213e', '#0f3460'],
    description: 'Clear night',
  },
  // Few clouds
  '02d': {
    icon: 'weather-partly-cloudy',
    gradient: ['#87CEEB', '#ADD8E6', '#F0F8FF'],
    description: 'Partly cloudy',
  },
  '02n': {
    icon: 'weather-night-partly-cloudy',
    gradient: ['#2C3E50', '#3498DB', '#1ABC9C'],
    description: 'Partly cloudy night',
  },
  // Scattered clouds
  '03d': {
    icon: 'weather-cloudy',
    gradient: ['#B0C4DE', '#778899', '#708090'],
    description: 'Cloudy',
  },
  '03n': {
    icon: 'weather-cloudy',
    gradient: ['#2C3E50', '#34495E', '#7F8C8D'],
    description: 'Cloudy night',
  },
  // Broken clouds
  '04d': {
    icon: 'weather-cloudy',
    gradient: ['#696969', '#808080', '#A9A9A9'],
    description: 'Overcast',
  },
  '04n': {
    icon: 'weather-cloudy',
    gradient: ['#36454F', '#2F4F4F', '#696969'],
    description: 'Overcast night',
  },
  // Shower rain
  '09d': {
    icon: 'weather-pouring',
    gradient: ['#4682B4', '#5F9EA0', '#6495ED'],
    description: 'Showers',
  },
  '09n': {
    icon: 'weather-pouring',
    gradient: ['#191970', '#000080', '#4682B4'],
    description: 'Night showers',
  },
  // Rain
  '10d': {
    icon: 'weather-rainy',
    gradient: ['#4169E1', '#6495ED', '#87CEEB'],
    description: 'Rain',
  },
  '10n': {
    icon: 'weather-rainy',
    gradient: ['#191970', '#0000CD', '#4169E1'],
    description: 'Night rain',
  },
  // Thunderstorm
  '11d': {
    icon: 'weather-lightning-rainy',
    gradient: ['#2F4F4F', '#696969', '#FFD700'],
    description: 'Thunderstorm',
  },
  '11n': {
    icon: 'weather-lightning-rainy',
    gradient: ['#1C1C1C', '#363636', '#FFD700'],
    description: 'Night thunderstorm',
  },
  // Snow
  '13d': {
    icon: 'weather-snowy',
    gradient: ['#F0F8FF', '#E6E6FA', '#B0E0E6'],
    description: 'Snow',
  },
  '13n': {
    icon: 'weather-snowy',
    gradient: ['#4A5568', '#718096', '#E2E8F0'],
    description: 'Night snow',
  },
  // Mist/Fog
  '50d': {
    icon: 'weather-fog',
    gradient: ['#D3D3D3', '#C0C0C0', '#A9A9A9'],
    description: 'Foggy',
  },
  '50n': {
    icon: 'weather-fog',
    gradient: ['#4A5568', '#718096', '#A0AEC0'],
    description: 'Night fog',
  },
};

export function getConditionInfo(code: WeatherConditionCode): ConditionInfo {
  return CONDITION_MAP[code] || CONDITION_MAP['01d'];
}

export function isDayCondition(code: WeatherConditionCode): boolean {
  return code.endsWith('d');
}

// ═══════════════════════════════════════════════════════════════════════════
// WIND DIRECTION
// ═══════════════════════════════════════════════════════════════════════════

export function degreesToCompass(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

export function formatLastUpdated(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${period}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

export function isValidTemperature(temp: number): boolean {
  return typeof temp === 'number' && !isNaN(temp) && temp >= -100 && temp <= 100;
}

export function isValidHumidity(humidity: number): boolean {
  return typeof humidity === 'number' && !isNaN(humidity) && humidity >= 0 && humidity <= 100;
}

export function isValidWindSpeed(speed: number): boolean {
  return typeof speed === 'number' && !isNaN(speed) && speed >= 0 && speed <= 500;
}

export function sanitizeTemperature(temp: unknown, fallback = 20): number {
  if (typeof temp === 'number' && isValidTemperature(temp)) {
    return temp;
  }
  return fallback;
}

export function sanitizeHumidity(humidity: unknown, fallback = 50): number {
  if (typeof humidity === 'number' && isValidHumidity(humidity)) {
    return humidity;
  }
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAVEL ADVISORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getAdvisoryColor(level: string): string {
  switch (level) {
    case 'none': return '#10B981';
    case 'caution': return '#F59E0B';
    case 'warning': return '#F97316';
    case 'danger': return '#EF4444';
    default: return '#6B7280';
  }
}

export function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'low': return 'information-outline';
    case 'moderate': return 'alert-circle-outline';
    case 'high': return 'alert-outline';
    case 'extreme': return 'alert-octagon';
    default: return 'information-outline';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UV INDEX HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getUVIndexLevel(uvIndex: number): { level: string; color: string; advice: string } {
  if (uvIndex <= 2) {
    return { level: 'Low', color: '#10B981', advice: 'No protection needed' };
  }
  if (uvIndex <= 5) {
    return { level: 'Moderate', color: '#F59E0B', advice: 'Wear sunscreen' };
  }
  if (uvIndex <= 7) {
    return { level: 'High', color: '#F97316', advice: 'Seek shade during midday' };
  }
  if (uvIndex <= 10) {
    return { level: 'Very High', color: '#EF4444', advice: 'Avoid sun exposure' };
  }
  return { level: 'Extreme', color: '#7C3AED', advice: 'Stay indoors if possible' };
}