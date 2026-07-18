"""
Booking Links API Route
========================
GET /api/booking/links?destination=Goa&checkin=2026-03-15&checkout=2026-03-20&guests=4
"""

from flask import Blueprint, request, jsonify

from app.main import limiter
from app.services.booking_service import get_booking_links

booking_bp = Blueprint("booking", __name__)


@booking_bp.route("/api/booking/links", methods=["GET"])
@limiter.limit("30 per minute")
def booking_links():
    """Get flight, hotel, train, and bus booking links for a destination."""
    destination = (request.args.get("destination") or "").strip()
    if not destination:
        return jsonify({"error": "destination parameter is required"}), 400
    if len(destination) > 100:
        return jsonify({"error": "destination name too long"}), 400

    checkin = request.args.get("checkin", "")
    checkout = request.args.get("checkout", "")
    try:
        guests = max(1, min(int(request.args.get("guests", 2)), 50))
    except (TypeError, ValueError):
        guests = 2

    result = get_booking_links(destination, checkin, checkout, guests)
    return jsonify(result)
