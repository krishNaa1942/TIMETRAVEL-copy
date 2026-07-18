/**
 * Safety Service
 * Fetches safety scores for destinations
 */

import apiService from "./api";
import { SafetyData } from "@/types";

export const safetyService = {
  /** Get safety profile for a destination */
  async getSafety(destination: string): Promise<SafetyData> {
    return apiService.get<SafetyData>(
      `/safety/${encodeURIComponent(destination)}`
    );
  },
};

export default safetyService;
