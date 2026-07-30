"""
Destination Comparison API Route
===================================
GET /api/compare?dest1=Goa&dest2=Jaipur&days=5&family=4&class=economy

Returns side-by-side budget, safety, and weather data for two destinations.
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required

from app.models.schemas import BudgetRequest
from app.services.budget_service import estimate_budget
from app.services.safety_service import get_safety_score
from app.services.weather_service import fetch_weather
from app.utils.constants import (
    VALID_DESTINATION_NAMES as VALID_DESTINATIONS,
    DESTINATION_LABELS,
    resolve_destination_key,
)
from app.main import limiter

compare_bp = Blueprint("compare", __name__)


@compare_bp.route("/api/compare", methods=["GET"])
@login_required
@limiter.limit("30 per minute")
def compare_destinations():
    """Compare two destinations side-by-side on budget, safety, weather."""

    dest1 = (request.args.get("dest1") or "").strip()
    dest2 = (request.args.get("dest2") or "").strip()

    if not dest1 or not dest2:
        return jsonify({"error": "Both dest1 and dest2 are required"}), 400

    if dest1 not in VALID_DESTINATIONS or dest2 not in VALID_DESTINATIONS:
        return jsonify({"error": "Invalid destination(s)"}), 400

    if dest1 == dest2:
        return jsonify({"error": "Please choose two different destinations"}), 400

    # Resolve to canonical keys for service lookups
    dest1 = resolve_destination_key(dest1)
    dest2 = resolve_destination_key(dest2)

    # Optional params for budget calculation
    try:
        num_days = int(request.args.get("days", 5))
    except (TypeError, ValueError):
        num_days = 5
    num_days = max(1, min(num_days, 30))

    try:
        family_size = int(request.args.get("family", 4))
    except (TypeError, ValueError):
        family_size = 4
    family_size = max(1, min(family_size, 20))

    travel_class = request.args.get("class", "economy")
    if travel_class not in ("economy", "comfort", "premium"):
        travel_class = "economy"

    # ── Gather data for both destinations ───────────────────────
    baselines_path = current_app.config["BUDGET_DATA_PATH"]
    safety_path = current_app.config["SAFETY_DATA_PATH"]
    weather_key = current_app.config.get("OPENWEATHER_API_KEY", "")
    weather_url = current_app.config.get("OPENWEATHER_BASE_URL")

    result = {
        "dest1": _build_profile(dest1, num_days, family_size, travel_class,
                                baselines_path, safety_path, weather_key, weather_url),
        "dest2": _build_profile(dest2, num_days, family_size, travel_class,
                                baselines_path, safety_path, weather_key, weather_url),
        "params": {
            "num_days": num_days,
            "family_size": family_size,
            "travel_class": travel_class,
        },
    }

    return jsonify(result), 200


def _build_profile(dest, num_days, family_size, travel_class,
                   baselines_path, safety_path, weather_key, weather_url):
    """Build a combined budget + safety + weather profile for one destination."""

    # Budget
    req = BudgetRequest(
        destination=dest,
        num_days=num_days,
        family_size=family_size,
        travel_class=travel_class,
    )
    budget = estimate_budget(req, baselines_path)

    # Safety
    safety = get_safety_score(dest, safety_path)

    # Weather (may be None if API key missing)
    weather_data = fetch_weather(dest, weather_key, weather_url) if weather_key else None

    profile = {
        "destination": DESTINATION_LABELS.get(dest, dest.title()),
        "budget": budget.to_dict(),
        "safety": safety.to_dict(),
        "weather": weather_data.to_dict() if weather_data else None,
    }

    return profile
