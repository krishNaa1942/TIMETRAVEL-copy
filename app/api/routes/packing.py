"""
Packing Checklist API Route
===============================
POST   /api/packing/generate     – Generate checklist from weather
GET    /api/packing              – Get user's checklist for a destination
PUT    /api/packing/<id>/toggle  – Toggle checked state
POST   /api/packing/custom       – Add a custom item
DELETE /api/packing/<id>         – Remove a custom item
"""

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user

from app.models.database import db
from app.models.entities import PackingItem
from app.services.packing_service import suggest_packing
from app.services.weather_service import fetch_weather

packing_bp = Blueprint("packing", __name__)


@packing_bp.route("/api/packing/generate", methods=["POST"])
@login_required
def generate_checklist():
    """Generate a weather-based packing checklist for a destination."""
    data = request.get_json(silent=True) or {}
    destination = (data.get("destination") or "").strip()

    if not destination:
        return jsonify({"error": "destination is required"}), 400

    # Fetch weather to determine packing suggestions
    api_key = current_app.config.get("OPENWEATHER_API_KEY", "")
    weather = fetch_weather(destination, api_key)

    if weather:
        suggestions = suggest_packing(
            weather.temperature_c, weather.humidity, weather.description
        )
    else:
        # Generic essentials if weather unavailable
        suggestions = [
            "Comfortable walking shoes",
            "Light cotton clothing",
            "Sunscreen (SPF 50+)",
            "Reusable water bottle",
            "Basic first-aid kit",
            "Power bank and universal charger",
            "Photocopies of ID and travel documents",
        ]

    # Clear existing auto-generated items for this destination
    PackingItem.query.filter_by(
        user_id=current_user.id,
        destination=destination,
        is_custom=False,
    ).delete()

    # Create new items
    items = []
    for text in suggestions:
        item = PackingItem(
            user_id=current_user.id,
            destination=destination,
            item_text=text,
            is_checked=False,
            is_custom=False,
        )
        db.session.add(item)
        items.append(item)

    db.session.commit()
    return jsonify({
        "message": f"Generated {len(items)} packing items",
        "items": [i.to_dict() for i in items],
        "weather_available": weather is not None,
    })


@packing_bp.route("/api/packing", methods=["GET"])
@login_required
def get_checklist():
    """Get user's packing checklist for a destination."""
    dest = request.args.get("destination", "")
    query = PackingItem.query.filter_by(user_id=current_user.id)

    if dest:
        query = query.filter_by(destination=dest)

    items = query.order_by(PackingItem.is_custom, PackingItem.id).all()
    checked = sum(1 for i in items if i.is_checked)

    return jsonify({
        "items": [i.to_dict() for i in items],
        "total": len(items),
        "checked": checked,
        "progress": round(checked / len(items) * 100) if items else 0,
    })


@packing_bp.route("/api/packing/<int:item_id>/toggle", methods=["PUT"])
@login_required
def toggle_item(item_id):
    """Toggle the checked state of a packing item."""
    item = PackingItem.query.get_or_404(item_id)
    if item.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    item.is_checked = not item.is_checked
    db.session.commit()
    return jsonify({"item": item.to_dict()})


@packing_bp.route("/api/packing/custom", methods=["POST"])
@login_required
def add_custom_item():
    """Add a custom packing item."""
    data = request.get_json(silent=True) or {}
    destination = (data.get("destination") or "").strip()
    item_text = (data.get("item_text") or "").strip()

    if not destination or not item_text:
        return jsonify({"error": "destination and item_text are required"}), 400

    item = PackingItem(
        user_id=current_user.id,
        destination=destination,
        item_text=item_text,
        is_checked=False,
        is_custom=True,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify({"message": "Item added", "item": item.to_dict()}), 201


@packing_bp.route("/api/packing/<int:item_id>", methods=["DELETE"])
@login_required
def delete_item(item_id):
    """Delete a custom packing item."""
    item = PackingItem.query.get_or_404(item_id)
    if item.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403
    if not item.is_custom:
        return jsonify({"error": "Cannot delete auto-generated items"}), 400

    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Item deleted"})
