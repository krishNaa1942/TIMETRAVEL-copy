"""
Travel Stats API – User dashboard analytics and travel statistics.
"""

from flask import Blueprint, jsonify
from sqlalchemy import func

from app.models.database import db
from app.models.entities import (
    Trip,
    TripPlace,
    Reservation,
    TripPhoto,
    Expense,
    Favorite,
)
from app.utils.auth import resolve_user_id

travel_stats_bp = Blueprint("travel_stats", __name__, url_prefix="/api/stats")


def get_default_stats():
    """Return default/empty stats for unauthenticated users."""
    return {
        "trips": {"total": 0, "planning": 0, "active": 0, "completed": 0},
        "destinations_visited": 0,
        "places_visited": 0,
        "total_travel_days": 0,
        "total_spent": 0.0,
        "spending_breakdown": {},
        "reservations": {"total": 0, "by_type": {}},
        "photos_uploaded": 0,
        "favorites_count": 0,
        "top_destinations": [],
        "budget_by_trip": [],
        "place_categories": {},
    }


@travel_stats_bp.route("", methods=["GET"])
def get_travel_stats():
    """Return comprehensive travel statistics for the current user."""
    uid = resolve_user_id()
    if uid is None:
        return jsonify({"error": "Authentication required"}), 401

    # Trip counts by status
    total_trips = Trip.query.filter_by(user_id=uid).count()
    planning = Trip.query.filter_by(user_id=uid, status="planning").count()
    active = Trip.query.filter_by(user_id=uid, status="active").count()
    completed = Trip.query.filter_by(user_id=uid, status="completed").count()

    # Unique destinations
    destinations = (
        db.session.query(func.distinct(Trip.destination))
        .filter(Trip.user_id == uid, Trip.destination.isnot(None))
        .count()
    )

    # Total places visited
    places_count = (
        db.session.query(func.count(TripPlace.id))
        .join(Trip, TripPlace.trip_id == Trip.id)
        .filter(Trip.user_id == uid)
        .scalar()
    ) or 0

    # Total travel days
    total_days = (
        db.session.query(func.sum(Trip.num_days)).filter(Trip.user_id == uid).scalar()
    ) or 0

    # Spending stats (from Expense model)
    total_spent = (
        db.session.query(func.sum(Expense.amount))
        .filter(Expense.user_id == uid)
        .scalar()
    ) or 0.0

    expense_by_category = (
        db.session.query(Expense.category, func.sum(Expense.amount))
        .filter(Expense.user_id == uid)
        .group_by(Expense.category)
        .all()
    )
    spending_breakdown = {cat: float(amt) for cat, amt in expense_by_category}

    # Reservation counts
    reservation_count = (
        db.session.query(func.count(Reservation.id))
        .filter(Reservation.user_id == uid)
        .scalar()
    ) or 0

    reservation_by_type = (
        db.session.query(Reservation.res_type, func.count(Reservation.id))
        .filter(Reservation.user_id == uid)
        .group_by(Reservation.res_type)
        .all()
    )

    # Photos uploaded
    photos_count = TripPhoto.query.filter_by(user_id=uid).count()

    # Favorites
    favorites_count = Favorite.query.filter_by(user_id=uid).count()

    # Top destinations (by trip count)
    top_destinations = (
        db.session.query(Trip.destination, func.count(Trip.id).label("cnt"))
        .filter(Trip.user_id == uid, Trip.destination.isnot(None))
        .group_by(Trip.destination)
        .order_by(func.count(Trip.id).desc())
        .limit(5)
        .all()
    )

    # Budget by trip (for chart)
    budget_by_trip = (
        db.session.query(Trip.title, Trip.budget_total)
        .filter(Trip.user_id == uid, Trip.budget_total.isnot(None))
        .order_by(Trip.created_at.desc())
        .limit(10)
        .all()
    )

    # Place categories breakdown
    category_breakdown = (
        db.session.query(TripPlace.category, func.count(TripPlace.id))
        .join(Trip, TripPlace.trip_id == Trip.id)
        .filter(Trip.user_id == uid, TripPlace.category.isnot(None))
        .group_by(TripPlace.category)
        .all()
    )

    return jsonify(
        {
            "stats": {
                "trips": {
                    "total": total_trips,
                    "planning": planning,
                    "active": active,
                    "completed": completed,
                },
                "destinations_visited": destinations,
                "places_visited": places_count,
                "total_travel_days": int(total_days),
                "total_spent": round(float(total_spent), 2),
                "spending_breakdown": spending_breakdown,
                "reservations": {
                    "total": reservation_count,
                    "by_type": {t: c for t, c in reservation_by_type},
                },
                "photos_uploaded": photos_count,
                "favorites_count": favorites_count,
                "top_destinations": [
                    {"destination": d, "trips": c} for d, c in top_destinations
                ],
                "budget_by_trip": [
                    {"trip": t, "budget": float(b) if b else 0}
                    for t, b in budget_by_trip
                ],
                "place_categories": {c: n for c, n in category_breakdown},
            }
        }
    )
