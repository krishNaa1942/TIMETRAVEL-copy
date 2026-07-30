"""
Foursquare Places Service
==========================
Integrates with Foursquare Places API for rich venue data including
ratings, prices, tips, photos, and operating hours.

Supports dual authentication:
  • v3 API Key   → Authorization header  (preferred)
  • v2 Client ID + Secret → query-param auth (fallback)

The service auto-detects which credentials are available and picks
the matching API version transparently.

Docs v3: https://docs.foursquare.com/developer/reference/places-api-overview
Docs v2: https://developer.foursquare.com/docs/places-api/
"""

import logging
import time
from typing import Optional, Union

import requests

from app.utils.retry import api_retry

logger = logging.getLogger(__name__)

FSQ_V3 = "https://api.foursquare.com/v3"
FSQ_V2 = "https://api.foursquare.com/v2"
V2_VERSION = "20260101"  # Foursquare v2 requires a "v" date param

# ── In-memory cache: { "cache_key": { "ts": epoch, "data": ... } }
_cache: dict = {}
CACHE_TTL = 1800  # 30 minutes

# ── Foursquare category IDs for Indian tourism ───────────────────────
CATEGORY_MAP = {
    "tourist attraction": "16000",  # Landmarks and Outdoors
    "restaurant": "13000",  # Dining and Drinking
    "hotel": "19014",  # Hotels and Motels
    "temple": "12098",  # Temples
    "hospital": "15014",  # Hospitals
    "beach": "16003",  # Beaches
    "museum": "10027",  # Museums
    "shopping": "17000",  # Retail
    "atm": "11044",  # ATMs
    "cafe": "13032",  # Cafes
    "nightlife": "10032",  # Nightlife
    "park": "16032",  # Parks
    "spa": "11192",  # Spas
    "pharmacy": "17035",  # Pharmacies
}

# v2 needs different category IDs (Foursquare v2 uses full IDs)
CATEGORY_MAP_V2 = {
    "tourist attraction": "4bf58dd8d48988d12d941735",
    "restaurant": "4d4b7105d754a06374d81259",
    "hotel": "4bf58dd8d48988d1fa931735",
    "temple": "4bf58dd8d48988d131941735",
    "hospital": "4bf58dd8d48988d196941735",
    "beach": "4bf58dd8d48988d1e2941735",
    "museum": "4bf58dd8d48988d181941735",
    "shopping": "4d4b7105d754a06378d81259",
    "atm": "52f2ab2ebcbc57f1066b8b56",
    "cafe": "4bf58dd8d48988d16d941735",
    "nightlife": "4d4b7105d754a06376d81259",
    "park": "4bf58dd8d48988d163941735",
    "spa": "4bf58dd8d48988d1ed941735",
    "pharmacy": "4bf58dd8d48988d10f951735",
}


# ── Credential helpers ────────────────────────────────────────────────


def _extract_creds(creds: Union[str, dict]) -> dict:
    """Normalise credentials to a dict with api_key, client_id, client_secret."""
    if isinstance(creds, str):
        return {"api_key": creds, "client_id": "", "client_secret": ""}
    return {
        "api_key": creds.get("api_key", ""),
        "client_id": creds.get("client_id", ""),
        "client_secret": creds.get("client_secret", ""),
    }


def _use_v3(c: dict) -> bool:
    """Return True when we should attempt v3 first."""
    return bool(c["api_key"] and len(c["api_key"]) > 10)


def _use_v2(c: dict) -> bool:
    """Return True when v2 client credentials are available."""
    return bool(
        c["client_id"]
        and c["client_secret"]
        and len(c["client_id"]) > 10
        and len(c["client_secret"]) > 10
    )


def _v3_headers(api_key: str) -> dict:
    return {"Authorization": api_key, "Accept": "application/json"}


def _v2_params(c: dict) -> dict:
    return {
        "client_id": c["client_id"],
        "client_secret": c["client_secret"],
        "v": V2_VERSION,
    }


def _cache_key(prefix: str, *args) -> str:
    return f"{prefix}:{'|'.join(str(a) for a in args)}"


def _is_cached(key: str) -> bool:
    if key not in _cache:
        return False
    return (time.time() - _cache[key]["ts"]) < CACHE_TTL


# ══════════════════════════════════════════════════════════════════════
# PLACE SEARCH
# ══════════════════════════════════════════════════════════════════════


def search_places(
    lat: float,
    lon: float,
    creds: Union[str, dict],
    category: str = "tourist attraction",
    radius: int = 15000,
    limit: int = 10,
    query: str = "",
) -> list:
    """
    Search for places near a location (tries v3, falls back to v2).
    """
    ck = _cache_key("search", lat, lon, category, radius, limit, query)
    if _is_cached(ck):
        return _cache[ck]["data"]

    c = _extract_creds(creds)

    # Try v3 first
    if _use_v3(c):
        places = _search_v3(lat, lon, c["api_key"], category, radius, limit, query)
        if places is not None:
            _cache[ck] = {"ts": time.time(), "data": places}
            return places

    # Fallback to v2
    if _use_v2(c):
        places = _search_v2(lat, lon, c, category, radius, limit, query)
        if places is not None:
            _cache[ck] = {"ts": time.time(), "data": places}
            return places

    logger.warning("Foursquare: no valid credentials for search")
    return []


@api_retry
def _search_v3(lat, lon, api_key, category, radius, limit, query):
    """Search via Foursquare Places API v3."""
    params = {
        "ll": f"{lat},{lon}",
        "radius": min(radius, 100000),
        "limit": min(limit, 50),
        "sort": "RELEVANCE",
        "fields": "fsq_id,name,categories,location,distance,price,rating,"
        "popularity,verified,website,tel,hours,closed_bucket",
    }
    cat_id = CATEGORY_MAP.get(category.lower())
    if cat_id:
        params["categories"] = cat_id
    if query:
        params["query"] = query

    try:
        resp = requests.get(
            f"{FSQ_V3}/places/search",
            params=params,
            headers=_v3_headers(api_key),
            timeout=10,
        )
        if resp.status_code in (401, 403):
            logger.warning(
                "Foursquare v3 auth failed (%s), will try v2", resp.status_code
            )
            return None  # signal to try v2
        resp.raise_for_status()
        return _parse_v3_results(resp.json().get("results", []), category, lat, lon)
    except requests.exceptions.RequestException as e:
        logger.error("Foursquare v3 search error: %s", e)
        return None


@api_retry
def _search_v2(lat, lon, c, category, radius, limit, query):
    """Search via Foursquare API v2 (client_id + client_secret)."""
    params = {
        **_v2_params(c),
        "ll": f"{lat},{lon}",
        "radius": min(radius, 100000),
        "limit": min(limit, 50),
        "intent": "browse",
    }

    cat_id = CATEGORY_MAP_V2.get(category.lower())
    if cat_id:
        params["categoryId"] = cat_id
    if query:
        params["query"] = query

    try:
        resp = requests.get(f"{FSQ_V2}/venues/search", params=params, timeout=10)
        if resp.status_code in (401, 403):
            logger.error("Foursquare v2 auth also failed (%s)", resp.status_code)
            return None
        resp.raise_for_status()
        venues = resp.json().get("response", {}).get("venues", [])
        return _parse_v2_venues(venues, category, lat, lon)
    except requests.exceptions.RequestException as e:
        logger.error("Foursquare v2 search error: %s", e)
        return None


def _parse_v3_results(results, category, lat, lon):
    """Parse v3 search results into our standard place dict list."""
    places = []
    for r in results:
        loc = r.get("location", {})
        cats = r.get("categories", [])
        cat_names = [c.get("short_name", c.get("name", "")) for c in cats]
        hours_info = r.get("hours", {})

        places.append(
            {
                "fsq_id": r.get("fsq_id", ""),
                "name": r.get("name", "Unknown"),
                "category": cat_names[0] if cat_names else category,
                "categories": cat_names,
                "address": loc.get("formatted_address", loc.get("address", "")),
                "locality": loc.get("locality", ""),
                "region": loc.get("region", ""),
                "lat": loc.get("latitude") or lat,
                "lon": loc.get("longitude") or lon,
                "distance_m": r.get("distance", 0),
                "price_tier": r.get("price"),
                "rating": r.get("rating"),
                "popularity": r.get("popularity"),
                "verified": r.get("verified", False),
                "website": r.get("website"),
                "phone": r.get("tel"),
                "hours_display": hours_info.get("display") if hours_info else None,
                "is_open": _parse_open_status(r.get("closed_bucket")),
            }
        )
    logger.info("Foursquare v3: found %d places for '%s'", len(places), category)
    return places


def _parse_v2_venues(venues, category, lat, lon):
    """Parse v2 venues/search results into our standard place dict list."""
    places = []
    for v in venues:
        loc = v.get("location", {})
        cats = v.get("categories", [])
        cat_names = [c.get("shortName", c.get("name", "")) for c in cats]
        addr_parts = loc.get("formattedAddress", [])
        address = ", ".join(addr_parts) if addr_parts else loc.get("address", "")

        places.append(
            {
                "fsq_id": v.get("id", ""),
                "name": v.get("name", "Unknown"),
                "category": cat_names[0] if cat_names else category,
                "categories": cat_names,
                "address": address,
                "locality": loc.get("city", ""),
                "region": loc.get("state", ""),
                "lat": loc.get("lat") or lat,
                "lon": loc.get("lng") or lon,
                "distance_m": loc.get("distance", 0),
                "price_tier": (
                    v.get("price", {}).get("tier") if v.get("price") else None
                ),
                "rating": (v.get("rating") or 0) / 1,  # v2 rating is 0-10
                "popularity": None,
                "verified": v.get("verified", False),
                "website": v.get("url"),
                "phone": v.get("contact", {}).get("formattedPhone"),
                "hours_display": (
                    v.get("hours", {}).get("status") if v.get("hours") else None
                ),
                "is_open": v.get("hours", {}).get("isOpen") if v.get("hours") else None,
            }
        )
    logger.info("Foursquare v2: found %d places for '%s'", len(places), category)
    return places


def _parse_open_status(bucket: Optional[str]) -> Optional[bool]:
    """Convert Foursquare closed_bucket to is_open boolean."""
    if not bucket:
        return None
    return bucket in ("VeryLikelyOpen", "LikelyOpen")


# ══════════════════════════════════════════════════════════════════════
# PLACE DETAILS
# ══════════════════════════════════════════════════════════════════════


def get_place_details(fsq_id: str, creds: Union[str, dict]) -> Optional[dict]:
    """Get detailed info about a specific place (tries v3 then v2)."""
    ck = _cache_key("detail", fsq_id)
    if _is_cached(ck):
        return _cache[ck]["data"]

    c = _extract_creds(creds)

    if _use_v3(c):
        detail = _detail_v3(fsq_id, c)
        if detail is not None:
            _cache[ck] = {"ts": time.time(), "data": detail}
            return detail

    if _use_v2(c):
        detail = _detail_v2(fsq_id, c)
        if detail is not None:
            _cache[ck] = {"ts": time.time(), "data": detail}
            return detail

    return None


@api_retry
def _detail_v3(fsq_id, c):
    """Fetch place details via v3 API."""
    fields = (
        "fsq_id,name,description,categories,location,distance,"
        "price,rating,popularity,verified,website,tel,email,"
        "hours,hours_popular,menu,social_media,stats,"
        "tastes,features"
    )
    try:
        resp = requests.get(
            f"{FSQ_V3}/places/{fsq_id}",
            params={"fields": fields},
            headers=_v3_headers(c["api_key"]),
            timeout=10,
        )
        if resp.status_code in (401, 402, 403):
            return None
        resp.raise_for_status()
        data = resp.json()
        detail = _build_detail_from_v3(data, fsq_id)
        detail["tips"] = get_place_tips(fsq_id, c, limit=5)
        detail["photos"] = get_place_photos(fsq_id, c, limit=6)
        return detail
    except requests.exceptions.RequestException as e:
        logger.error("Foursquare v3 detail error for %s: %s", fsq_id, e)
        return None


@api_retry
def _detail_v2(fsq_id, c):
    """Fetch place details via v2 API."""
    try:
        resp = requests.get(
            f"{FSQ_V2}/venues/{fsq_id}",
            params=_v2_params(c),
            timeout=10,
        )
        if resp.status_code in (401, 402, 403):
            return None
        resp.raise_for_status()
        venue = resp.json().get("response", {}).get("venue", {})
        if not venue:
            return None
        detail = _build_detail_from_v2(venue, fsq_id)
        detail["tips"] = get_place_tips(fsq_id, c, limit=5)
        detail["photos"] = get_place_photos(fsq_id, c, limit=6)
        return detail
    except requests.exceptions.RequestException as e:
        logger.error("Foursquare v2 detail error for %s: %s", fsq_id, e)
        return None


def _build_detail_from_v3(data, fsq_id):
    loc = data.get("location", {})
    cats = data.get("categories", [])
    hours_info = data.get("hours", {})
    stats = data.get("stats", {})
    social = data.get("social_media", {})

    return {
        "fsq_id": data.get("fsq_id", fsq_id),
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "categories": [c.get("name", "") for c in cats],
        "address": loc.get("formatted_address", ""),
        "locality": loc.get("locality", ""),
        "region": loc.get("region", ""),
        "lat": loc.get("latitude"),
        "lon": loc.get("longitude"),
        "price_tier": data.get("price"),
        "rating": data.get("rating"),
        "popularity": data.get("popularity"),
        "verified": data.get("verified", False),
        "website": data.get("website"),
        "phone": data.get("tel"),
        "email": data.get("email"),
        "hours_display": hours_info.get("display") if hours_info else None,
        "hours_open_now": hours_info.get("open_now") if hours_info else None,
        "menu_url": data.get("menu", {}).get("url") if data.get("menu") else None,
        "total_photos": stats.get("total_photos", 0),
        "total_ratings": stats.get("total_ratings", 0),
        "total_tips": stats.get("total_tips", 0),
        "tastes": data.get("tastes", []),
        "features": _flatten_features(data.get("features", {})),
        "social_media": (
            {
                "facebook": social.get("facebook_id"),
                "instagram": social.get("instagram"),
                "twitter": social.get("twitter"),
            }
            if social
            else {}
        ),
    }


def _build_detail_from_v2(venue, fsq_id):
    loc = venue.get("location", {})
    cats = venue.get("categories", [])
    contact = venue.get("contact", {})
    hours_info = venue.get("hours", {})
    stats = venue.get("stats", {})
    addr_parts = loc.get("formattedAddress", [])

    return {
        "fsq_id": venue.get("id", fsq_id),
        "name": venue.get("name", ""),
        "description": venue.get("description", ""),
        "categories": [c.get("name", "") for c in cats],
        "address": ", ".join(addr_parts) if addr_parts else loc.get("address", ""),
        "locality": loc.get("city", ""),
        "region": loc.get("state", ""),
        "lat": loc.get("lat"),
        "lon": loc.get("lng"),
        "price_tier": (
            venue.get("price", {}).get("tier") if venue.get("price") else None
        ),
        "rating": venue.get("rating"),
        "popularity": None,
        "verified": venue.get("verified", False),
        "website": venue.get("url"),
        "phone": contact.get("formattedPhone"),
        "email": contact.get("email"),
        "hours_display": hours_info.get("status") if hours_info else None,
        "hours_open_now": hours_info.get("isOpen") if hours_info else None,
        "menu_url": venue.get("menu", {}).get("url") if venue.get("menu") else None,
        "total_photos": (
            stats.get("photos", 0) if isinstance(stats.get("photos"), int) else 0
        ),
        "total_ratings": 0,
        "total_tips": stats.get("tips", 0) if isinstance(stats.get("tips"), int) else 0,
        "tastes": (
            venue.get("attributes", {})
            .get("groups", [{}])[0]
            .get("summary", "")
            .split(", ")
            if venue.get("attributes", {}).get("groups")
            else []
        ),
        "features": [],
        "social_media": {},
    }


def _flatten_features(features: dict) -> list:
    """Extract feature names from nested Foursquare features dict."""
    flat = []
    if not features:
        return flat
    for section_key, section_data in features.items():
        if isinstance(section_data, dict):
            for key, val in section_data.items():
                if val is True:
                    flat.append(key.replace("_", " ").title())
                elif isinstance(val, dict):
                    for k2, v2 in val.items():
                        if v2 is True:
                            flat.append(k2.replace("_", " ").title())
        elif section_data is True:
            flat.append(section_key.replace("_", " ").title())
    return flat[:15]


# ══════════════════════════════════════════════════════════════════════
# PLACE TIPS
# ══════════════════════════════════════════════════════════════════════


def get_place_tips(fsq_id: str, creds: Union[str, dict], limit: int = 5) -> list:
    """Get user tips/reviews for a place (v3 then v2 fallback)."""
    c = _extract_creds(creds)

    if _use_v3(c):
        tips = _tips_v3(fsq_id, c["api_key"], limit)
        if tips is not None:
            return tips

    if _use_v2(c):
        tips = _tips_v2(fsq_id, c, limit)
        if tips is not None:
            return tips

    return []


@api_retry
def _tips_v3(fsq_id, api_key, limit):
    try:
        resp = requests.get(
            f"{FSQ_V3}/places/{fsq_id}/tips",
            params={"limit": min(limit, 20), "sort": "POPULAR"},
            headers=_v3_headers(api_key),
            timeout=10,
        )
        if resp.status_code in (401, 403):
            return None
        resp.raise_for_status()
        return [
            {
                "text": t.get("text", ""),
                "created_at": t.get("created_at", ""),
                "agree_count": t.get("agree_count", 0),
            }
            for t in resp.json()
        ]
    except requests.exceptions.RequestException as e:
        logger.error("v3 tips error for %s: %s", fsq_id, e)
        return None


@api_retry
def _tips_v2(fsq_id, c, limit):
    try:
        resp = requests.get(
            f"{FSQ_V2}/venues/{fsq_id}/tips",
            params={**_v2_params(c), "limit": min(limit, 20), "sort": "popular"},
            timeout=10,
        )
        if resp.status_code in (401, 403):
            return None
        resp.raise_for_status()
        items = resp.json().get("response", {}).get("tips", {}).get("items", [])
        return [
            {
                "text": t.get("text", ""),
                "created_at": t.get("createdAt", ""),
                "agree_count": t.get("agreeCount", 0),
            }
            for t in items
        ]
    except requests.exceptions.RequestException as e:
        logger.error("v2 tips error for %s: %s", fsq_id, e)
        return None


# ══════════════════════════════════════════════════════════════════════
# PLACE PHOTOS
# ══════════════════════════════════════════════════════════════════════


def get_place_photos(fsq_id: str, creds: Union[str, dict], limit: int = 6) -> list:
    """Get photos for a place (v3 then v2 fallback)."""
    c = _extract_creds(creds)

    if _use_v3(c):
        photos = _photos_v3(fsq_id, c["api_key"], limit)
        if photos is not None:
            return photos

    if _use_v2(c):
        photos = _photos_v2(fsq_id, c, limit)
        if photos is not None:
            return photos

    return []


@api_retry
def _photos_v3(fsq_id, api_key, limit):
    try:
        resp = requests.get(
            f"{FSQ_V3}/places/{fsq_id}/photos",
            params={"limit": min(limit, 20), "sort": "POPULAR"},
            headers=_v3_headers(api_key),
            timeout=10,
        )
        if resp.status_code in (401, 403):
            return None
        resp.raise_for_status()
        photos = []
        for p in resp.json():
            prefix = p.get("prefix", "")
            suffix = p.get("suffix", "")
            if prefix and suffix:
                photos.append(
                    {
                        "url": f"{prefix}original{suffix}",
                        "url_medium": f"{prefix}440x440{suffix}",
                        "url_thumb": f"{prefix}120x120{suffix}",
                        "width": p.get("width", 0),
                        "height": p.get("height", 0),
                        "created_at": p.get("created_at", ""),
                    }
                )
        return photos
    except requests.exceptions.RequestException as e:
        logger.error("v3 photos error for %s: %s", fsq_id, e)
        return None


@api_retry
def _photos_v2(fsq_id, c, limit):
    try:
        resp = requests.get(
            f"{FSQ_V2}/venues/{fsq_id}/photos",
            params={**_v2_params(c), "limit": min(limit, 20), "group": "venue"},
            timeout=10,
        )
        if resp.status_code in (401, 403):
            return None
        resp.raise_for_status()
        items = resp.json().get("response", {}).get("photos", {}).get("items", [])
        photos = []
        for p in items:
            prefix = p.get("prefix", "")
            suffix = p.get("suffix", "")
            if prefix and suffix:
                photos.append(
                    {
                        "url": f"{prefix}original{suffix}",
                        "url_medium": f"{prefix}440x440{suffix}",
                        "url_thumb": f"{prefix}120x120{suffix}",
                        "width": p.get("width", 0),
                        "height": p.get("height", 0),
                        "created_at": p.get("createdAt", ""),
                    }
                )
        return photos
    except requests.exceptions.RequestException as e:
        logger.error("v2 photos error for %s: %s", fsq_id, e)
        return None


# ══════════════════════════════════════════════════════════════════════
# CATEGORIES & STATUS
# ══════════════════════════════════════════════════════════════════════


def get_categories() -> list:
    """Return the supported category keys and labels."""
    labels = {
        "tourist attraction": "Tourist Attractions",
        "restaurant": "Restaurants",
        "hotel": "Hotels",
        "temple": "Temples",
        "hospital": "Hospitals",
        "beach": "Beaches",
        "museum": "Museums",
        "shopping": "Shopping",
        "atm": "ATMs",
        "cafe": "Cafes",
        "nightlife": "Nightlife",
        "park": "Parks",
        "spa": "Spas",
        "pharmacy": "Pharmacies",
    }
    return [{"id": k, "label": v} for k, v in labels.items()]


def is_available(creds: Union[str, dict]) -> bool:
    """Check if any Foursquare credentials are configured."""
    c = _extract_creds(creds)
    return _use_v3(c) or _use_v2(c)
