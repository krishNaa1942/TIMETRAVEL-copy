"""
Trip Planner API – Full CRUD for the trip workspace.
Create trips, manage days, add/move places, companions.
"""

import json
from datetime import datetime, date

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user

from app.models.database import db
from app.models.entities import Trip, TripDay, TripPlace, Companion

trip_planner_bp = Blueprint("trip_planner", __name__, url_prefix="/api/trips/planner")


# ── Trip CRUD ───────────────────────────────────────────────────────────

@trip_planner_bp.route("", methods=["POST"])
@login_required
def create_trip():
    """Create a new trip workspace."""
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    destination = data.get("destination", "").strip()

    if not title:
        return jsonify({"error": "Trip title is required."}), 400
    if not destination:
        return jsonify({"error": "Destination is required."}), 400

    num_days = int(data.get("num_days", 3))
    start_date = None
    if data.get("start_date"):
        try:
            start_date = date.fromisoformat(data["start_date"])
        except ValueError:
            pass

    end_date = None
    if data.get("end_date"):
        try:
            end_date = date.fromisoformat(data["end_date"])
        except ValueError:
            pass

    trip = Trip(
        user_id=current_user.id,
        title=title,
        destination=destination,
        start_date=start_date,
        end_date=end_date,
        num_days=num_days,
        family_size=int(data.get("family_size", 1)),
        travel_class=data.get("travel_class", "economy"),
        cover_image_url=data.get("cover_image_url"),
        notes=data.get("notes", ""),
        status="planning",
    )
    db.session.add(trip)
    db.session.flush()  # get trip.id

    # Auto-create day placeholders
    for i in range(1, num_days + 1):
        day_date = None
        if start_date:
            from datetime import timedelta
            day_date = start_date + timedelta(days=i - 1)
        day = TripDay(trip_id=trip.id, day_number=i, date=day_date, title=f"Day {i}")
        db.session.add(day)

    db.session.commit()
    return jsonify({"trip": trip.to_dict(include_days=True)}), 201


@trip_planner_bp.route("", methods=["GET"])
def list_trips():
    """List all user's trips."""
    # For demo: return empty list if not authenticated
    if not current_user.is_authenticated:
        return jsonify({"trips": []})
    
    status_filter = request.args.get("status")
    q = Trip.query.filter_by(user_id=current_user.id).order_by(Trip.updated_at.desc())
    if status_filter:
        q = q.filter_by(status=status_filter)
    trips = q.all()
    return jsonify({"trips": [t.to_dict() for t in trips]})


@trip_planner_bp.route("/<int:trip_id>", methods=["GET"])
@login_required
def get_trip(trip_id):
    """Get full trip with days, places, companions."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    d = trip.to_dict(include_days=True, include_places=True)
    d["reservations"] = [r.to_dict() for r in trip.reservations.all()]
    d["photos"] = [p.to_dict() for p in trip.photos.all()]
    d["companions"] = [c.to_dict() for c in trip.companions.all()]
    return jsonify({"trip": d})


@trip_planner_bp.route("/<int:trip_id>", methods=["PUT"])
@login_required
def update_trip(trip_id):
    """Update trip details."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    data = request.get_json(silent=True) or {}
    for field in ["title", "destination", "notes", "travel_class", "cover_image_url", "status", "itinerary_json"]:
        if field in data:
            setattr(trip, field, data[field])
    for int_field in ["num_days", "family_size"]:
        if int_field in data:
            setattr(trip, int_field, int(data[int_field]))
    for float_field in ["budget_total"]:
        if float_field in data:
            setattr(trip, float_field, float(data[float_field]) if data[float_field] else None)
    for date_field in ["start_date", "end_date"]:
        if date_field in data:
            try:
                setattr(trip, date_field, date.fromisoformat(data[date_field]) if data[date_field] else None)
            except ValueError:
                pass
    if "is_public" in data:
        trip.is_public = bool(data["is_public"])

    db.session.commit()
    return jsonify({"trip": trip.to_dict()})


@trip_planner_bp.route("/<int:trip_id>", methods=["DELETE"])
@login_required
def delete_trip(trip_id):
    """Delete a trip and all related data."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404
    db.session.delete(trip)
    db.session.commit()
    return jsonify({"message": "Trip deleted."})


# ── Trip Days ───────────────────────────────────────────────────────────

@trip_planner_bp.route("/<int:trip_id>/days", methods=["POST"])
@login_required
def add_day(trip_id):
    """Add a new day to the trip."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    data = request.get_json(silent=True) or {}
    day_num = trip.days.count() + 1
    day = TripDay(
        trip_id=trip.id,
        day_number=day_num,
        title=data.get("title", f"Day {day_num}"),
        notes=data.get("notes"),
    )
    if data.get("date"):
        try:
            day.date = date.fromisoformat(data["date"])
        except ValueError:
            pass

    db.session.add(day)
    trip.num_days = day_num
    db.session.commit()
    return jsonify({"day": day.to_dict()}), 201


@trip_planner_bp.route("/<int:trip_id>/days/<int:day_id>", methods=["PUT"])
@login_required
def update_day(trip_id, day_id):
    """Update a day's title or notes."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    day = TripDay.query.filter_by(id=day_id, trip_id=trip.id).first()
    if not day:
        return jsonify({"error": "Day not found."}), 404

    data = request.get_json(silent=True) or {}
    if "title" in data:
        day.title = data["title"]
    if "notes" in data:
        day.notes = data["notes"]
    db.session.commit()
    return jsonify({"day": day.to_dict()})


# ── Trip Places ─────────────────────────────────────────────────────────

@trip_planner_bp.route("/<int:trip_id>/places", methods=["POST"])
@login_required
def add_place(trip_id):
    """Add a place to the trip (optionally assign to a day)."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Place name is required."}), 400

    place = TripPlace(
        trip_id=trip.id,
        day_id=data.get("day_id"),
        name=name,
        address=data.get("address"),
        lat=data.get("lat"),
        lon=data.get("lon"),
        category=data.get("category"),
        notes=data.get("notes"),
        start_time=data.get("start_time"),
        end_time=data.get("end_time"),
        duration_minutes=data.get("duration_minutes"),
        estimated_cost=data.get("estimated_cost"),
        image_url=data.get("image_url"),
        rating=data.get("rating"),
    )

    # Set position order
    if data.get("day_id"):
        max_pos = db.session.query(db.func.max(TripPlace.position_order)).filter_by(
            day_id=data["day_id"]).scalar() or 0
        place.position_order = max_pos + 1

    db.session.add(place)
    db.session.commit()
    return jsonify({"place": place.to_dict()}), 201


@trip_planner_bp.route("/<int:trip_id>/places/<int:place_id>", methods=["PUT"])
@login_required
def update_place(trip_id, place_id):
    """Update a place (move to different day, reorder, edit details)."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    place = TripPlace.query.filter_by(id=place_id, trip_id=trip.id).first()
    if not place:
        return jsonify({"error": "Place not found."}), 404

    data = request.get_json(silent=True) or {}
    for field in ["name", "address", "category", "notes", "start_time", "end_time", "image_url"]:
        if field in data:
            setattr(place, field, data[field])
    for float_field in ["lat", "lon", "estimated_cost", "rating"]:
        if float_field in data:
            setattr(place, float_field, float(data[float_field]) if data[float_field] is not None else None)
    for int_field in ["day_id", "position_order", "duration_minutes"]:
        if int_field in data:
            setattr(place, int_field, int(data[int_field]) if data[int_field] is not None else None)
    if "is_booked" in data:
        place.is_booked = bool(data["is_booked"])

    db.session.commit()
    return jsonify({"place": place.to_dict()})


@trip_planner_bp.route("/<int:trip_id>/places/<int:place_id>", methods=["DELETE"])
@login_required
def delete_place(trip_id, place_id):
    """Remove a place from the trip."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    place = TripPlace.query.filter_by(id=place_id, trip_id=trip.id).first()
    if not place:
        return jsonify({"error": "Place not found."}), 404

    db.session.delete(place)
    db.session.commit()
    return jsonify({"message": "Place removed."})


@trip_planner_bp.route("/<int:trip_id>/places/reorder", methods=["PUT"])
@login_required
def reorder_places(trip_id):
    """Reorder places within a day."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    data = request.get_json(silent=True) or {}
    order = data.get("order", [])  # [{id: place_id, day_id: x, position: y}]
    for item in order:
        place = TripPlace.query.filter_by(id=item["id"], trip_id=trip.id).first()
        if place:
            place.day_id = item.get("day_id", place.day_id)
            place.position_order = item.get("position", place.position_order)

    db.session.commit()
    return jsonify({"message": "Reordered."})


# ── Companions ──────────────────────────────────────────────────────────

@trip_planner_bp.route("/<int:trip_id>/companions", methods=["POST"])
@login_required
def add_companion(trip_id):
    """Add a travel companion."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Companion name is required."}), 400

    COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"]
    comp = Companion(
        trip_id=trip.id,
        user_id=current_user.id,
        name=name,
        email=data.get("email"),
        phone=data.get("phone"),
        role=data.get("role", "traveler"),
        avatar_color=COLORS[trip.companions.count() % len(COLORS)],
    )
    db.session.add(comp)
    db.session.commit()
    return jsonify({"companion": comp.to_dict()}), 201


@trip_planner_bp.route("/<int:trip_id>/companions/<int:comp_id>", methods=["DELETE"])
@login_required
def remove_companion(trip_id, comp_id):
    """Remove a companion."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    comp = Companion.query.filter_by(id=comp_id, trip_id=trip.id).first()
    if not comp:
        return jsonify({"error": "Companion not found."}), 404

    db.session.delete(comp)
    db.session.commit()
    return jsonify({"message": "Companion removed."})
