"""
Places API Route (Foursquare)
==============================
GET  /api/places/search             – Search places near a location
GET  /api/places/recommend          – Smart contextual recommendations
GET  /api/places/detail/<fsq_id>    – Full details for a single place
GET  /api/places/photos/<fsq_id>    – Photos for a place
GET  /api/places/tips/<fsq_id>      – User tips/reviews
GET  /api/places/categories         – List supported categories
GET  /api/places/status             – Check if Foursquare is available

Enriches the travel experience with ratings, reviews, photos, prices, hours.
"""

import datetime
import re

from flask import Blueprint, request, jsonify, current_app

from app.main import limiter
from app.services.foursquare_service import (
    search_places,
    get_place_details,
    get_place_photos,
    get_place_tips,
    get_categories,
    is_available,
)

places_bp = Blueprint("places", __name__)

_FSQ_ID_RE = re.compile(r"^[a-f0-9]{10,50}$")


def _fsq_creds() -> dict:
    """Return all Foursquare credentials from config."""
    return {
        "api_key": current_app.config.get("FOURSQUARE_API_KEY", ""),
        "client_id": current_app.config.get("FOURSQUARE_CLIENT_ID", ""),
        "client_secret": current_app.config.get("FOURSQUARE_CLIENT_SECRET", ""),
    }


# ── GET /api/places/search ────────────────────────────────
@places_bp.route("/api/places/search", methods=["GET"])
@limiter.limit("30 per minute")
def places_search():
    """
    Search for places near a location.

    Query params:
        lat (required): Latitude
        lon (required): Longitude
        category: Category key (default: tourist attraction)
        radius: Search radius in meters (default: 15000)
        limit: Max results (default: 10)
        query: Optional text search
    """
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)

    if lat is None or lon is None:
        return jsonify({"error": "Missing lat/lon parameters"}), 400

    creds = _fsq_creds()
    if not is_available(creds):
        return jsonify({"error": "Foursquare not configured", "places": []}), 503

    category = request.args.get("category", "tourist attraction")
    radius = request.args.get("radius", 15000, type=int)
    limit = request.args.get("limit", 10, type=int)
    query = request.args.get("query", "")

    places = search_places(lat, lon, creds, category, radius, limit, query)

    return (
        jsonify(
            {
                "count": len(places),
                "category": category,
                "places": places,
            }
        ),
        200,
    )


# ── Smart recommendation logic ────────────────────────────

# Maps situation → preferred categories + sort weighting
_SITUATION_PROFILES = {
    "hungry": {
        "categories": ["restaurant", "cafe"],
        "label": "Food & Dining",
        "icon": "fa-utensils",
    },
    "exploring": {
        "categories": ["tourist attraction", "museum", "temple", "beach"],
        "label": "Sightseeing",
        "icon": "fa-binoculars",
    },
    "relaxing": {
        "categories": ["spa", "park", "beach", "cafe"],
        "label": "Relax & Unwind",
        "icon": "fa-spa",
    },
    "shopping": {
        "categories": ["shopping"],
        "label": "Shopping",
        "icon": "fa-shopping-bag",
    },
    "nightlife": {
        "categories": ["nightlife", "restaurant"],
        "label": "Evening Out",
        "icon": "fa-moon",
    },
    "emergency": {
        "categories": ["hospital", "pharmacy", "atm"],
        "label": "Emergency & Essentials",
        "icon": "fa-first-aid",
    },
    "family": {
        "categories": ["park", "museum", "restaurant", "tourist attraction"],
        "label": "Family Friendly",
        "icon": "fa-users",
    },
}

# Time-of-day heuristics
_TIME_CATEGORIES = {
    "morning": {"categories": ["cafe", "restaurant", "park"], "label": "Morning Picks"},
    "afternoon": {
        "categories": ["tourist attraction", "museum", "shopping", "restaurant"],
        "label": "Afternoon Picks",
    },
    "evening": {
        "categories": ["restaurant", "nightlife", "cafe"],
        "label": "Evening Picks",
    },
    "night": {
        "categories": ["nightlife", "restaurant", "hotel"],
        "label": "Late Night Picks",
    },
}

# Weather-based adjustments
_WEATHER_INDOOR = {
    "museum",
    "shopping",
    "cafe",
    "restaurant",
    "spa",
    "nightlife",
    "hotel",
}
_WEATHER_OUTDOOR = {"tourist attraction", "beach", "park", "temple"}


def _get_time_slot():
    """Determine time-of-day slot from server time."""
    hour = datetime.datetime.now().hour
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return "night"


def _build_recommendation_context(situation, weather_condition):
    """Build a list of categories + reasoning based on situation, time, weather."""
    time_slot = _get_time_slot()
    time_info = _TIME_CATEGORIES.get(time_slot, _TIME_CATEGORIES["afternoon"])

    reasons = []
    categories = []

    # Situation-based categories (highest priority)
    if situation and situation in _SITUATION_PROFILES:
        profile = _SITUATION_PROFILES[situation]
        categories.extend(profile["categories"])
        reasons.append(f"{profile['label']} — based on your current need")

    # Time-based categories
    time_cats = time_info["categories"]
    reasons.append(f"{time_info['label']} — it's {time_slot}")
    if not categories:
        categories.extend(time_cats)
    else:
        # Merge: boost categories that match both situation + time
        for c in time_cats:
            if c not in categories:
                categories.append(c)

    # Weather-based filtering
    if weather_condition:
        wc = weather_condition.lower()
        is_bad = any(
            w in wc
            for w in ("rain", "storm", "thunder", "snow", "drizzle", "fog", "mist")
        )
        if is_bad:
            categories = [c for c in categories if c in _WEATHER_INDOOR] or list(
                _WEATHER_INDOOR
            )[:4]
            reasons.append(f"Indoor places preferred — weather: {weather_condition}")
        elif any(w in wc for w in ("clear", "sunny", "fair")):
            # Boost outdoor activities
            outdoor = [c for c in categories if c in _WEATHER_OUTDOOR]
            indoor = [c for c in categories if c not in _WEATHER_OUTDOOR]
            categories = outdoor + indoor
            reasons.append(f"Great outdoor weather — {weather_condition}")

    # Deduplicate preserving order
    seen = set()
    unique_cats = []
    for c in categories:
        if c not in seen:
            seen.add(c)
            unique_cats.append(c)

    return unique_cats, reasons, time_slot


# ── GET /api/places/recommend ─────────────────────────────
@places_bp.route("/api/places/recommend", methods=["GET"])
@limiter.limit("30 per minute")
def places_recommend():
    """
    Smart contextual place recommendations.

    Query params:
        lat (required): Latitude
        lon (required): Longitude
        situation: User's current situation (hungry, exploring, relaxing, shopping, nightlife, emergency, family)
        weather: Current weather condition text (e.g. "Rain", "Clear sky")
        limit: Max results per category (default: 6)
        radius: Search radius in meters (default: 15000)
    """
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)

    if lat is None or lon is None:
        return jsonify({"error": "Missing lat/lon parameters"}), 400

    creds = _fsq_creds()
    if not is_available(creds):
        return jsonify({"error": "Foursquare not configured"}), 503

    situation = request.args.get("situation", "").strip().lower()
    weather_condition = request.args.get("weather", "").strip()
    limit = min(request.args.get("limit", 6, type=int), 20)
    radius = min(request.args.get("radius", 15000, type=int), 50000)

    categories, reasons, time_slot = _build_recommendation_context(
        situation, weather_condition
    )

    # Fetch places for each recommended category
    all_places = []
    seen_ids = set()
    for cat in categories[:4]:  # Max 4 categories to limit API calls
        results = search_places(lat, lon, creds, cat, radius, limit)
        for p in results:
            if p["fsq_id"] not in seen_ids:
                seen_ids.add(p["fsq_id"])
                p["recommended_for"] = cat
                all_places.append(p)

    # Sort: open places first, then by rating (desc), then by popularity (desc)
    def sort_key(p):
        is_open = 1 if p.get("is_open") else 0
        rating = p.get("rating") or 0
        popularity = p.get("popularity") or 0
        return (-is_open, -rating, -popularity)

    all_places.sort(key=sort_key)

    return (
        jsonify(
            {
                "count": len(all_places),
                "situation": situation or "general",
                "time_slot": time_slot,
                "weather": weather_condition or None,
                "reasons": reasons,
                "categories_searched": categories[:4],
                "places": all_places,
            }
        ),
        200,
    )


# ── GET /api/places/detail/<fsq_id> ──────────────────────
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by PlaceDetailScreen is a trip-place modal, not Foursquare detail. See FRONTEND_AUDIT.md Phase D.
@places_bp.route("/api/places/detail/<fsq_id>", methods=["GET"])
@limiter.limit("30 per minute")
def place_detail(fsq_id: str):
    """Get full details for a Foursquare place."""
    if not _FSQ_ID_RE.match(fsq_id):
        return jsonify({"error": "Invalid place ID"}), 400

    creds = _fsq_creds()
    if not is_available(creds):
        return jsonify({"error": "Foursquare not configured"}), 503

    detail = get_place_details(fsq_id, creds)
    if not detail:
        return (
            jsonify(
                {
                    "error": "Could not retrieve place details. The service may be temporarily unavailable."
                }
            ),
            502,
        )

    return jsonify({"place": detail}), 200


# ── GET /api/places/photos/<fsq_id> ──────────────────────
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no consumer. See FRONTEND_AUDIT.md Phase D.
@places_bp.route("/api/places/photos/<fsq_id>", methods=["GET"])
@limiter.limit("30 per minute")
def place_photos(fsq_id: str):
    """Get photos for a Foursquare place."""
    if not _FSQ_ID_RE.match(fsq_id):
        return jsonify({"error": "Invalid place ID"}), 400

    creds = _fsq_creds()
    if not is_available(creds):
        return jsonify({"error": "Foursquare not configured"}), 503

    limit = request.args.get("limit", 6, type=int)
    photos = get_place_photos(fsq_id, creds, limit)

    return (
        jsonify(
            {
                "fsq_id": fsq_id,
                "count": len(photos),
                "photos": photos,
            }
        ),
        200,
    )


# ── GET /api/places/tips/<fsq_id> ────────────────────────
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no consumer. See FRONTEND_AUDIT.md Phase D.
@places_bp.route("/api/places/tips/<fsq_id>", methods=["GET"])
@limiter.limit("30 per minute")
def place_tips(fsq_id: str):
    """Get user tips for a Foursquare place."""
    if not _FSQ_ID_RE.match(fsq_id):
        return jsonify({"error": "Invalid place ID"}), 400

    creds = _fsq_creds()
    if not is_available(creds):
        return jsonify({"error": "Foursquare not configured"}), 503

    limit = request.args.get("limit", 5, type=int)
    tips = get_place_tips(fsq_id, creds, limit)

    return (
        jsonify(
            {
                "fsq_id": fsq_id,
                "count": len(tips),
                "tips": tips,
            }
        ),
        200,
    )


# ── GET /api/places/categories ────────────────────────────
@places_bp.route("/api/places/categories", methods=["GET"])
def places_categories():
    """Return the list of supported place categories."""
    return jsonify({"categories": get_categories()}), 200


# ── GET /api/places/status ────────────────────────────────
@places_bp.route("/api/places/status", methods=["GET"])
def places_status():
    """Check if the Foursquare Places service is available."""
    creds = _fsq_creds()
    return (
        jsonify(
            {
                "available": is_available(creds),
                "provider": "Foursquare",
            }
        ),
        200,
    )
