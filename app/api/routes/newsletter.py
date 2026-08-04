"""
Newsletter API – email subscription for travel tips & deals.
Stores subscribers in SQLite; validates email format.
"""

import re
from flask import Blueprint, request, jsonify
from app.models.database import db
from app.models.entities import NewsletterSubscriber
from app.main import limiter

newsletter_bp = Blueprint("newsletter", __name__, url_prefix="/api/newsletter")

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no consumer (no subscription UI). See FRONTEND_AUDIT.md Phase D.
@newsletter_bp.route("", methods=["POST"])
@limiter.limit("5 per hour")
def subscribe():
    """Subscribe an email to the newsletter."""
    data = request.get_json(silent=True)
    if not data or not data.get("email"):
        return jsonify({"error": "Email is required."}), 400

    email = data["email"].strip().lower()
    if len(email) > 254:
        return jsonify({"error": "Email address too long."}), 400

    # Email validation
    if not _EMAIL_RE.match(email):
        return jsonify({"error": "Please enter a valid email address."}), 400

    # Check for duplicate
    existing = NewsletterSubscriber.query.filter_by(email=email).first()
    if existing:
        return jsonify({"message": "You're already subscribed! 🎉"}), 200

    subscriber = NewsletterSubscriber(email=email)
    db.session.add(subscriber)
    db.session.commit()

    return jsonify({"message": "Thanks for subscribing! ✈️"}), 201
