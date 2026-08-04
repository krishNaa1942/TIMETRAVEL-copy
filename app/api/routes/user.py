"""
User Account & Profile Management API
========================================
GET    /api/user/avatar/upload-url       – Get avatar upload destination
POST   /api/user/avatar                  – Upload avatar image
GET    /api/user/avatar/<filename>       – Serve uploaded avatar
PUT    /api/user/preferences             – Update travel preferences
GET    /api/user/achievements            – List earned badges/achievements
GET    /api/user/export                  – Export user data (GDPR)
GET    /api/user/export?download=1       – Download full user data as JSON
DELETE /api/user/account                 – Delete account and all user data
POST   /api/user/sync                    – Sync offline event buffer (ack)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, Response, send_from_directory
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from app.api.routes.travel_stats import get_travel_stats
from app.models.database import db
from app.models.entities import (
    User,
    TripQuery,
    ChatMessage,
    Favorite,
    TravelNote,
    SharedTrip,
    Expense,
    PackingItem,
    Trip,
    TripDay,
    TripPlace,
    Reservation,
    TripPhoto,
    TripDocument,
    Companion,
)
from app.services.supabase_service import get_local_upload_dir
from app.services.user_preferences import user_preferences_service

logger = logging.getLogger(__name__)

user_bp = Blueprint("user", __name__, url_prefix="/api/user")

ALLOWED_AVATAR_EXTS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB


def _avatar_dir() -> str:
    return get_local_upload_dir("avatars")


def _avatar_url(filename: str) -> str:
    base = request.host_url.rstrip("/")
    return f"{base}/api/user/avatar/{filename}"


# ─────────────────────────────────────────────────────────────
# AVATAR
# ─────────────────────────────────────────────────────────────


@user_bp.route("/avatar/upload-url", methods=["GET"])
@login_required
def get_avatar_upload_url():
    """Return the avatar upload endpoint and a fresh storage key."""
    key = f"{uuid.uuid4().hex}.jpg"
    return jsonify(
        {
            "uploadUrl": request.host_url.rstrip("/") + "/api/user/avatar",
            "key": key,
        }
    )


@user_bp.route("/avatar", methods=["POST"])
@login_required
def upload_avatar():
    """Store the avatar image for the current user."""
    if "avatar" not in request.files:
        return jsonify({"error": "No avatar file uploaded."}), 400

    file = request.files["avatar"]
    if not file.filename:
        return jsonify({"error": "No file selected."}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_AVATAR_EXTS:
        return jsonify({"error": "Unsupported image format."}), 400

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_AVATAR_SIZE:
        return jsonify({"error": "Avatar too large (max 5MB)."}), 400

    # Remove the previous avatar for this user
    avatar_dir = _avatar_dir()
    for old_name in (
        f"user_{current_user.id}.jpg",
        f"user_{current_user.id}.png",
        f"user_{current_user.id}.webp",
    ):
        try:
            old_path = os.path.join(avatar_dir, old_name)
            if os.path.exists(old_path):
                os.remove(old_path)
        except OSError:  # pragma: no cover - best effort cleanup
            pass

    stored_name = f"user_{current_user.id}.{ext}"
    file.save(os.path.join(avatar_dir, stored_name))

    return jsonify({"avatar_url": _avatar_url(stored_name)}), 201


@user_bp.route("/avatar/<path:filename>", methods=["GET"])
def serve_avatar(filename):
    """Serve an uploaded avatar image."""
    safe = secure_filename(filename)
    return send_from_directory(_avatar_dir(), safe)


# ─────────────────────────────────────────────────────────────
# PREFERENCES
# ─────────────────────────────────────────────────────────────


@user_bp.route("/preferences", methods=["PUT"])
@login_required
def update_preferences():
    """Update the current user's travel preferences."""
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    try:
        prefs = asyncio.run(
            user_preferences_service.update_preferences(str(current_user.id), data)
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Failed to update preferences: %s", exc)
        return jsonify({"error": "Failed to update preferences"}), 500

    return jsonify({"success": True, "preferences": prefs.to_dict()})


# ─────────────────────────────────────────────────────────────
# ACHIEVEMENTS
# ─────────────────────────────────────────────────────────────


@user_bp.route("/achievements", methods=["GET"])
@login_required
def get_achievements():
    """Derive earned badges from the user's travel stats."""
    stats_response = get_travel_stats()
    stats = {}
    if hasattr(stats_response, "status_code") and stats_response.status_code == 200:
        stats = (stats_response.get_json(silent=True) or {}).get("stats", {})

    trips = stats.get("trips", {})
    total_trips = int(trips.get("total", 0) or 0)
    places_visited = int(stats.get("places_visited", 0) or 0)
    total_spent = float(stats.get("total_spent", 0) or 0)
    photos_uploaded = int(stats.get("photos_uploaded", 0) or 0)

    earned_at = (
        Trip.query.filter_by(user_id=current_user.id)
        .order_by(Trip.created_at.desc())
        .first()
    )
    timestamp = (
        earned_at.created_at.isoformat() if earned_at and earned_at.created_at else None
    )

    badges = []
    if total_trips >= 1:
        badges.append({"id": "first-trip", "earnedAt": timestamp})
    if total_trips >= 5:
        badges.append({"id": "trip-master", "earnedAt": timestamp})
    if places_visited >= 10:
        badges.append({"id": "destination-explorer", "earnedAt": timestamp})
    if total_spent > 0:
        badges.append({"id": "budget-tracker", "earnedAt": timestamp})
    if photos_uploaded >= 1:
        badges.append({"id": "photo-enthusiast", "earnedAt": timestamp})

    return jsonify({"badges": badges})


# ─────────────────────────────────────────────────────────────
# EXPORT (GDPR)
# ─────────────────────────────────────────────────────────────


@user_bp.route("/export", methods=["GET"])
@login_required
def export_data():
    """Return a JSON dump of all the user's data (or a download link)."""
    uid = current_user.id

    def _dump():
        user = db.session.get(User, uid)
        trips = Trip.query.filter_by(user_id=uid).order_by(Trip.created_at.desc()).all()
        notes = TravelNote.query.filter_by(user_id=uid).all()
        favorites = Favorite.query.filter_by(user_id=uid).all()
        expenses = Expense.query.filter_by(user_id=uid).all()
        reservations = Reservation.query.filter_by(user_id=uid).all()

        return {
            "user": user.to_dict() if user else None,
            "trips": [t.to_dict() for t in trips],
            "notes": [n.to_dict() for n in notes],
            "favorites": [f.to_dict() for f in favorites],
            "expenses": [e.to_dict() for e in expenses],
            "reservations": [r.to_dict() for r in reservations],
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }

    if request.args.get("download") == "1":
        payload = _dump()
        return Response(
            json.dumps(payload, indent=2, default=str),
            mimetype="application/json",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="timetravel-user-{uid}.json"'
                )
            },
        )

    return jsonify(
        {"downloadUrl": f"{request.host_url.rstrip('/')}/api/user/export?download=1"}
    )


# ─────────────────────────────────────────────────────────────
# ACCOUNT DELETION
# ─────────────────────────────────────────────────────────────


def _delete_user_data(uid: int) -> None:
    """Remove all rows owned by the user (FK-safe deletion order)."""
    trip_ids = [t.id for t in Trip.query.filter_by(user_id=uid).all()]
    for trip_id in trip_ids:
        TripDay.query.filter_by(trip_id=trip_id).delete()
        TripPlace.query.filter_by(trip_id=trip_id).delete()
    Trip.query.filter_by(user_id=uid).delete()
    TripQuery.query.filter_by(user_id=uid).delete()
    ChatMessage.query.filter_by(user_id=uid).delete()
    Favorite.query.filter_by(user_id=uid).delete()
    TravelNote.query.filter_by(user_id=uid).delete()
    SharedTrip.query.filter_by(user_id=uid).delete()
    Expense.query.filter_by(user_id=uid).delete()
    PackingItem.query.filter_by(user_id=uid).delete()
    Reservation.query.filter_by(user_id=uid).delete()
    TripPhoto.query.filter_by(user_id=uid).delete()
    TripDocument.query.filter_by(user_id=uid).delete()
    Companion.query.filter_by(user_id=uid).delete()


@user_bp.route("/account", methods=["DELETE"])
@login_required
def delete_account():
    """Delete the current user's account and all associated data."""
    uid = current_user.id
    try:
        _delete_user_data(uid)
        user = db.session.get(User, uid)
        if user:
            db.session.delete(user)
        db.session.commit()
    except Exception as exc:  # pragma: no cover - defensive
        db.session.rollback()
        logger.error("Account deletion failed for user %s: %s", uid, exc)
        return jsonify({"error": "Account deletion failed"}), 500

    return jsonify({"success": True, "message": "Account deleted"})


# ─────────────────────────────────────────────────────────────
# OFFLINE SYNC (ack-only for now)
# ─────────────────────────────────────────────────────────────


@user_bp.route("/sync", methods=["POST"])
@login_required
def sync_offline():
    """Acknowledge an offline event buffer (persistence is Phase E)."""
    data = request.get_json(silent=True)
    events = data.get("events", []) if isinstance(data, dict) else []
    if not isinstance(events, list):
        return jsonify({"error": "events must be an array"}), 400

    return jsonify({"synced": len(events)})
