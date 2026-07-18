"""
Travel Safety API Route
========================
GET /api/safety/<destination> – Return a safety profile with sub-scores
and an advisory message for the given destination.

Response JSON:
    {
        "destination": "Goa",
        "overall_score": 7.8,
        "crime_score": 7.5,
        "health_score": 8.0,
        "infrastructure_score": 7.5,
        "tourist_friendliness": 8.5,
        "advisory": "Generally safe. Take standard precautions."
    }
"""

from flask import Blueprint, jsonify, current_app

from app.services.safety_service import get_safety_score

safety_bp = Blueprint("safety", __name__)


@safety_bp.route("/api/safety/<destination>", methods=["GET"])
def safety_score(destination: str):
    """Look up the safety profile for a destination."""

    if not destination or len(destination.strip()) < 2 or len(destination) > 100:
        return jsonify({"error": "Invalid destination name"}), 400

    data_path = current_app.config["SAFETY_DATA_PATH"]
    result = get_safety_score(destination, data_path)

    return jsonify(result.to_dict()), 200
