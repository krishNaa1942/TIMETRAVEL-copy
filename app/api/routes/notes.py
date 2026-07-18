"""
Travel Notes / Journal API Route
====================================
POST   /api/notes               – Create a new travel note
GET    /api/notes               – List user's notes (or public notes)
GET    /api/notes/<id>          – Get single note
PUT    /api/notes/<id>          – Update a note
DELETE /api/notes/<id>          – Delete a note
GET    /api/notes/community     – Public notes from all users
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app.models.database import db
from app.models.entities import TravelNote
from app.utils.constants import VALID_DESTINATION_NAMES as VALID_DESTINATIONS

notes_bp = Blueprint("notes", __name__)


@notes_bp.route("/api/notes", methods=["POST"])
@login_required
def create_note():
    """Create a new travel journal entry."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    destination = (data.get("destination") or "").strip()

    if not title or not content or not destination:
        return jsonify({"error": "title, content, and destination are required"}), 400

    note = TravelNote(
        user_id=current_user.id,
        destination=destination,
        title=title,
        content=content,
        mood=data.get("mood"),
        rating=data.get("rating"),
        is_public=bool(data.get("is_public", False)),
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({"message": "Note created", "note": note.to_dict()}), 201


@notes_bp.route("/api/notes", methods=["GET"])
@login_required
def list_notes():
    """List current user's travel notes."""
    dest_filter = request.args.get("destination", "")
    query = TravelNote.query.filter_by(user_id=current_user.id)

    if dest_filter:
        query = query.filter_by(destination=dest_filter)

    notes = query.order_by(TravelNote.created_at.desc()).all()
    return jsonify({"notes": [n.to_dict() for n in notes]})


@notes_bp.route("/api/notes/<int:note_id>", methods=["GET"])
@login_required
def get_note(note_id):
    """Get a single note (must be owner or public)."""
    note = TravelNote.query.get_or_404(note_id)
    if note.user_id != current_user.id and not note.is_public:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"note": note.to_dict()})


@notes_bp.route("/api/notes/<int:note_id>", methods=["PUT"])
@login_required
def update_note(note_id):
    """Update a travel note (owner only)."""
    note = TravelNote.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    if "title" in data:
        note.title = data["title"]
    if "content" in data:
        note.content = data["content"]
    if "mood" in data:
        note.mood = data["mood"]
    if "rating" in data:
        note.rating = data["rating"]
    if "is_public" in data:
        note.is_public = bool(data["is_public"])

    db.session.commit()
    return jsonify({"message": "Note updated", "note": note.to_dict()})


@notes_bp.route("/api/notes/<int:note_id>", methods=["DELETE"])
@login_required
def delete_note(note_id):
    """Delete a travel note (owner only)."""
    note = TravelNote.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(note)
    db.session.commit()
    return jsonify({"message": "Note deleted"})


@notes_bp.route("/api/notes/community", methods=["GET"])
def community_notes():
    """Get public travel notes from all users (community feed)."""
    dest_filter = request.args.get("destination", "")
    query = TravelNote.query.filter_by(is_public=True)

    if dest_filter:
        query = query.filter_by(destination=dest_filter)

    notes = query.order_by(TravelNote.created_at.desc()).limit(50).all()
    return jsonify({"notes": [n.to_dict() for n in notes]})
