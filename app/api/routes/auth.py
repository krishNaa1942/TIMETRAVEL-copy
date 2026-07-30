"""
Authentication API Routes
==========================
POST /api/auth/register        – Create a new user account
POST /api/auth/login           – Log in and start a session
POST /api/auth/logout          – End the current session
GET  /api/auth/me              – Get current logged-in user info
POST /api/auth/refresh         – Refresh the session lifetime
GET  /api/auth/status          – Check authentication status (lightweight)
POST /api/auth/change-password – Change user password

Uses Flask-Login for session-based authentication and bcrypt for
password hashing. All responses are JSON.
"""

import re
import logging
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from sqlalchemy.exc import SQLAlchemyError

from app.models.database import db
from app.models.entities import User
from app.main import limiter

auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def _validate_register(data: dict) -> list:
    """Return a list of validation errors for registration."""
    errors = []
    if not data.get("name", "").strip():
        errors.append("name is required")
    if not data.get("email", "").strip():
        errors.append("email is required")
    elif not EMAIL_RE.match(data["email"].strip()):
        errors.append("email format is invalid")
    password = data.get("password", "")
    if len(password) < 8:
        errors.append("password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("password must contain an uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("password must contain a lowercase letter")
    if not re.search(r"[0-9]", password):
        errors.append("password must contain a digit")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password):
        errors.append("password must contain a special character")
    return errors


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------
@auth_bp.route("/api/auth/register", methods=["POST"])
@limiter.limit(lambda: current_app.config.get("AUTH_REGISTER_RATE_LIMIT", "20 per hour"))
def register():
    """Create a new user account."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    errors = _validate_register(data)
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 422

    email = data["email"].strip().lower()
    name = data["name"].strip()
    if len(name) > 100:
        return jsonify({"error": "Name is too long (max 100 characters)"}), 400
    password = data["password"]

    # Check if email already taken
    try:
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "An account with this email already exists"}), 409
    except SQLAlchemyError as exc:
        logger.exception("Register query failed (database unavailable): %s", exc)
        return jsonify({"error": "Authentication service temporarily unavailable"}), 503

    # Create user
    user = User(name=name, email=email)
    user.set_password(password)
    try:
        db.session.add(user)
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        logger.exception("Register commit failed (database unavailable): %s", exc)
        return jsonify({"error": "Authentication service temporarily unavailable"}), 503

    # Auto-login after registration
    login_user(user)

    return jsonify({
        "message": "Account created successfully",
        "user": user.to_dict(),
    }), 201


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------
@auth_bp.route("/api/auth/login", methods=["POST"])
@limiter.limit(lambda: current_app.config.get("AUTH_LOGIN_RATE_LIMIT", "30 per minute"))
def login():
    """Authenticate a user and start a session."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = User.query.filter_by(email=email).first()
    except SQLAlchemyError as exc:
        logger.exception("Login query failed (database unavailable): %s", exc)
        return jsonify({"error": "Authentication service temporarily unavailable"}), 503
    if not user:
        logger.warning("Failed login attempt for unknown email from IP: %s", request.remote_addr)
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.check_password(password):
        logger.warning("Failed login attempt for: %s from IP: %s", email, request.remote_addr)
        return jsonify({"error": "Invalid email or password"}), 401

    login_user(user, remember=True)
    logger.info("Successful login for user_id=%s from IP: %s", user.id, request.remote_addr)

    return jsonify({
        "message": "Login successful",
        "user": user.to_dict(),
    }), 200


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------
@auth_bp.route("/api/auth/logout", methods=["POST"])
@login_required
def logout():
    """End the current user session."""
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------
@auth_bp.route("/api/auth/me", methods=["GET"])
def me():
    """Return the current logged-in user, or 401 if not authenticated."""
    if current_user.is_authenticated:
        return jsonify({"authenticated": True, "user": current_user.to_dict()}), 200
    return jsonify({"authenticated": False}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/refresh
# ---------------------------------------------------------------------------
@auth_bp.route("/api/auth/refresh", methods=["POST"])
def refresh_session():
    """
    Refresh the current session.

    Extends the session lifetime if the user is still authenticated.
    Used by frontend to keep sessions alive during active use.
    """
    from flask import session
    if not current_user.is_authenticated:
        return jsonify({"error": "Session expired", "authenticated": False}), 401

    try:
        session.modified = True
        session.permanent = True
        logger.debug("Session refreshed for user: %s", current_user.email)

        return jsonify({
            "message": "Session refreshed",
            "user": current_user.to_dict(),
            "authenticated": True,
        }), 200
    except Exception as exc:
        logger.error("Session refresh error: %s", exc, exc_info=True)
        return jsonify({"error": "Session refresh failed"}), 500


# ---------------------------------------------------------------------------
# GET /api/auth/status
# ---------------------------------------------------------------------------
@auth_bp.route("/api/auth/status", methods=["GET"])
def auth_status():
    """Check authentication status without full user data."""
    is_auth = getattr(current_user, "is_authenticated", False)
    return jsonify({
        "authenticated": is_auth,
        "user_id": current_user.id if is_auth else None,
    }), 200


# ---------------------------------------------------------------------------
# POST /api/auth/change-password
# ---------------------------------------------------------------------------
@auth_bp.route("/api/auth/change-password", methods=["POST"])
@login_required
def change_password():
    """Change user password (requires current password verification)."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400

    if not current_user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect"}), 401

    try:
        current_user.set_password(new_password)
        db.session.commit()
        logger.info("Password changed for user_id=%s", current_user.id)
        return jsonify({"message": "Password changed successfully"}), 200
    except SQLAlchemyError as exc:
        db.session.rollback()
        logger.exception("Password change failed: %s", exc)
        return jsonify({"error": "Password change failed"}), 500

