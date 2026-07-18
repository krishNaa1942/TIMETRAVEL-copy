/**
 * Weather Service
 * Fetches live weather data for destinations
 */

import apiService from "./api";
import { WeatherData } from "@/types";

export const weatherService = {
  /** Get current weather and packing advice for a destination */
  async getWeather(destination: string): Promise<WeatherData> {
    return apiService.get<WeatherData>(
      `/weather/${encodeURIComponent(destination)}`
    );
  },
};

export default weatherService;
