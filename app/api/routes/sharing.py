"""
Trip Sharing API Route
========================
POST /api/share              – Create a shareable link for a trip
GET  /api/share/<token>      – View a shared trip (public, no auth)
GET  /api/share               – List user's shared links
DELETE /api/share/<token>     – Revoke a shared link
"""

import json
import re
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app.main import limiter
from app.models.database import db
from app.models.entities import SharedTrip, TripQuery

sharing_bp = Blueprint("sharing", __name__)

_TOKEN_RE = re.compile(r"^[a-zA-Z0-9_-]{10,64}$")


@sharing_bp.route("/api/share", methods=["POST"])
@limiter.limit("10 per hour")
@login_required
def create_share():
    """Create a shareable link for a trip or itinerary."""
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "My Trip").strip()[:200]
    trip_id = data.get("trip_id")
    itinerary_json = data.get("itinerary_json")
    notes = (data.get("notes") or "")[:2000]

    # Verify trip ownership if trip_id provided
    if trip_id:
        trip = TripQuery.query.get(trip_id)
        if not trip or trip.user_id != current_user.id:
            return jsonify({"error": "Trip not found"}), 404

    share = SharedTrip(
        user_id=current_user.id,
        trip_id=trip_id,
        title=title,
        itinerary_json=json.dumps(itinerary_json) if itinerary_json else None,
        notes=notes,
    )
    db.session.add(share)
    db.session.commit()

    return jsonify({
        "message": "Share link created",
        "share": share.to_dict(),
        "share_url": f"/shared/{share.share_token}",
    }), 201


@sharing_bp.route("/api/share/<token>", methods=["GET"])
@limiter.limit("30 per minute")
def view_shared(token):
    """View a shared trip (public, no authentication required)."""
    if not _TOKEN_RE.match(token):
        return jsonify({"error": "Invalid share token"}), 400
    share = SharedTrip.query.filter_by(share_token=token, is_active=True).first()
    if not share:
        return jsonify({"error": "Shared trip not found or link expired"}), 404

    # Increment view count
    share.view_count = (share.view_count or 0) + 1
    db.session.commit()

    result = share.to_dict()

    # Include trip details if linked
    if share.trip_id and share.trip:
        result["trip"] = share.trip.to_dict()

    # Parse stored itinerary JSON
    if share.itinerary_json:
        try:
            result["itinerary"] = json.loads(share.itinerary_json)
        except json.JSONDecodeError:
            result["itinerary"] = None

    return jsonify(result)


@sharing_bp.route("/api/share", methods=["GET"])
@login_required
def list_shares():
    """List current user's shared links."""
    shares = SharedTrip.query.filter_by(
        user_id=current_user.id
    ).order_by(SharedTrip.created_at.desc()).all()

    return jsonify({"shares": [s.to_dict() for s in shares]})


@sharing_bp.route("/api/share/<token>", methods=["DELETE"])
@login_required
def revoke_share(token):
    """Revoke (deactivate) a shared link."""
    share = SharedTrip.query.filter_by(
        share_token=token, user_id=current_user.id
    ).first()

    if not share:
        return jsonify({"error": "Share not found"}), 404

    share.is_active = False
    db.session.commit()
    return jsonify({"message": "Share link revoked"})
