"""
Reservations API – Track flights, hotels, restaurants, transport bookings.
"""

from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app.models.database import db
from app.models.entities import Trip, Reservation

reservations_bp = Blueprint("reservations", __name__, url_prefix="/api/reservations")


@reservations_bp.route("", methods=["POST"])
@login_required
def add_reservation():
    """Add a reservation to a trip."""
    data = request.get_json(silent=True) or {}
    trip_id = data.get("trip_id")
    if not trip_id:
        return jsonify({"error": "trip_id is required."}), 400

    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    res_type = data.get("res_type", "").strip()
    title = data.get("title", "").strip()
    if not res_type or not title:
        return jsonify({"error": "Type and title are required."}), 400

    start_dt = None
    end_dt = None
    if data.get("start_datetime"):
        try:
            start_dt = datetime.fromisoformat(data["start_datetime"])
        except ValueError:
            pass
    if data.get("end_datetime"):
        try:
            end_dt = datetime.fromisoformat(data["end_datetime"])
        except ValueError:
            pass

    res = Reservation(
        trip_id=trip.id,
        user_id=current_user.id,
        res_type=res_type,
        title=title,
        confirmation_code=data.get("confirmation_code"),
        provider=data.get("provider"),
        start_datetime=start_dt,
        end_datetime=end_dt,
        location=data.get("location"),
        notes=data.get("notes"),
        amount=float(data["amount"]) if data.get("amount") else None,
        currency=data.get("currency", "INR"),
        status=data.get("status", "confirmed"),
    )
    db.session.add(res)
    db.session.commit()
    return jsonify({"reservation": res.to_dict()}), 201


@reservations_bp.route("/<int:res_id>", methods=["PUT"])
@login_required
def update_reservation(res_id):
    """Update a reservation."""
    res = Reservation.query.filter_by(id=res_id, user_id=current_user.id).first()
    if not res:
        return jsonify({"error": "Reservation not found."}), 404

    data = request.get_json(silent=True) or {}
    for field in [
        "title",
        "res_type",
        "confirmation_code",
        "provider",
        "location",
        "notes",
        "currency",
        "status",
    ]:
        if field in data:
            setattr(res, field, data[field])
    if "amount" in data:
        res.amount = float(data["amount"]) if data["amount"] else None
    for dt_field in ["start_datetime", "end_datetime"]:
        if dt_field in data:
            try:
                setattr(
                    res,
                    dt_field,
                    datetime.fromisoformat(data[dt_field]) if data[dt_field] else None,
                )
            except ValueError:
                pass

    db.session.commit()
    return jsonify({"reservation": res.to_dict()})


@reservations_bp.route("/<int:res_id>", methods=["DELETE"])
@login_required
def delete_reservation(res_id):
    """Delete a reservation."""
    res = Reservation.query.filter_by(id=res_id, user_id=current_user.id).first()
    if not res:
        return jsonify({"error": "Reservation not found."}), 404

    db.session.delete(res)
    db.session.commit()
    return jsonify({"message": "Reservation deleted."})


@reservations_bp.route("/trip/<int:trip_id>", methods=["GET"])
@login_required
def list_reservations(trip_id):
    """List all reservations for a trip."""
    trip = Trip.query.filter_by(id=trip_id, user_id=current_user.id).first()
    if not trip:
        return jsonify({"error": "Trip not found."}), 404

    reservations = (
        Reservation.query.filter_by(trip_id=trip.id)
        .order_by(Reservation.start_datetime.asc())
        .all()
    )
    return jsonify({"reservations": [r.to_dict() for r in reservations]})
