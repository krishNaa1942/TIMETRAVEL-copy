"""
Travel News Service (NewsAPI)
==============================
Fetches travel-related news articles for Indian destinations using NewsAPI.
Provides destination-specific travel news, safety advisories, and trending
travel stories to keep travellers informed.

Docs: https://newsapi.org/docs/endpoints
"""

import logging
import time
import requests

from app.utils.constants import DESTINATION_NEWS_KW as DESTINATION_KEYWORDS
from app.utils.retry import api_retry

logger = logging.getLogger(__name__)

NEWSAPI_BASE = "https://newsapi.org/v2"


# ── In-memory cache ──────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 900  # 15 minutes (news updates frequently)


def _cache_key(prefix: str, *args) -> str:
    return f"{prefix}:{'|'.join(str(a) for a in args)}"


def _is_cached(key: str) -> bool:
    if key not in _cache:
        return False
    return (time.time() - _cache[key]["ts"]) < CACHE_TTL


# ══════════════════════════════════════════════════════════════════════
# TRAVEL NEWS
# ══════════════════════════════════════════════════════════════════════


@api_retry
def get_travel_news(
    api_key: str,
    destination: str = "",
    category: str = "travel",
    limit: int = 10,
    language: str = "en",
) -> list:
    """
    Fetch travel-related news articles.

    Args:
        api_key:      NewsAPI API key.
        destination:  Optional destination name to filter news.
        category:     News topic (travel, safety, culture, food).
        limit:        Max articles to return (max 20).
        language:     Language code (default: en).

    Returns list of article dicts:
        [{
            "title": str,
            "description": str,
            "content": str,
            "url": str,
            "image_url": str | None,
            "source": str,
            "author": str | None,
            "published_at": str,
            "destination": str,
        }]
    """
    if not api_key:
        logger.warning("NewsAPI key not configured")
        return []

    # Build search query
    query = _build_query(destination, category)
    ck = _cache_key("news", query, limit, language)
    if _is_cached(ck):
        return _cache[ck]["data"]

    params = {
        "q": query,
        "language": language,
        "sortBy": "publishedAt",
        "pageSize": min(limit, 20),
        "apiKey": api_key,
    }

    try:
        resp = requests.get(
            f"{NEWSAPI_BASE}/everything",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "ok":
            logger.error("NewsAPI error: %s", data.get("message", "Unknown"))
            return []

        articles = []
        for art in data.get("articles", []):
            # Skip articles with [Removed] content
            if art.get("title") == "[Removed]":
                continue

            articles.append(
                {
                    "title": art.get("title", ""),
                    "description": art.get("description", ""),
                    "content": (art.get("content") or "")[:500],
                    "url": art.get("url", ""),
                    "image_url": art.get("urlToImage"),
                    "source": art.get("source", {}).get("name", "Unknown"),
                    "author": art.get("author"),
                    "published_at": art.get("publishedAt", ""),
                    "destination": destination or "India",
                }
            )

        _cache[ck] = {"ts": time.time(), "data": articles}
        logger.info("NewsAPI: fetched %d articles for '%s'", len(articles), query)
        return articles

    except requests.exceptions.RequestException as e:
        logger.error("NewsAPI request error: %s", e)
        return []


@api_retry
def get_trending_travel(api_key: str, limit: int = 10) -> list:
    """
    Fetch trending India travel headlines using top-headlines endpoint.
    """
    if not api_key:
        return []

    ck = _cache_key("trending", limit)
    if _is_cached(ck):
        return _cache[ck]["data"]

    params = {
        "q": "travel India tourism",
        "language": "en",
        "sortBy": "popularity",
        "pageSize": min(limit, 20),
        "apiKey": api_key,
    }

    try:
        resp = requests.get(
            f"{NEWSAPI_BASE}/everything",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "ok":
            return []

        articles = []
        for art in data.get("articles", []):
            if art.get("title") == "[Removed]":
                continue
            articles.append(
                {
                    "title": art.get("title", ""),
                    "description": art.get("description", ""),
                    "content": (art.get("content") or "")[:500],
                    "url": art.get("url", ""),
                    "image_url": art.get("urlToImage"),
                    "source": art.get("source", {}).get("name", "Unknown"),
                    "author": art.get("author"),
                    "published_at": art.get("publishedAt", ""),
                    "destination": "India",
                }
            )

        _cache[ck] = {"ts": time.time(), "data": articles}
        return articles

    except requests.exceptions.RequestException as e:
        logger.error("NewsAPI trending error: %s", e)
        return []


@api_retry
def get_safety_news(api_key: str, destination: str = "", limit: int = 5) -> list:
    """
    Fetch safety-related travel advisories and alerts.
    """
    if not api_key:
        return []

    query_parts = ["India travel safety OR travel advisory OR travel warning"]
    if destination:
        query_parts.append(f"OR {destination} safety")
    query = " ".join(query_parts)

    ck = _cache_key("safety_news", destination, limit)
    if _is_cached(ck):
        return _cache[ck]["data"]

    params = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": min(limit, 10),
        "apiKey": api_key,
    }

    try:
        resp = requests.get(
            f"{NEWSAPI_BASE}/everything",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "ok":
            return []

        articles = []
        for art in data.get("articles", []):
            if art.get("title") == "[Removed]":
                continue
            articles.append(
                {
                    "title": art.get("title", ""),
                    "description": art.get("description", ""),
                    "url": art.get("url", ""),
                    "image_url": art.get("urlToImage"),
                    "source": art.get("source", {}).get("name", "Unknown"),
                    "published_at": art.get("publishedAt", ""),
                    "destination": destination or "India",
                }
            )

        _cache[ck] = {"ts": time.time(), "data": articles}
        return articles

    except requests.exceptions.RequestException as e:
        logger.error("NewsAPI safety news error: %s", e)
        return []


# ══════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════


def _build_query(destination: str, category: str) -> str:
    """Build a NewsAPI search query from destination + category."""
    dest_lower = destination.lower().strip() if destination else ""

    # Use rich keyword mapping if available
    if dest_lower in DESTINATION_KEYWORDS:
        base = DESTINATION_KEYWORDS[dest_lower]
    elif dest_lower:
        base = f"{destination} tourism OR {destination} travel"
    else:
        base = "India travel tourism"

    # Add category refinement
    cat_lower = category.lower().strip() if category else ""
    if cat_lower == "safety":
        base += " OR safety advisory"
    elif cat_lower == "food":
        base += " OR food OR cuisine OR restaurant"
    elif cat_lower == "culture":
        base += " OR culture OR heritage OR festival"
    elif cat_lower == "adventure":
        base += " OR adventure OR trekking OR outdoor"

    return base


def get_destinations() -> list:
    """Return list of destinations that have keyword mappings."""
    return sorted(DESTINATION_KEYWORDS.keys())


def is_available(api_key: str) -> bool:
    """Check if NewsAPI key is configured."""
    return bool(api_key and len(api_key) > 10)
