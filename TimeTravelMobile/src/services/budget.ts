/**
 * Budget Service
 * Fetches budget estimates for travel destinations.
 * 
 * Flask API expects: { destination, num_days, family_size, travel_class }
 * Returns: { destination, num_days, family_size, travel_class, accommodation, food, transport, activities, miscellaneous, total, currency }
 */

import apiService from "./api";
import { BudgetEstimate } from "@/types";

export const budgetService = {
  /** Get a budget estimate for a trip */
  async getEstimate(
    destination: string,
    numDays: number,
    familySize: number,
    travelClass: "economy" | "comfort" | "premium" = "economy"
  ): Promise<BudgetEstimate> {
    return apiService.post<BudgetEstimate>("/budget/estimate", {
      destination,
      num_days: numDays,
      family_size: familySize,
      travel_class: travelClass,
    });
  },
};

export default budgetService;
