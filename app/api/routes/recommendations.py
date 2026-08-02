"""
Recommendations API Route
==========================
GET /api/recommendations – Personalized destination recommendations
for the logged-in user, scored by the AI recommendation engine
(which blends offline-learned priors with heuristic scoring).

Query params (all optional):
    season        – "summer" | "winter" | "monsoon" | "spring" | "any"
    trip_duration – expected trip length in days (accepted, echoed back)
    group_size    – number of travelers (default 1)
    budget_max    – maximum daily budget per person (default 0 = unlimited)
    limit         – page size (default 10, max 50)
    offset        – pagination offset (default 0)

Response JSON:
    {
        "recommendations": [ { id, name, country, region, rating,
                               score (0-100), score_breakdown,
                               explanations, tags, avg_daily_cost,
                               categories }, ... ],
        "total": int,
        "context": { season, trip_duration, group_size, budget_max },
        "generated_at": ISO-8601
    }

Requires authentication (Flask-Login session).
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from app.services.ai_recommendations import (
    RecommendationContext,
    recommendation_service,
)

recommendations_bp = Blueprint("recommendations", __name__)
logger = logging.getLogger(__name__)

VALID_SEASONS = {"summer", "winter", "monsoon", "spring", "any"}


def _parse_int_arg(name: str, default: int, minimum: int, maximum: int) -> int:
    """Parse an integer query arg with clamping + validation errors via 400."""
    raw = request.args.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        abort_400(f"Invalid {name}: must be an integer")
    if value < minimum:
        abort_400(f"Invalid {name}: must be >= {minimum}")
    if value > maximum:
        abort_400(f"Invalid {name}: must be <= {maximum}")
    return value


def _parse_budget_arg() -> float:
    raw = request.args.get("budget_max")
    if raw is None or raw == "":
        return 0.0
    try:
        value = float(raw)
    except (TypeError, ValueError):
        abort_400("Invalid budget_max: must be a number")
    if value < 0:
        abort_400("Invalid budget_max: must be >= 0")
    return value


def abort_400(message: str):
    """Raise a 400 with a JSON error body (matching global error handlers)."""
    from werkzeug.exceptions import BadRequest

    raise BadRequest(description=message)


# ---------------------------------------------------------------------------
# GET /api/recommendations – personalized recommendations
# ---------------------------------------------------------------------------
@recommendations_bp.route("/api/recommendations", methods=["GET"])
@login_required
def get_recommendations():
    """Return personalized destination recommendations for the current user."""
    season = request.args.get("season", "").lower()
    if season and season not in VALID_SEASONS:
        abort_400(f"Invalid season: must be one of {sorted(VALID_SEASONS)}")

    trip_duration = _parse_int_arg("trip_duration", 0, 0, 365)
    group_size = _parse_int_arg("group_size", 1, 1, 100)
    limit = _parse_int_arg("limit", 10, 1, 50)
    offset = _parse_int_arg("offset", 0, 0, 10_000)
    budget_max = _parse_budget_arg()

    context = RecommendationContext(
        group_size=group_size,
        budget_max=budget_max,
        season=season or None,
    )

    try:
        # Candidate pool is capped at 50 by the service, so a single call with
        # limit=50 returns everything; pagination happens here for honest totals.
        all_items = recommendation_service.get_recommendations(
            user_id=str(current_user.id),
            context=context,
            limit=50,
            offset=0,
        )
    except Exception as e:
        logger.error(f"Recommendations failed for user {current_user.id}: {e}")
        return jsonify({"error": "Recommendations unavailable"}), 500

    total = len(all_items)
    page = all_items[offset : offset + limit]

    recommendations = [
        {
            "id": item.get("id"),
            "name": item.get("name", ""),
            "country": item.get("country", ""),
            "region": item.get("country", ""),
            "rating": item.get("rating", 0),
            "score": round(item.get("score", 0) * 100, 1),
            "score_breakdown": item.get("score_breakdown", {}),
            "explanations": ([item["reason"]] if item.get("reason") else []),
            "tags": item.get("highlights", []),
            "avg_daily_cost": item.get("avg_daily_cost", 0),
            "categories": item.get("categories", []),
        }
        for item in page
    ]

    return (
        jsonify(
            {
                "recommendations": recommendations,
                "total": total,
                "context": {
                    "season": season or "any",
                    "trip_duration": trip_duration,
                    "group_size": group_size,
                    "budget_max": budget_max if budget_max else None,
                },
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        ),
        200,
    )
