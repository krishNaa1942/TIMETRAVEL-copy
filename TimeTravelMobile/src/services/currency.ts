/**
 * Currency Converter Service
 * GET /api/currency/convert?amount=100&from=USD&to=INR
 *
 * Phase E4: offline caching via the shared @ttt_cache_ helper,
 * stale-while-revalidate — a cached conversion is served instantly
 * (works offline), while a stale entry is refreshed in the background.
 */

import { cache } from "@/utils/cache";
import apiService from "./api";

export interface ConversionResult {
  amount: number;
  from: string;
  to: string;
  rate: number;
  converted: number;
  timestamp?: string;
}

const CONVERT_TTL = 1000 * 60 * 15; // 15 minutes
const SUPPORTED_TTL = 1000 * 60 * 60 * 24; // 24 hours

function revalidate<T>(key: string, ttl: number, fetcher: () => Promise<T>) {
  fetcher()
    .then((fresh) => cache.set(key, fresh, { ttl }))
    .catch(() => {
      // Offline / backend down: keep serving the stale cached value.
    });
}

export const currencyService = {
  async convert(amount: number, from: string, to: string): Promise<ConversionResult> {
    const key = `currency_convert_${from}_${to}_${amount}`;
    const cached = await cache.get<ConversionResult>(key);
    if (cached) {
      if (!cache.isFresh(key)) {
        const params = new URLSearchParams({ amount: String(amount), from, to });
        revalidate(key, CONVERT_TTL, () =>
          apiService.get<ConversionResult>(`/currency/convert?${params}`),
        );
      }
      return cached;
    }
    const params = new URLSearchParams({ amount: String(amount), from, to });
    const result = await apiService.get<ConversionResult>(`/currency/convert?${params}`);
    await cache.set(key, result, { ttl: CONVERT_TTL });
    return result;
  },

  async getSupportedCurrencies(): Promise<string[]> {
    const cached = await cache.get<string[]>("currency_supported");
    if (cached) {
      if (!cache.isFresh("currency_supported")) {
        revalidate("currency_supported", SUPPORTED_TTL, async () => {
          const res = await apiService.get<{ currencies: string[] }>("/currency/supported");
          return res.currencies;
        });
      }
      return cached;
    }
    const res = await apiService.get<{ currencies: string[] }>("/currency/supported");
    await cache.set("currency_supported", res.currencies, { ttl: SUPPORTED_TTL });
    return res.currencies;
  },
};

export default currencyService;
