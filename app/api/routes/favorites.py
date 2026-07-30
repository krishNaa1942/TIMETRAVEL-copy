"""
Favorites / Wishlist API Routes
==================================
GET    /api/favorites          – List current user's favorites
POST   /api/favorites          – Add a favorite (bookmark)
DELETE /api/favorites/<id>     – Remove a favorite
GET    /api/favorites/check    – Check if an item is favourited

Requires authentication (Flask-Login session or JWT bearer token).
"""

import logging

from flask import Blueprint, request, jsonify
from app.models.database import db
from app.models.entities import Favorite
from app.utils.auth import resolve_authenticated_user

logger = logging.getLogger(__name__)

favorites_bp = Blueprint("favorites", __name__)

VALID_TYPES = {"destination", "place"}


# ── GET /api/favorites ──────────────────────────────────────
@favorites_bp.route("/api/favorites", methods=["GET"])
def list_favorites():
    """Return the authenticated user's favorites, newest first."""

    user = resolve_authenticated_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    item_type = request.args.get("type")  # optional filter

    query = Favorite.query.filter_by(user_id=user.id)
    if item_type and item_type in VALID_TYPES:
        query = query.filter_by(item_type=item_type)

    favs = query.order_by(Favorite.created_at.desc()).all()
    return jsonify({"favorites": [f.to_dict() for f in favs]}), 200


# ── POST /api/favorites ─────────────────────────────────────
@favorites_bp.route("/api/favorites", methods=["POST"])
def add_favorite():
    """Bookmark a destination or place."""
    user = resolve_authenticated_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    item_name = (data.get("item_name") or "").strip()
    item_type = (data.get("item_type") or "destination").strip().lower()
    notes = (data.get("notes") or "").strip() or None

    if not item_name:
        return jsonify({"error": "item_name is required"}), 400
    if item_type not in VALID_TYPES:
        return jsonify({"error": f"item_type must be one of: {', '.join(sorted(VALID_TYPES))}"}), 400

    # Check duplicate
    existing = Favorite.query.filter_by(
        user_id=user.id,
        item_type=item_type,
        item_name=item_name,
    ).first()

    if existing:
        return jsonify({"error": "Already in your wishlist", "favorite": existing.to_dict()}), 409

    fav = Favorite(
        user_id=user.id,
        item_type=item_type,
        item_name=item_name,
        notes=notes,
    )
    db.session.add(fav)
    db.session.commit()

    logger.info("User %s bookmarked %s:%s", user.id, item_type, item_name)
    return jsonify({"message": "Added to wishlist", "favorite": fav.to_dict()}), 201


# ── DELETE /api/favorites/<id> ──────────────────────────────
@favorites_bp.route("/api/favorites/<int:fav_id>", methods=["DELETE"])
def remove_favorite(fav_id):
    """Remove a bookmark by ID."""
    user = resolve_authenticated_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    fav = Favorite.query.filter_by(id=fav_id, user_id=user.id).first()
    if not fav:
        return jsonify({"error": "Favorite not found"}), 404

    db.session.delete(fav)
    db.session.commit()

    logger.info("User %s removed favorite %s", user.id, fav_id)
    return jsonify({"message": "Removed from wishlist"}), 200


# ── GET /api/favorites/check ────────────────────────────────
@favorites_bp.route("/api/favorites/check", methods=["GET"])
def check_favorite():
    """Check if an item is in the user's wishlist."""
    user = resolve_authenticated_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401

    item_name = request.args.get("item_name", "").strip()
    item_type = request.args.get("item_type", "destination").strip().lower()

    if not item_name:
        return jsonify({"error": "item_name is required"}), 400

    exists = Favorite.query.filter_by(
        user_id=user.id,
        item_type=item_type,
        item_name=item_name,
    ).first()

    return jsonify({
        "is_favorite": exists is not None,
        "favorite": exists.to_dict() if exists else None,
    }), 200
