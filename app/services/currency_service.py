"""
Currency Conversion Service
============================
Free currency exchange rates using exchangerate-api.com (no key required
for the open endpoint).  Falls back to a static table of common rates
when offline or rate-limited.

Usage:
    convert_currency(100, "USD", "INR")  →  {"converted": 8350.0, ...}
"""

import logging
import time
from typing import Optional

import requests

from app.utils.retry import api_retry

logger = logging.getLogger(__name__)

API_BASE = "https://open.er-api.com/v6/latest"

# ── In-memory cache (60-min TTL) ────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 3600

# Static fallback rates (INR-centric, approximate)
FALLBACK_RATES = {
    "INR": 1.0,
    "USD": 0.012,
    "EUR": 0.011,
    "GBP": 0.0095,
    "AUD": 0.018,
    "CAD": 0.016,
    "SGD": 0.016,
    "AED": 0.044,
    "THB": 0.42,
    "JPY": 1.80,
    "MYR": 0.056,
    "LKR": 3.54,
    "NPR": 1.60,
    "BDT": 1.31,
}

CURRENCY_SYMBOLS = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "AUD": "A$",
    "CAD": "C$",
    "SGD": "S$",
    "AED": "د.إ",
    "THB": "฿",
    "JPY": "¥",
    "MYR": "RM",
    "LKR": "Rs",
    "NPR": "रू",
    "BDT": "৳",
}


@api_retry
def _fetch_rates(base: str = "INR") -> Optional[dict]:
    """Fetch live rates from open exchange rate API."""
    ck = f"rates:{base}"
    if ck in _cache and (time.time() - _cache[ck]["ts"]) < CACHE_TTL:
        return _cache[ck]["data"]

    try:
        resp = requests.get(f"{API_BASE}/{base}", timeout=8)
        resp.raise_for_status()
        data = resp.json()
        if data.get("result") == "success":
            rates = data.get("rates", {})
            _cache[ck] = {"ts": time.time(), "data": rates}
            return rates
    except requests.RequestException as e:
        logger.warning("Exchange rate API error: %s (using fallback)", e)

    return None


def convert_currency(
    amount: float,
    from_currency: str,
    to_currency: str,
) -> dict:
    """
    Convert an amount between two currencies.

    Returns:
        {
            "amount": 100,
            "from": "USD",
            "to": "INR",
            "rate": 83.5,
            "converted": 8350.0,
            "symbol": "₹",
            "source": "live" | "fallback"
        }
    """
    from_c = from_currency.upper()
    to_c = to_currency.upper()

    rates = _fetch_rates(from_c)
    source = "live"

    if rates and to_c in rates:
        rate = rates[to_c]
    else:
        # Fallback: cross-rate through INR
        source = "fallback"
        from_to_inr = 1.0 / FALLBACK_RATES.get(from_c, 0.012)
        inr_to_target = FALLBACK_RATES.get(to_c, 1.0)
        rate = from_to_inr * inr_to_target
        if from_c == "INR":
            rate = FALLBACK_RATES.get(to_c, 1.0)
        elif to_c == "INR":
            rate = 1.0 / FALLBACK_RATES.get(from_c, 0.012)

    converted = round(amount * rate, 2)

    return {
        "amount": amount,
        "from": from_c,
        "to": to_c,
        "rate": round(rate, 4),
        "converted": converted,
        "symbol": CURRENCY_SYMBOLS.get(to_c, to_c),
        "source": source,
    }


def get_supported_currencies() -> list:
    """Return list of currencies we support for conversion."""
    return [{"code": k, "symbol": v} for k, v in CURRENCY_SYMBOLS.items()]
