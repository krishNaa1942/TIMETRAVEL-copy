"""
Maps Service
=============
Integrates with the TomTom Maps API for geocoding, reverse geocoding,
nearby search (POI), and routing between two destinations.

Docs:
  - Search: https://developer.tomtom.com/search-api/documentation
  - Routing: https://developer.tomtom.com/routing-api/documentation
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional
import requests

from app.utils.retry import api_retry

logger = logging.getLogger(__name__)

TOMTOM_BASE = "https://api.tomtom.com"

# Destination coordinates imported from central registry
from app.utils.constants import DESTINATION_COORDS


def get_all_destinations() -> list:
    """Return all pre-seeded destination markers for the map."""
    return [
        {"id": key, "label": d["label"], "lat": d["lat"], "lon": d["lon"]}
        for key, d in DESTINATION_COORDS.items()
    ]


# ── TomTom Geocode (Fuzzy Search) ──────────────────────────────────────

@api_retry
def geocode(query: str, api_key: str) -> Optional[dict]:
    """
    Convert a place name to lat/lon using TomTom Search API.

    Returns: {"lat": float, "lon": float, "address": str} or None.
    """
    if not api_key:
        logger.warning("TomTom API key not configured")
        return None

    url = f"{TOMTOM_BASE}/search/2/geocode/{requests.utils.quote(query)}.json"
    params = {"key": api_key, "limit": 1, "countrySet": "IN"}

    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        results = res.json().get("results", [])
        if not results:
            return None
        r = results[0]
        pos = r.get("position", {})
        return {
            "lat": pos.get("lat"),
            "lon": pos.get("lon"),
            "address": r.get("address", {}).get("freeformAddress", query),
        }
    except Exception as e:
        logger.error("TomTom geocode failed: %s", e)
        return None


# ── TomTom Nearby POI Search ───────────────────────────────────────────

@api_retry
def search_nearby(
    lat: float,
    lon: float,
    api_key: str,
    category: str = "tourist attraction",
    limit: int = 10,
) -> list:
    """
    Search for points of interest near a location.

    Uses TomTom categorySearch first (more reliable), falls back to
    nearbySearch if no results.

    Returns: list of {"name", "category", "lat", "lon", "distance_m", "address"}.
    """
    if not api_key:
        return []

    # Strategy 1: Category search (text-based, better coverage)
    cat_query = category if category else "tourist attraction"
    url = f"{TOMTOM_BASE}/search/2/categorySearch/{requests.utils.quote(cat_query)}.json"
    params = {
        "key": api_key,
        "lat": lat,
        "lon": lon,
        "radius": 25000,  # 25 km
        "limit": limit,
        "countrySet": "IN",
    }

    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        results = res.json().get("results", [])
        if not results:
            # Strategy 2: Nearby search with category IDs
            url2 = f"{TOMTOM_BASE}/search/2/nearbySearch/.json"
            params2 = {
                "key": api_key,
                "lat": lat,
                "lon": lon,
                "radius": 50000,
                "limit": limit,
                "categorySet": _category_id(category),
            }
            res2 = requests.get(url2, params=params2, timeout=10)
            res2.raise_for_status()
            results = res2.json().get("results", [])

        pois = []
        for r in results:
            poi = r.get("poi", {})
            pos = r.get("position", {})
            # TomTom categories can be list of strings or list of dicts
            raw_cats = poi.get("categories", [])
            if raw_cats and isinstance(raw_cats[0], dict):
                cat_str = ", ".join(c.get("name", "") for c in raw_cats)
            else:
                cat_str = ", ".join(str(c) for c in raw_cats) if raw_cats else category
            pois.append({
                "name": poi.get("name", "Unknown"),
                "category": cat_str,
                "lat": pos.get("lat"),
                "lon": pos.get("lon"),
                "distance_m": round(r.get("dist", 0)),
                "address": r.get("address", {}).get("freeformAddress", ""),
                "phone": poi.get("phone", ""),
            })
        return pois
    except Exception as e:
        logger.error("TomTom POI search failed: %s", e)
        return []


# ── TomTom Routing ─────────────────────────────────────────────────────

@api_retry
def calculate_route(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    api_key: str,
    travel_mode: str = "car",
) -> Optional[dict]:
    """
    Calculate a route between two points using TomTom Routing API.

    Returns: {"distance_km", "duration_min", "geometry": [[lat, lon], ...]}.
    """
    if not api_key:
        return None

    locations = f"{origin_lat},{origin_lon}:{dest_lat},{dest_lon}"
    url = f"{TOMTOM_BASE}/routing/1/calculateRoute/{locations}/json"
    params = {
        "key": api_key,
        "travelMode": travel_mode,
        "traffic": "true",
        "routeRepresentation": "polyline",
    }

    try:
        res = requests.get(url, params=params, timeout=15)
        res.raise_for_status()
        data = res.json()
        routes = data.get("routes", [])
        if not routes:
            return None

        summary = routes[0].get("summary", {})
        legs = routes[0].get("legs", [])

        # Extract route polyline points
        geometry = []
        for leg in legs:
            for point in leg.get("points", []):
                geometry.append([point["latitude"], point["longitude"]])

        return {
            "distance_km": round(summary.get("lengthInMeters", 0) / 1000, 1),
            "duration_min": round(summary.get("travelTimeInSeconds", 0) / 60, 0),
            "traffic_delay_min": round(
                summary.get("trafficDelayInSeconds", 0) / 60, 0
            ),
            "departure": summary.get("departureTime", ""),
            "arrival": summary.get("arrivalTime", ""),
            "geometry": geometry,
        }
    except Exception as e:
        logger.error("TomTom routing failed: %s", e)
        return None


# ── Category mapping (TomTom category IDs) ─────────────────────────────

def _category_id(category: str) -> str:
    """Map human-readable category to TomTom category set IDs."""
    mapping = {
        "tourist attraction": "7376",
        "restaurant": "7315",
        "hotel": "7314",
        "hospital": "7321",
        "atm": "7397",
        "petrol station": "7311",
        "parking": "7313",
        "temple": "7321003",
        "beach": "9357",
        "museum": "7317",
        "shopping": "7373",
    }
    return mapping.get(category.lower(), "7376")


# ── Reverse Geocode (lat/lon → place name) ─────────────────────────────

@api_retry
def reverse_geocode(lat: float, lon: float, api_key: str) -> Optional[dict]:
    """
    Convert lat/lon to a place name using TomTom Reverse Geocode API.

    Returns: {"address": str, "city": str, "state": str, "country": str} or None.
    """
    if not api_key:
        return None

    url = f"{TOMTOM_BASE}/search/2/reverseGeocode/{lat},{lon}.json"
    params = {"key": api_key}

    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        addresses = res.json().get("addresses", [])
        if not addresses:
            return None
        addr = addresses[0].get("address", {})
        return {
            "address": addr.get("freeformAddress", ""),
            "city": addr.get("localName", addr.get("municipality", "")),
            "state": addr.get("countrySubdivision", ""),
            "country": addr.get("country", ""),
        }
    except Exception as e:
        logger.error("TomTom reverse geocode failed: %s", e)
        return None


# ── Find nearest known destination ─────────────────────────────────────

def find_nearest_destination(lat: float, lon: float) -> Optional[dict]:
    """
    Find the nearest pre-seeded destination to a given lat/lon.

    Returns: {"id": str, "label": str, "lat": float, "lon": float, "distance_km": float}
    """
    import math

    best = None
    best_dist = float("inf")

    for key, d in DESTINATION_COORDS.items():
        # Haversine formula
        dlat = math.radians(d["lat"] - lat)
        dlon = math.radians(d["lon"] - lon)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat))
            * math.cos(math.radians(d["lat"]))
            * math.sin(dlon / 2) ** 2
        )
        dist_km = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        if dist_km < best_dist:
            best_dist = dist_km
            best = {
                "id": key,
                "label": d["label"],
                "lat": d["lat"],
                "lon": d["lon"],
                "distance_km": round(dist_km, 1),
            }

    return best


# ── Smart Suggestions (multi-category nearby scan) ─────────────────────

SUGGESTION_CATEGORIES = [
    ("tourist attraction", "Tourist Attractions", "fas fa-camera"),
    ("restaurant", "Restaurants", "fas fa-utensils"),
    ("hotel", "Hotels", "fas fa-bed"),
    ("temple", "Temples & Shrines", "fas fa-place-of-worship"),
    ("hospital", "Hospitals", "fas fa-hospital"),
    ("atm", "ATMs & Banks", "fas fa-money-bill-wave"),
]


def get_smart_suggestions(
    lat: float, lon: float, api_key: str, limit_per_cat: int = 5
) -> dict:
    """
    Scan multiple POI categories around a location and return organized
    suggestions with the nearest known destination.

    Returns: {
        "location": {"lat", "lon", "address", "city"},
        "nearest_destination": {...} or null,
        "suggestions": [
            {"category", "label", "icon", "pois": [...]},
            ...
        ]
    }
    """
    result = {
        "location": {"lat": lat, "lon": lon, "address": "", "city": ""},
        "nearest_destination": None,
        "suggestions": [],
    }

    # Reverse geocode the position
    place = reverse_geocode(lat, lon, api_key)
    if place:
        result["location"]["address"] = place["address"]
        result["location"]["city"] = place["city"]

    # Nearest known destination
    result["nearest_destination"] = find_nearest_destination(lat, lon)

    # Fetch POIs for each category in parallel (6 concurrent TomTom calls)
    def _fetch_category(cat_key, cat_label, cat_icon):
        pois = search_nearby(lat, lon, api_key, category=cat_key, limit=limit_per_cat)
        return cat_key, cat_label, cat_icon, pois

    with ThreadPoolExecutor(max_workers=len(SUGGESTION_CATEGORIES)) as executor:
        futures = {
            executor.submit(_fetch_category, ck, cl, ci): ck
            for ck, cl, ci in SUGGESTION_CATEGORIES
        }
        # Collect results preserving original category order
        category_results = {}
        for future in as_completed(futures):
            try:
                cat_key, cat_label, cat_icon, pois = future.result()
                if pois:
                    category_results[cat_key] = {
                        "category": cat_key,
                        "label": cat_label,
                        "icon": cat_icon,
                        "count": len(pois),
                        "pois": pois,
                    }
            except Exception as exc:
                logger.error("Smart suggestions fetch failed for '%s': %s", futures[future], exc)

        # Preserve original category order
        for cat_key, _, _ in SUGGESTION_CATEGORIES:
            if cat_key in category_results:
                result["suggestions"].append(category_results[cat_key])

    return result
