/**
 * Currency Converter Service
 * GET /api/currency/convert?amount=100&from=USD&to=INR
 */

import apiService from "./api";

export interface ConversionResult {
  amount: number;
  from: string;
  to: string;
  rate: number;
  converted: number;
  timestamp?: string;
}

export const currencyService = {
  async convert(amount: number, from: string, to: string): Promise<ConversionResult> {
    const params = new URLSearchParams({ amount: String(amount), from, to });
    return apiService.get<ConversionResult>(`/currency/convert?${params}`);
  },

  async getSupportedCurrencies(): Promise<string[]> {
    const res = await apiService.get<{ currencies: string[] }>("/currency/supported");
    return res.currencies;
  },
};

export default currencyService;
