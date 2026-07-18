/**
 * Expense Tracker Service
 * Backend: /api/expenses
 */
import apiService from "./api";

export interface Expense {
  id: number;
  destination: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  trip_id?: number;
  created_at?: string;
}

export interface ExpenseSummary {
  destination: string;
  total: number;
  count: number;
  by_category: { category: string; total: number; count: number }[];
}

export const expenseService = {
  async addExpense(data: {
    destination: string;
    category: string;
    description: string;
    amount: number;
    currency?: string;
    date?: string;
    trip_id?: number;
  }): Promise<{ expense: Expense }> {
    return apiService.post("/expenses", data);
  },

  async listExpenses(destination?: string): Promise<{ expenses: Expense[] }> {
    const q = destination
      ? `?destination=${encodeURIComponent(destination)}`
      : "";
    return apiService.get(`/expenses${q}`);
  },

  async getSummary(destination?: string): Promise<ExpenseSummary> {
    const q = destination
      ? `?destination=${encodeURIComponent(destination)}`
      : "";
    return apiService.get(`/expenses/summary${q}`);
  },

  async deleteExpense(id: number): Promise<void> {
    return apiService.delete(`/expenses/${id}`);
  },
};

export default expenseService;
