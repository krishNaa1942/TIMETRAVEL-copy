"""
Destinations API Route
========================
Provides destination listing, search, and featured/trending endpoints.

Endpoints:
- GET /api/destinations – Return all destinations
- GET /api/destinations/featured – Return featured destinations
- GET /api/destinations/trending – Return trending destinations
- GET /api/destinations/search?q=query – Search destinations
- GET /api/destinations/<id> – Return single destination
"""

from flask import Blueprint, jsonify, request
from app.utils.constants import DESTINATIONS

destinations_bp = Blueprint("destinations", __name__)


@destinations_bp.route("/api/destinations", methods=["GET"])
def list_destinations():
    """Return all supported destinations with rich metadata for frontend."""
    result = sorted(
        [
            {
                "id": key,
                "label": d["label"],
                "region": d.get("region", ""),
                "best_season": d.get("best_season", ""),
                "highlight": d.get("highlight", ""),
                "tagline": d.get("tagline", ""),
                "category": d.get("category", []),
                "lat": d.get("lat", 0),
                "lon": d.get("lon", 0),
            }
            for key, d in DESTINATIONS.items()
        ],
        key=lambda x: x["label"],
    )
    return jsonify({"destinations": result}), 200


@destinations_bp.route("/api/destinations/featured", methods=["GET"])
def get_featured_destinations():
    """Return featured destinations (curated popular destinations)."""
    # Featured destinations are popular tourist spots
    featured_ids = ["goa", "kerala_backwaters", "jaipur", "varanasi", "andaman"]
    
    result = []
    for key, d in DESTINATIONS.items():
        if key in featured_ids or d.get("featured", False):
            result.append({
                "id": key,
                "label": d["label"],
                "region": d.get("region", ""),
                "best_season": d.get("best_season", ""),
                "highlight": d.get("highlight", ""),
                "tagline": d.get("tagline", ""),
                "category": d.get("category", []),
                "lat": d.get("lat", 0),
                "lon": d.get("lon", 0),
            })
    
    # If no featured found, return first 5 destinations
    if not result:
        all_dests = sorted(
            [
                {
                    "id": key,
                    "label": d["label"],
                    "region": d.get("region", ""),
                    "best_season": d.get("best_season", ""),
                    "highlight": d.get("highlight", ""),
                    "tagline": d.get("tagline", ""),
                    "category": d.get("category", []),
                    "lat": d.get("lat", 0),
                    "lon": d.get("lon", 0),
                }
                for key, d in DESTINATIONS.items()
            ],
            key=lambda x: x["label"],
        )
        result = all_dests[:5]
    
    return jsonify({"destinations": result}), 200


@destinations_bp.route("/api/destinations/trending", methods=["GET"])
def get_trending_destinations():
    """Return trending destinations (most popular this season)."""
    import datetime

    month = datetime.date.today().month

    # Season-based trending weights: prioritize destinations matching current season
    season_keywords = {
        "winter": ["hill station", "desert", "heritage"],    # Nov-Feb
        "summer": ["mountain", "beach", "nature"],            # Mar-Jun
        "monsoon": ["nature", "spiritual", "culture"],        # Jul-Oct
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

    result = [
        {
            "id": key,
            "label": d["label"],
            "region": d.get("region", ""),
            "best_season": d.get("best_season", ""),
            "highlight": d.get("highlight", ""),
            "tagline": d.get("tagline", ""),
            "category": d.get("category", []),
            "lat": d.get("lat", 0),
            "lon": d.get("lon", 0),
        }
        for _, key, d in scored[:6]
    ]

    return jsonify({"destinations": result}), 200


@destinations_bp.route("/api/destinations/search", methods=["GET"])
def search_destinations():
    """Search destinations by query string."""
    query = request.args.get("q", "").lower().strip()
    
    if not query or len(query) < 2:
        return jsonify({"destinations": [], "query": query}), 200
    
    result = []
    for key, d in DESTINATIONS.items():
        # Search in label, region, tagline, and category
        searchable = " ".join([
            d.get("label", ""),
            d.get("region", ""),
            d.get("tagline", ""),
            " ".join(d.get("category", [])),
            d.get("highlight", ""),
        ]).lower()
        
        if query in searchable or query in key.lower():
            result.append({
                "id": key,
                "label": d["label"],
                "region": d.get("region", ""),
                "best_season": d.get("best_season", ""),
                "highlight": d.get("highlight", ""),
                "tagline": d.get("tagline", ""),
                "category": d.get("category", []),
                "lat": d.get("lat", 0),
                "lon": d.get("lon", 0),
            })
    
    return jsonify({"destinations": result, "query": query}), 200


@destinations_bp.route("/api/destinations/<destination_id>", methods=["GET"])
def get_destination_detail(destination_id):
    """Return single destination by ID."""
    dest = DESTINATIONS.get(destination_id)
    
    if not dest:
        return jsonify({"error": "Destination not found"}), 404
    
    result = {
        "id": destination_id,
        "label": dest["label"],
        "region": dest.get("region", ""),
        "best_season": dest.get("best_season", ""),
        "highlight": dest.get("highlight", ""),
        "tagline": dest.get("tagline", ""),
        "category": dest.get("category", []),
        "lat": dest.get("lat", 0),
        "lon": dest.get("lon", 0),
    }
    
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
            related.append({
                "id": key,
                "label": d["label"],
                "region": d.get("region", ""),
                "tagline": d.get("tagline", ""),
                "category": d.get("category", []),
            })
    
    return jsonify({"destination": result, "related": related[:4]}), 200