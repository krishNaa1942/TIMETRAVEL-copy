"""
Itinerary Generator API Route
================================
POST /api/itinerary/generate – AI-powered day-by-day trip itinerary.

Request JSON:
    {
        "destination": "Goa",
        "num_days": 5,
        "family_size": 4,
        "travel_class": "economy",
        "interests": "beaches, food, culture"
    }

Response JSON:
    {
        "destination": "Goa",
        "num_days": 5,
        "family_size": 4,
        "travel_class": "economy",
        "interests": "beaches, food, culture",
        "itinerary": [
            {
                "day": 1,
                "title": "Arrival & Beach Vibes",
                "morning":   { "activity": "...", "description": "...", "duration": "...", "cost": "..." },
                "afternoon": { "activity": "...", "description": "...", "duration": "...", "cost": "..." },
                "evening":   { "activity": "...", "description": "...", "duration": "...", "cost": "..." },
                "tip": "..."
            },
            ...
        ]
    }
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.itinerary_service import generate_itinerary
from app.utils.constants import VALID_DESTINATION_NAMES as VALID_DESTINATIONS, resolve_destination_key
from app.main import limiter

itinerary_bp = Blueprint("itinerary", __name__)


@itinerary_bp.route("/api/itinerary/generate", methods=["POST"])
@limiter.limit("10 per minute")
def itinerary_generate():
    """Generate a Gemini-powered day-by-day itinerary."""

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    destination = (data.get("destination") or "").strip()
    # Bug 3.1 fix: resolve canonical key BEFORE whitelist check so that
    # free-text from NLP (e.g. "munnar") maps correctly to the whitelist entry.
    destination = resolve_destination_key(destination)
    if not destination or destination not in VALID_DESTINATIONS:
        return jsonify({"error": f"Invalid destination. Choose from: {', '.join(sorted(VALID_DESTINATIONS))}"}), 400

    try:
        num_days = int(data.get("num_days", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "num_days must be an integer"}), 400

    if num_days < 1 or num_days > 14:
        return jsonify({"error": "num_days must be between 1 and 14"}), 400

    try:
        family_size = int(data.get("family_size", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "family_size must be an integer"}), 400

    if family_size < 1 or family_size > 20:
        return jsonify({"error": "family_size must be between 1 and 20"}), 400

    travel_class = data.get("travel_class", "economy")
    if travel_class not in ("economy", "comfort", "premium"):
        return jsonify({"error": "travel_class must be economy, comfort, or premium"}), 400

    interests = (data.get("interests") or "").strip()

    api_key = current_app.config.get("GOOGLE_API_KEY", "")
    if not api_key:
        return jsonify({"error": "Gemini AI is not configured. Set GOOGLE_API_KEY."}), 503

    result = generate_itinerary(
        destination=destination,
        num_days=num_days,
        family_size=family_size,
        travel_class=travel_class,
        interests=interests,
        api_key=api_key,
        maps_api_key=current_app.config.get("TOMTOM_API_KEY", ""),
    )

    # Bug 3.2 fix: only treat as a hard error if itinerary is missing.
    # Fallback itineraries carry both 'error' and 'itinerary' keys — they are
    # still valid responses that the client can render; sending them as 502
    # caused the mobile app to discard perfectly usable fallback data.
    if "error" in result and "itinerary" not in result:
        return jsonify(result), 502

    return jsonify(result)
