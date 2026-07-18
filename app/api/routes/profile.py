"""
Profile API routes for the mobile profile dashboard.

Provides a single backend-backed summary payload that the mobile app can
render without fabricating local intelligence.
"""

from __future__ import annotations

import asyncio
import logging
import math
from functools import wraps

from flask import Blueprint, jsonify, request, g
from flask_login import current_user

from app.api.routes.travel_stats import get_travel_stats
from app.models.database import db
from app.models.entities import Trip, User
from app.services.ai_insights_service import ai_insights_service, UserContext
from app.services.jwt_service_v2 import jwt_service_v2, TokenType
from app.services.user_preferences import user_preferences_service

logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")


def _resolve_authenticated_user() -> int | None:
    """Resolve the current user from either a session cookie or bearer token."""
    if current_user.is_authenticated:
        user_id = getattr(current_user, "id", None)
        if user_id is not None:
            g.user_id = user_id
            g.user_email = getattr(current_user, "email", None)
            return int(user_id)

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]
    payload = jwt_service_v2.verify_token(token, TokenType.ACCESS)
    if not payload:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    g.user_id = user_id
    g.user_email = payload.get("email")

    try:
        return int(user_id)
    except (TypeError, ValueError):
        return None


def _load_user(user_id: int) -> User | None:
    return db.session.get(User, user_id)


def _run_sync(coro):
    """Run an async helper from the sync Flask route."""
    return asyncio.run(coro)


def _calculate_total_xp(stats: dict) -> int:
    trips = stats.get("trips", {})
    favorites_count = int(stats.get("favorites_count", 0) or 0)
    places_visited = int(stats.get("places_visited", 0) or 0)
    travel_days = int(stats.get("total_travel_days", 0) or 0)
    total_spent = float(stats.get("total_spent", 0) or 0)

    return (
        int(trips.get("total", 0) or 0) * 40
        + int(trips.get("completed", 0) or 0) * 30
        + int(trips.get("active", 0) or 0) * 20
        + favorites_count * 8
        + places_visited * 2
        + travel_days * 3
        + int(total_spent // 5000) * 5
    )


def _calculate_level(total_xp: int) -> dict:
    level = 1
    remaining_xp = total_xp
    xp_for_current_level = 100

    while remaining_xp >= xp_for_current_level and level < 100:
        remaining_xp -= xp_for_current_level
        level += 1
        xp_for_current_level = math.floor(100 * math.pow(1.5, level - 1))

    titles = [
        "Newcomer",
        "Wanderer",
        "Explorer",
        "Adventurer",
        "Globe Trotter",
        "Jet Setter",
        "World Citizen",
        "Travel Master",
        "Globe Master",
        "Legendary Voyager",
    ]

    progress = int((remaining_xp / xp_for_current_level) * 100) if xp_for_current_level else 0

    return {
        "level": level,
        "xp": remaining_xp,
        "xpToNext": xp_for_current_level,
        "title": titles[min(level - 1, len(titles) - 1)],
        "progress": min(100, progress),
    }


def _build_travel_dna(stats: dict, context_data: dict) -> dict:
    trips = stats.get("trips", {})
    active_trips = int(trips.get("active", 0) or 0)
    completed_trips = int(trips.get("completed", 0) or 0)
    trip_total = int(trips.get("total", 0) or 0)
    favorites_count = len(context_data.get("favorite_destinations", []))
    search_activity = len(context_data.get("recent_searches", []))
    places_visited = int(stats.get("places_visited", 0) or 0)
    total_spent = float(stats.get("total_spent", 0) or 0)
    budget_preference = str(context_data.get("preferences", {}).get("budget_preference", "moderate"))

    dna = {
        "explorer": min(100, trip_total * 12 + places_visited * 2),
        "foodie": min(100, search_activity * 8 + favorites_count * 2),
        "luxury": min(100, int(total_spent // 10000) * 6 + active_trips * 3),
        "adventure": min(100, completed_trips * 10 + active_trips * 8),
        "culture": min(100, places_visited * 3 + favorites_count * 2),
        "relaxation": min(100, 30 + max(0, favorites_count - active_trips) * 4),
        "budget": min(100, 90 if budget_preference == "budget" else 65 if budget_preference == "moderate" else 35),
        "social": min(100, favorites_count * 4 + completed_trips * 3),
    }

    return {key: int(value) for key, value in dna.items()}


def _build_personality(dna: dict, context_data: dict) -> dict:
    preference_style = str(context_data.get("preferences", {}).get("travel_style", "")).lower()

    style_map = {
        "adventure": {
            "icon": "🏔️",
            "color": "#EF4444",
            "label": "Thrill Seeker",
            "description": "You lean toward active, high-energy travel.",
        },
        "relaxation": {
            "icon": "🧘",
            "color": "#10B981",
            "label": "Zen Wanderer",
            "description": "You prefer calm, restorative travel.",
        },
        "cultural": {
            "icon": "🏛️",
            "color": "#EC4899",
            "label": "Culture Enthusiast",
            "description": "You are drawn to history, art, and local character.",
        },
        "business": {
            "icon": "💼",
            "color": "#3B82F6",
            "label": "Efficient Traveler",
            "description": "You value structured, purposeful travel.",
        },
    }

    dominant_trait = max(dna.items(), key=lambda item: item[1])[0] if dna else "explorer"
    trait_map = {
        "explorer": {
            "icon": "🌍",
            "color": "#3B82F6",
            "label": "Globe Trekker",
            "description": "You seek new horizons and hidden gems.",
        },
        "foodie": {
            "icon": "🍽️",
            "color": "#F59E0B",
            "label": "Culinary Voyager",
            "description": "You travel for tastes and culinary experiences.",
        },
        "luxury": {
            "icon": "💎",
            "color": "#8B5CF6",
            "label": "Luxury Connoisseur",
            "description": "You appreciate elevated experiences.",
        },
        "adventure": {
            "icon": "🏔️",
            "color": "#EF4444",
            "label": "Thrill Seeker",
            "description": "You lean toward active, high-energy travel.",
        },
        "culture": {
            "icon": "🏛️",
            "color": "#EC4899",
            "label": "Culture Enthusiast",
            "description": "You are drawn to history, art, and local character.",
        },
        "relaxation": {
            "icon": "🧘",
            "color": "#10B981",
            "label": "Zen Wanderer",
            "description": "You prefer calm, restorative travel.",
        },
        "budget": {
            "icon": "💡",
            "color": "#06B6D4",
            "label": "Smart Traveler",
            "description": "You maximize value and keep spending intentional.",
        },
        "social": {
            "icon": "🦋",
            "color": "#F97316",
            "label": "Social Butterfly",
            "description": "You enjoy shared experiences and group travel.",
        },
    }

    return style_map.get(preference_style) or trait_map.get(dominant_trait, trait_map["explorer"])


def _build_smart_actions(stats: dict) -> list[dict]:
    trips = stats.get("trips", {})
    active_trips = int(trips.get("active", 0) or 0)
    favorites_count = int(stats.get("favorites_count", 0) or 0)
    places_visited = int(stats.get("places_visited", 0) or 0)
    total_spent = float(stats.get("total_spent", 0) or 0)

    actions: list[dict] = []

    if active_trips > 0:
        actions.append({
            "id": "resume-planning",
            "icon": "🗺️",
            "title": "Resume Planning",
            "subtitle": "Continue your active trip",
            "color": "#3B82F6",
            "route": "TripWorkspace",
            "priority": 1,
            "visible": True,
        })

    if favorites_count > 0:
        actions.append({
            "id": "view-saved",
            "icon": "❤️",
            "title": "Open Saved",
            "subtitle": "Review destinations you saved",
            "color": "#EC4899",
            "route": "Favorites",
            "priority": 2,
            "visible": True,
        })

    if places_visited > 0:
        actions.append({
            "id": "view-stats",
            "icon": "📊",
            "title": "View Travel Stats",
            "subtitle": "See your travel history",
            "color": "#10B981",
            "route": "TravelStats",
            "priority": 3,
            "visible": True,
        })

    if total_spent > 0:
        actions.append({
            "id": "plan-budget",
            "icon": "💰",
            "title": "Plan Budget",
            "subtitle": "Track upcoming travel spend",
            "color": "#F59E0B",
            "route": "Budget",
            "priority": 4,
            "visible": True,
        })

    actions.append({
        "id": "discover-new",
        "icon": "✨",
        "title": "Discover New Places",
        "subtitle": "Browse server-ranked recommendations",
        "color": "#8B5CF6",
        "route": "Places",
        "priority": 5,
        "visible": True,
    })

    return sorted(actions, key=lambda action: action["priority"])


def _build_quick_actions(stats: dict) -> list[dict]:
    trips = stats.get("trips", {})
    return [
        {
            "id": "quick-trips",
            "icon": "🧳",
            "label": "My Trips",
            "count": int(trips.get("total", 0) or 0),
            "route": "TripWorkspace",
        },
        {
            "id": "quick-saved",
            "icon": "❤️",
            "label": "Saved",
            "count": int(stats.get("favorites_count", 0) or 0),
            "route": "Favorites",
        },
        {
            "id": "quick-stats",
            "icon": "📊",
            "label": "Stats",
            "count": int(stats.get("places_visited", 0) or 0),
            "route": "TravelStats",
        },
        {
            "id": "quick-settings",
            "icon": "⚙️",
            "label": "Settings",
            "count": None,
            "route": "RoutePlanner",
        },
    ]


def _normalize_insight(insight: dict) -> dict:
    type_map = {
        "recommendation": "suggestion",
        "tip": "reminder",
        "alert": "reminder",
        "prediction": "trend",
        "trend": "trend",
        "personalized_suggestion": "suggestion",
        "price_insight": "suggestion",
        "seasonal_insight": "suggestion",
        "budget_insight": "reminder",
        "safety_insight": "reminder",
    }

    icon_map = {
        "recommendation": "✨",
        "tip": "💡",
        "alert": "⚠️",
        "prediction": "🔮",
        "trend": "📈",
        "personalized_suggestion": "✨",
        "price_insight": "💸",
        "seasonal_insight": "🌤️",
        "budget_insight": "🧭",
        "safety_insight": "🛡️",
    }

    action_route_map = {
        "budget_insight": "Budget",
        "safety_insight": "TravelStats",
    }

    insight_type = str(insight.get("type", "suggestion"))
    message = insight.get("content") or insight.get("title") or "Travel insight available."

    return {
        "id": insight.get("id"),
        "type": type_map.get(insight_type, "suggestion"),
        "icon": icon_map.get(insight_type, "✨"),
        "message": message,
        "actionable": bool(insight.get("is_actionable")),
        "actionLabel": insight.get("action_text"),
        "actionRoute": action_route_map.get(insight_type),
    }


def _build_user_context(user: User, stats: dict, context_data: dict) -> UserContext:
    trips = Trip.query.filter_by(user_id=user.id).order_by(Trip.created_at.desc()).all()
    completed_trips = [trip for trip in trips if trip.status == "completed"]
    active_trips = [trip for trip in trips if trip.status == "active"]
    upcoming_trips = [trip for trip in trips if trip.status in {"planning", "active"}]

    search_history = [{"query": query} for query in context_data.get("recent_searches", []) if query]

    return UserContext(
        user_id=str(user.id),
        preferences=context_data.get("preferences", {}),
        search_history=search_history,
        booking_history=[trip.to_dict() for trip in completed_trips[:10]],
        saved_destinations=context_data.get("favorite_destinations", []),
        active_trips=[trip.to_dict() for trip in active_trips[:10]],
        upcoming_trips=[trip.to_dict() for trip in upcoming_trips[:10]],
        past_destinations=[trip.destination for trip in completed_trips if trip.destination],
        budget_range=(0, float("inf")),
        home_location=None,
    )


@profile_bp.route("/summary", methods=["GET"])
def get_profile_summary():
    """Return a backend-backed profile summary for the mobile profile screen."""
    user_id = _resolve_authenticated_user()
    if user_id is None:
        return jsonify({"error": "Authentication required"}), 401

    user = _load_user(user_id)
    if not user:
        return jsonify({"error": "user_not_found", "message": "User not found"}), 404

    stats_response = get_travel_stats()
    if hasattr(stats_response, "status_code") and stats_response.status_code != 200:
        return stats_response

    stats_payload = stats_response.get_json(silent=True) or {}
    stats = stats_payload.get("stats", {})

    try:
        context_data = _run_sync(user_preferences_service.get_recommendation_context(str(user.id)))
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning("Falling back to empty preference context for profile summary: %s", exc)
        context_data = {
            "preferences": {},
            "recent_searches": [],
            "favorite_destinations": [],
            "activity_signals": [],
            "destination_affinity": {},
        }

    context = _build_user_context(user, stats, context_data)

    try:
        raw_summary = ai_insights_service.generate_ai_summary(str(user.id), context)
        raw_insights = ai_insights_service.generate_insights(str(user.id), context, limit=5)
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning("Profile intelligence generation failed: %s", exc)
        raw_summary = {
            "summary": "Your profile is ready for a backend-driven summary, but insights are temporarily unavailable.",
            "travel_personality": "Curious Traveler",
            "recommendations_count": int(stats.get("favorites_count", 0) or 0),
            "generated_by": "fallback",
        }
        raw_insights = []

    travel_dna = _build_travel_dna(stats, context_data)
    personality = _build_personality(travel_dna, context_data)
    level = _calculate_level(_calculate_total_xp(stats))
    insights = [_normalize_insight(insight.to_dict()) for insight in raw_insights]

    return jsonify({
        "success": True,
        "data": {
            "profile": user.to_dict(),
            "stats": stats,
            "preferences": context_data.get("preferences", {}),
            "summary": raw_summary.get("summary"),
            "summary_meta": raw_summary,
            "level": level,
            "travel_dna": travel_dna,
            "personality": personality,
            "insights": insights,
            "smart_actions": _build_smart_actions(stats),
            "quick_actions": _build_quick_actions(stats),
            "generated_at": raw_summary.get("generated_at") or raw_summary.get("generatedAt"),
        },
    })
