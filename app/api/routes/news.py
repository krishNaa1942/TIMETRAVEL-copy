"""
News API Routes
================
GET  /api/news/travel          – Travel news for a destination
GET  /api/news/trending        – Trending India travel headlines
GET  /api/news/safety          – Travel safety advisories
GET  /api/news/destinations    – Available destination list
GET  /api/news/status          – Check if NewsAPI is available

Keeps travellers informed with real-time news, safety alerts, and trends.
"""

from flask import Blueprint, request, jsonify, current_app

from app.services.news_service import (
    get_travel_news,
    get_trending_travel,
    get_safety_news,
    get_destinations,
    is_available,
)

news_bp = Blueprint("news", __name__)


def _news_key() -> str:
    return current_app.config.get("NEWSAPI_KEY", "")


# ── GET /api/news/travel ──────────────────────────────────
@news_bp.route("/api/news/travel", methods=["GET"])
def travel_news():
    """
    Get travel news articles.

    Query params:
        destination: Destination name (optional)
        category:    travel|safety|food|culture|adventure (default: travel)
        limit:       Max articles (default: 10, max 20)
    """
    key = _news_key()
    if not key:
        return jsonify({"error": "NewsAPI not configured", "articles": []}), 503

    destination = request.args.get("destination", "")
    category = request.args.get("category", "travel")
    limit = request.args.get("limit", 10, type=int)

    articles = get_travel_news(key, destination, category, limit)

    return (
        jsonify(
            {
                "count": len(articles),
                "destination": destination or "India",
                "category": category,
                "articles": articles,
            }
        ),
        200,
    )


# ── GET /api/news/trending ────────────────────────────────
@news_bp.route("/api/news/trending", methods=["GET"])
def trending_news():
    """Get trending India travel headlines."""
    key = _news_key()
    if not key:
        return jsonify({"error": "NewsAPI not configured", "articles": []}), 503

    limit = request.args.get("limit", 10, type=int)
    articles = get_trending_travel(key, limit)

    return (
        jsonify(
            {
                "count": len(articles),
                "articles": articles,
            }
        ),
        200,
    )


# ── GET /api/news/safety ──────────────────────────────────
@news_bp.route("/api/news/safety", methods=["GET"])
def safety_news():
    """Get travel safety advisories and alerts."""
    key = _news_key()
    if not key:
        return jsonify({"error": "NewsAPI not configured", "articles": []}), 503

    destination = request.args.get("destination", "")
    limit = request.args.get("limit", 5, type=int)
    articles = get_safety_news(key, destination, limit)

    return (
        jsonify(
            {
                "count": len(articles),
                "destination": destination or "India",
                "articles": articles,
            }
        ),
        200,
    )


# ── GET /api/news/destinations ────────────────────────────
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by mobile news service only uses travel/trending/safety. See FRONTEND_AUDIT.md Phase D.
@news_bp.route("/api/news/destinations", methods=["GET"])
def news_destinations():
    """Return list of destinations with news coverage."""
    return jsonify({"destinations": get_destinations()}), 200


# ── GET /api/news/status ──────────────────────────────────
@news_bp.route("/api/news/status", methods=["GET"])
def news_status():
    """Check if NewsAPI is available."""
    key = _news_key()
    return (
        jsonify(
            {
                "available": is_available(key),
                "provider": "NewsAPI",
            }
        ),
        200,
    )
