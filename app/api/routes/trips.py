"""
Trip History API Routes
========================
GET    /api/trips          – List all trips for the logged-in user
GET    /api/trips/<id>     – Get a single trip detail
DELETE /api/trips/<id>     – Delete a saved trip

Requires authentication (Flask-Login session).
"""

from flask import Blueprint, jsonify
from flask_login import login_required, current_user

from app.models.database import db
from app.models.entities import TripQuery

trips_bp = Blueprint("trips", __name__)


# ---------------------------------------------------------------------------
# GET /api/trips – list user's trip history
# ---------------------------------------------------------------------------
@trips_bp.route("/api/trips", methods=["GET"])
@login_required
def list_trips():
    """Return all saved trips for the current user, newest first."""
    trips = (
        TripQuery.query.filter_by(user_id=current_user.id)
        .order_by(TripQuery.created_at.desc())
        .all()
    )
    return (
        jsonify(
            {
                "count": len(trips),
                "trips": [t.to_dict() for t in trips],
            }
        ),
        200,
    )


# ---------------------------------------------------------------------------
# GET /api/trips/<id> – single trip detail
# ---------------------------------------------------------------------------
@trips_bp.route("/api/trips/<int:trip_id>", methods=["GET"])
@login_required
def get_trip(trip_id):
    """Return a single trip by ID (must belong to current user)."""
    trip = TripQuery.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found"}), 404
    return jsonify(trip.to_dict()), 200


# ---------------------------------------------------------------------------
# DELETE /api/trips/<id> – delete a trip
# ---------------------------------------------------------------------------
@trips_bp.route("/api/trips/<int:trip_id>", methods=["DELETE"])
@login_required
def delete_trip(trip_id):
    """Delete a saved trip (must belong to current user)."""
    trip = TripQuery.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found"}), 404

    db.session.delete(trip)
    db.session.commit()
    return jsonify({"message": "Trip deleted successfully"}), 200
