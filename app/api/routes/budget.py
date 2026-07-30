"""
Budget Estimation API Route
=============================
POST /api/budget/estimate – Calculate a detailed trip budget breakdown.

Request JSON:
    {
        "destination": "Jaipur",
        "num_days": 5,
        "family_size": 4,
        "travel_class": "economy"   // economy | comfort | premium
    }

Response JSON:
    {
        "destination": "Jaipur",
        "num_days": 5,
        "family_size": 4,
        "travel_class": "economy",
        "accommodation": 7500.0,
        "food": 16000.0,
        "transport": 2500.0,
        "activities": 8000.0,
        "miscellaneous": 1500.0,
        "total": 35500.0,
        "currency": "INR"
    }
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import current_user

from app.main import limiter
from app.models.schemas import BudgetRequest
from app.services.budget_service import estimate_budget
from app.models.database import db
from app.models.entities import TripQuery

budget_bp = Blueprint("budget", __name__)


@budget_bp.route("/api/budget/estimate", methods=["POST"])
@limiter.limit("20 per minute")
def budget_estimate():
    """Return a detailed budget breakdown for a family trip."""

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    # Build and validate request schema
    try:
        req = BudgetRequest(
            destination=data.get("destination", ""),
            num_days=int(data.get("num_days", 0)),
            family_size=int(data.get("family_size", 0)),
            travel_class=data.get("travel_class", "economy"),
        )
    except (TypeError, ValueError):
        return (
            jsonify(
                {"error": "Invalid input: num_days and family_size must be integers"}
            ),
            400,
        )

    if req.num_days < 1 or req.num_days > 365:
        return jsonify({"error": "num_days must be between 1 and 365"}), 400
    if req.family_size < 1 or req.family_size > 50:
        return jsonify({"error": "family_size must be between 1 and 50"}), 400

    errors = req.validate()
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 422

    # Compute estimate
    baselines_path = current_app.config["BUDGET_DATA_PATH"]
    estimate = estimate_budget(req, baselines_path)

    # Persist query for analytics (and user trip history)
    try:
        trip = TripQuery(
            user_id=current_user.id if current_user.is_authenticated else None,
            destination=req.destination,
            num_days=req.num_days,
            family_size=req.family_size,
            travel_class=req.travel_class,
            estimated_budget=estimate.total,
            accommodation=estimate.accommodation,
            food=estimate.food,
            transport=estimate.transport,
            activities=estimate.activities,
            miscellaneous=estimate.miscellaneous,
        )
        db.session.add(trip)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify(estimate.to_dict()), 200
