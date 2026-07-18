"""
Language Phrases API Route
=============================
GET /api/language/phrases?destination=jaipur
GET /api/language/destinations
"""

from flask import Blueprint, request, jsonify

from app.services.language_service import get_phrases, get_supported_destinations

language_bp = Blueprint("language", __name__)


@language_bp.route("/api/language/phrases", methods=["GET"])
def phrases():
    """Get local language phrases for a destination."""
    destination = (request.args.get("destination") or "").strip()
    if not destination:
        return jsonify({"error": "destination parameter is required"}), 400

    result = get_phrases(destination)
    return jsonify(result)


@language_bp.route("/api/language/destinations", methods=["GET"])
def language_destinations():
    """List destinations with language phrase support."""
    return jsonify({"destinations": get_supported_destinations()})
