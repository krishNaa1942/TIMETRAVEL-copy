"""
Trip History API Routes
========================
GET    /api/trips          – List all trips for the logged-in user
GET    /api/trips/<id>     – Get a single trip detail
DELETE /api/trips/<id>     – Delete a saved trip

Requires authentication (Flask-Login session).
"""

from datetime import date

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from app.models.database import db
from app.models.entities import Companion, Trip, TripDay, TripPlace, TripQuery

trips_bp = Blueprint("trips", __name__)

# Mobile clients send travel_class: economy | comfort | premium.
# The DB CHECK constraint only allows economy | budget | standard | premium | luxury.
_CLASS_MAP = {
    "economy": "economy",
    "standard": "standard",
    "comfort": "standard",
    "premium": "premium",
    "luxury": "luxury",
    "budget": "budget",
}

_VALID_STATUSES = {"planning", "active", "completed"}


def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# GET /api/trips – list user's trip history
# ---------------------------------------------------------------------------
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by TripsScreen uses the mock tripsStore; planner blueprint serves lists. See FRONTEND_AUDIT.md Phase D.
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
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no consumer (getTrip never called). See FRONTEND_AUDIT.md Phase D.
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
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no consumer. See FRONTEND_AUDIT.md Phase D.
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


# ---------------------------------------------------------------------------
# POST /api/trips – create a trip (persists to the Trip workspace model)
# ---------------------------------------------------------------------------
@trips_bp.route("/api/trips", methods=["POST"])
@login_required
def create_trip():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or data.get("destination") or "").strip()
    destination = (data.get("destination") or "").strip()

    if not title:
        return jsonify({"error": "Trip title is required."}), 400
    if not destination:
        return jsonify({"error": "Destination is required."}), 400

    travel_class = data.get("travel_class", "economy")
    if travel_class not in _CLASS_MAP:
        return (
            jsonify(
                {"error": "travel_class must be one of: economy, comfort, premium"}
            ),
            400,
        )

    status = data.get("status", "planning")
    if status not in _VALID_STATUSES:
        return jsonify({"error": "status must be planning, active, or completed"}), 400

    num_days = int(data.get("num_days", 1) or 1)
    if num_days < 1:
        return jsonify({"error": "num_days must be at least 1"}), 400

    trip = Trip(
        user_id=current_user.id,
        title=title,
        destination=destination,
        start_date=_parse_date(data.get("start_date")),
        end_date=_parse_date(data.get("end_date")),
        num_days=num_days,
        family_size=int(data.get("family_size", 1) or 1),
        travel_class=_CLASS_MAP[travel_class],
        budget_total=data.get("budget_total"),
        notes=data.get("notes"),
        status=status,
    )
    db.session.add(trip)
    db.session.flush()  # get trip.id

    # Explicit migration path (D2): link the new Trip to its source analytics row
    trip_query_id = data.get("trip_query_id")
    if trip_query_id:
        query_row = db.session.get(TripQuery, trip_query_id)
        if query_row and query_row.user_id == current_user.id:
            query_row.trip_id = trip.id

    for i in range(1, num_days + 1):
        day_date = None
        if trip.start_date:
            from datetime import timedelta

            day_date = trip.start_date + timedelta(days=i - 1)
        db.session.add(
            TripDay(trip_id=trip.id, day_number=i, date=day_date, title=f"Day {i}")
        )

    db.session.commit()
    return jsonify({"trip": trip.to_dict(include_days=True)}), 201


# ---------------------------------------------------------------------------
# PUT /api/trips/<id> – update a trip
# ---------------------------------------------------------------------------
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no consumer (updateTrip never called). See FRONTEND_AUDIT.md Phase D.
@trips_bp.route("/api/trips/<int:trip_id>", methods=["PUT"])
@login_required
def update_trip(trip_id):
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found"}), 404

    data = request.get_json(silent=True) or {}
    errors = []

    if "title" in data:
        if not data["title"] or not str(data["title"]).strip():
            errors.append("title must be a non-empty string")
        else:
            trip.title = str(data["title"]).strip()
    if "destination" in data:
        if not str(data["destination"]).strip():
            errors.append("destination must be a non-empty string")
        else:
            trip.destination = str(data["destination"]).strip()
    if "notes" in data and data["notes"] is not None:
        trip.notes = str(data["notes"])

    for field in ("start_date", "end_date"):
        if field in data:
            trip.__setattr__(field, _parse_date(data[field]))

    if "num_days" in data and data["num_days"] is not None:
        num_days = int(data["num_days"])
        if num_days < 1:
            errors.append("num_days must be at least 1")
        else:
            trip.num_days = num_days
    if "family_size" in data and data["family_size"] is not None:
        family_size = int(data["family_size"])
        if family_size < 1:
            errors.append("family_size must be at least 1")
        else:
            trip.family_size = family_size
    if "budget_total" in data and data["budget_total"] is not None:
        trip.budget_total = float(data["budget_total"])
    if "travel_class" in data:
        if data["travel_class"] not in _CLASS_MAP:
            errors.append(
                "travel_class must be one of: economy, comfort, premium, standard, luxury"
            )
        else:
            trip.travel_class = _CLASS_MAP[data["travel_class"]]
    if "status" in data:
        if data["status"] not in _VALID_STATUSES:
            errors.append("status must be planning, active, or completed")
        else:
            trip.status = data["status"]

    if errors:
        return jsonify({"error": errors[0], "errors": errors}), 400

    db.session.commit()
    return jsonify({"trip": trip.to_dict(include_days=True)}), 200


# ---------------------------------------------------------------------------
# POST /api/trips/<id>/duplicate – clone a trip and its sub-resources
# ---------------------------------------------------------------------------
# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no consumer (duplicateTrip never called). See FRONTEND_AUDIT.md Phase D.
@trips_bp.route("/api/trips/<int:trip_id>/duplicate", methods=["POST"])
@login_required
def duplicate_trip(trip_id):
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found"}), 404

    copy = Trip(
        user_id=current_user.id,
        title=f"Copy of {trip.title}",
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        num_days=trip.num_days,
        family_size=trip.family_size,
        travel_class=trip.travel_class,
        cover_image_url=trip.cover_image_url,
        status="planning",
        budget_total=trip.budget_total,
        notes=trip.notes,
        itinerary_json=trip.itinerary_json,
    )
    db.session.add(copy)
    db.session.flush()

    day_id_map = {}
    for day in trip.days:
        new_day = TripDay(
            trip_id=copy.id,
            day_number=day.day_number,
            date=day.date,
            title=day.title,
            notes=day.notes,
        )
        db.session.add(new_day)
        db.session.flush()  # get new_day.id
        day_id_map[day.id] = new_day.id
    for place in trip.places:
        db.session.add(
            TripPlace(
                trip_id=copy.id,
                day_id=day_id_map.get(place.day_id),
                name=place.name,
                address=place.address,
                lat=place.lat,
                lon=place.lon,
                category=place.category,
                notes=place.notes,
                start_time=place.start_time,
                end_time=place.end_time,
                duration_minutes=place.duration_minutes,
                estimated_cost=place.estimated_cost,
                position_order=place.position_order,
                is_booked=place.is_booked,
                rating=place.rating,
                image_url=place.image_url,
            )
        )
    for companion in trip.companions:
        db.session.add(
            Companion(
                trip_id=copy.id,
                name=companion.name,
                email=companion.email,
                phone=companion.phone,
                role=companion.role,
                avatar_color=companion.avatar_color,
            )
        )

    db.session.commit()
    return jsonify({"trip": copy.to_dict(include_days=True)}), 201
