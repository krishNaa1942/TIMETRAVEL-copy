"""
Destinations API Route
========================
Provides destination listing, search, and featured/trending endpoints.

Endpoints:
- GET /api/destinations – Return destinations, honoring
  query/category/region/budget/sortBy filters (see `list_destinations`)
- GET /api/destinations/featured – Return featured destinations
- GET /api/destinations/trending – Return trending destinations
- GET /api/destinations/search?q=query – Search destinations
- GET /api/destinations/<id> – Return single destination
"""

import functools
import json
import logging
from pathlib import Path

from flask import Blueprint, jsonify, request
from app.utils.constants import DESTINATIONS

destinations_bp = Blueprint("destinations", __name__)
logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parents[3] / "data"

# Budget tier thresholds (INR per day, from data/budget_baselines.json totals)
_BUDGET_TIERS = [
    ("budget", 0, 3000),
    ("mid-range", 3000, 5000),
    ("luxury", 5000, float("inf")),
]

# Category filter → destination category keywords (destination data categories)
_CATEGORY_KEYWORDS = {
    "beach": ["beach", "island", "coast", "backwaters"],
    "mountain": ["hill_station", "mountain"],
    "city": ["urban"],
    "spiritual": ["religious", "spiritual"],
    "heritage": ["heritage"],
    "adventure": ["adventure"],
    "nature": ["nature", "wildlife", "backwaters"],
    "wildlife": ["wildlife"],
    "island": ["island"],
    "desert": ["desert"],
    "backwaters": ["backwaters"],
}


def _load_json(name: str):
    """Load a JSON data file from data/, returning {} on any failure."""
    try:
        with open(_DATA_DIR / name) as fh:
            return json.load(fh)
    except (OSError, ValueError) as exc:
        logger.warning("Could not load %s: %s", name, exc)
        return {}


@functools.lru_cache(maxsize=1)
def _budget_baselines():
    """{destination_id: total_daily_cost_inr} from data/budget_baselines.json."""
    raw = _load_json("budget_baselines.json")
    totals = {}
    for key, breakdown in raw.items():
        if isinstance(breakdown, dict):
            totals[key] = sum(
                v for v in breakdown.values() if isinstance(v, (int, float))
            )
    return totals


@functools.lru_cache(maxsize=1)
def _safety_scores():
    """{destination_id: {scores}} from data/safety_scores.json."""
    return _load_json("safety_scores.json")


def _budget_level(cost: float) -> str:
    """Map a daily cost (INR) to a budget tier."""
    if not cost or cost <= 0:
        return "mid-range"
    for tier, low, high in _BUDGET_TIERS:
        if low <= cost < high:
            return tier
    return "luxury"


def _learned():
    """Lazily load the shared LearnedPriors singleton (degrades to None)."""
    try:
        from app.services.learned_prior import LearnedPriors

        return LearnedPriors.get_instance()
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("LearnedPriors unavailable: %s", exc)
        return None


# Memoized per-name predictions so repeated requests don't re-run inference
_rating_cache = {}
_popularity_cache = {}


def _rating(key: str, name: str) -> float:
    """Best-effort rating: learned prior (0-5) or safety-score proxy (0-5)."""
    cached = _rating_cache.get(name)
    if cached is not None:
        return cached
    value = None
    learned = _learned()
    if learned is not None and learned.is_available:
        prior = learned.quality(name)
        if prior is not None:
            value = round(float(prior), 2)
    if value is None:
        safety = _safety_scores().get(key, {})
        friendliness = safety.get("tourist_friendliness")
        if friendliness is not None:
            value = round(float(friendliness) / 1.5, 2)  # 7.5/5 scale proxy
        else:
            value = 3.5
    _rating_cache[name] = value
    return value


def _popularity(key: str, name: str) -> float:
    """Best-effort popularity (0-1): learned prior or stable id-hash fallback."""
    cached = _popularity_cache.get(name)
    if cached is not None:
        return cached
    value = None
    learned = _learned()
    if learned is not None and learned.is_available:
        prior = learned.popularity(name)
        if prior is not None:
            value = round(float(prior), 4)
    if value is None:
        # Deterministic stable ordering when ML artifacts are absent
        value = round((sum(ord(c) for c in key) % 100) / 100, 4)
    _popularity_cache[name] = value
    return value


def _build_item(key: str, dest: dict) -> dict:
    """Build the API item for a destination, enriched with budget/rating data."""
    daily_cost = _budget_baselines().get(key, 0)
    return {
        "id": key,
        "label": dest.get("label", ""),
        "region": dest.get("region", ""),
        "best_season": dest.get("best_season", ""),
        "highlight": dest.get("highlight", ""),
        "tagline": dest.get("tagline", ""),
        "category": dest.get("category", []),
        "lat": dest.get("lat", 0),
        "lon": dest.get("lon", 0),
        "budgetLevel": _budget_level(daily_cost),
        "daily_cost": round(daily_cost, 2) if daily_cost else None,
        "rating": _rating(key, dest.get("label", "")),
    }


def _category_matches(dest_categories, category: str) -> bool:
    """Loose category match against destination category keywords."""
    if not category:
        return True
    keywords = _CATEGORY_KEYWORDS.get(category, [category])
    normalized = [c.lower().replace(" ", "_") for c in dest_categories]
    return any(kw in nc for kw in keywords for nc in normalized)


# ---------------------------------------------------------------------------
# GET /api/destinations – filterable destination list
# ---------------------------------------------------------------------------
@destinations_bp.route("/api/destinations", methods=["GET"])
def list_destinations():
    """Return destinations, honoring optional filters:
    query, category, region, budget (budget/mid-range/luxury), sortBy
    (rating/popularity/price). All filters are applied server-side so the
    client sends the same params the app already uses.
    """
    query = request.args.get("query", "").strip().lower()
    category = request.args.get("category", "").strip().lower()
    region = request.args.get("region", "").strip().lower()
    budget = request.args.get("budget", "").strip().lower()
    sort_by = request.args.get("sortBy", "").strip().lower()

    items = []
    for key, d in DESTINATIONS.items():
        item = _build_item(key, d)

        if query:
            searchable = " ".join(
                [
                    item["label"],
                    item["region"],
                    item["tagline"],
                    " ".join(item["category"]),
                    item["highlight"],
                    key,
                ]
            ).lower()
            if query not in searchable:
                continue

        if not _category_matches(item["category"], category):
            continue

        if region and region not in item["region"].lower():
            continue

        if budget and item["budgetLevel"] != budget:
            continue

        items.append(item)

    if sort_by == "rating":
        items.sort(key=lambda x: x["rating"], reverse=True)
    elif sort_by == "popularity":
        items.sort(key=lambda x: _popularity(x["id"], x["label"]), reverse=True)
    elif sort_by == "price":
        items.sort(key=lambda x: (x["daily_cost"] or 0, x["label"]))
    else:
        items.sort(key=lambda x: x["label"])

    return jsonify({"destinations": items}), 200


# ---------------------------------------------------------------------------
# GET /api/destinations/featured – curated popular destinations
# ---------------------------------------------------------------------------
@destinations_bp.route("/api/destinations/featured", methods=["GET"])
def get_featured_destinations():
    """Return featured destinations (curated popular destinations)."""
    # Featured destinations are popular tourist spots
    featured_ids = ["goa", "kerala_backwaters", "jaipur", "varanasi", "andaman"]

    result = []
    for key, d in DESTINATIONS.items():
        if key in featured_ids or d.get("featured", False):
            result.append(_build_item(key, d))

    # If no featured found, return first 5 destinations
    if not result:
        result = [
            _build_item(key, d)
            for key, d in sorted(DESTINATIONS.items(), key=lambda kv: kv[1]["label"])
        ][:5]

    return jsonify({"destinations": result}), 200


# ---------------------------------------------------------------------------
# GET /api/destinations/trending – most popular this season
# ---------------------------------------------------------------------------
@destinations_bp.route("/api/destinations/trending", methods=["GET"])
def get_trending_destinations():
    """Return trending destinations (most popular this season)."""
    import datetime

    month = datetime.date.today().month

    # Season-based trending weights: prioritize destinations matching current season
    season_keywords = {
        "winter": ["hill station", "desert", "heritage"],  # Nov-Feb
        "summer": ["mountain", "beach", "nature"],  # Mar-Jun
        "monsoon": ["nature", "spiritual", "culture"],  # Jul-Oct
    }
    if month in (11, 12, 1, 2):
        preferred = season_keywords["winter"]
    elif month in (3, 4, 5, 6):
        preferred = season_keywords["summer"]
    else:
        preferred = season_keywords["monsoon"]

    scored = []
    for key, d in DESTINATIONS.items():
        dest_cats = [c.lower() for c in d.get("category", [])]
        # Higher score if destination category overlaps with seasonal preferences
        overlap = sum(1 for kw in preferred if any(kw in c for c in dest_cats))
        scored.append((overlap, key, d))

    # Sort by relevance (descending), then alphabetically for ties
    scored.sort(key=lambda x: (-x[0], x[2].get("label", "")))

    result = [_build_item(key, d) for _, key, d in scored[:6]]

    return jsonify({"destinations": result}), 200


# ---------------------------------------------------------------------------
# GET /api/destinations/search – text search
# ---------------------------------------------------------------------------
@destinations_bp.route("/api/destinations/search", methods=["GET"])
def search_destinations():
    """Search destinations by query string."""
    query = request.args.get("q", "").lower().strip()

    if not query or len(query) < 2:
        return jsonify({"destinations": [], "query": query}), 200

    result = []
    for key, d in DESTINATIONS.items():
        # Search in label, region, tagline, and category
        searchable = " ".join(
            [
                d.get("label", ""),
                d.get("region", ""),
                d.get("tagline", ""),
                " ".join(d.get("category", [])),
                d.get("highlight", ""),
            ]
        ).lower()

        if query in searchable or query in key.lower():
            result.append(_build_item(key, d))

    return jsonify({"destinations": result, "query": query}), 200


# ---------------------------------------------------------------------------
# GET /api/destinations/<id> – single destination
# ---------------------------------------------------------------------------
@destinations_bp.route("/api/destinations/<destination_id>", methods=["GET"])
def get_destination_detail(destination_id):
    """Return single destination by ID."""
    dest = DESTINATIONS.get(destination_id)

    if not dest:
        return jsonify({"error": "Destination not found"}), 404

    result = _build_item(destination_id, dest)

    # Find related destinations (same region or category)
    related = []
    for key, d in DESTINATIONS.items():
        if key == destination_id:
            continue

        # Check if same region or overlapping categories
        same_region = d.get("region") == dest.get("region")
        dest_categories = set(dest.get("category", []))
        d_categories = set(d.get("category", []))
        overlapping_categories = bool(dest_categories & d_categories)

        if same_region or overlapping_categories:
            related.append(
                {
                    "id": key,
                    "label": d["label"],
                    "region": d.get("region", ""),
                    "tagline": d.get("tagline", ""),
                    "category": d.get("category", []),
                }
            )

    return jsonify({"destination": result, "related": related[:4]}), 200
