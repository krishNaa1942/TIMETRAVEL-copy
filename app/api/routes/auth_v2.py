"""
Authentication API Routes (v2)
==============================
Production-Grade JWT Authentication Endpoints

POST /api/auth/v2/register       – Create account, return JWT pair
POST /api/auth/v2/login          – Login, return JWT pair
POST /api/auth/v2/refresh        – Refresh access token
POST /api/auth/v2/logout         – Invalidate session
GET  /api/auth/v2/me             – Get current user
GET  /api/auth/v2/sessions       – List active sessions
DELETE /api/auth/v2/sessions/:id – Revoke a session
PUT  /api/auth/v2/profile        – Update name/email
POST /api/auth/v2/password-reset – Request password reset
POST /api/auth/v2/oauth/google   – Google OAuth login
POST /api/auth/v2/oauth/apple    – Apple OAuth login
"""

from flask import Blueprint, request, jsonify, g, session, current_app
from functools import wraps
import os
import logging
import re
import uuid

import jwt
import requests
from flask_login import logout_user

from app.models.database import db
from app.models.entities import User
from app.services.jwt_service_v2 import jwt_service_v2, TokenType
from app.main import limiter

logger = logging.getLogger(__name__)

auth_v2_bp = Blueprint("auth_v2", __name__, url_prefix="/api/auth/v2")

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"


# ============================================================================
# DECORATORS
# ============================================================================

def require_auth(f):
    """Decorator to require JWT authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return jsonify({"error": "missing_authorization", "message": "Authorization header required"}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "invalid_authorization", "message": "Invalid authorization header"}), 401

        token = parts[1]
        payload = jwt_service_v2.verify_token(token, TokenType.ACCESS)

        if not payload:
            return jsonify({"error": "invalid_token", "message": "Token is invalid or expired"}), 401

        g.user = {
            "user_id": payload.get("sub"),
            "email": payload.get("email"),
            "session_id": payload.get("sid"),
        }
        return f(*args, **kwargs)
    return decorated


# ============================================================================
# HELPERS
# ============================================================================

def _serialize_user(user: User) -> dict:
    """Serialize a User model to a dict for API responses."""
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
    }


def _create_auth_response(user: User, token_pair) -> dict:
    """Build the standard auth success response."""
    return {
        "success": True,
        "user": _serialize_user(user),
        "tokens": {
            "access_token": token_pair.access_token,
            "refresh_token": token_pair.refresh_token,
            "token_type": token_pair.token_type,
            "expires_in": token_pair.expires_in,
        },
    }


def _issue_tokens(user: User) -> dict:
    """Create a JWT pair for a user (mobile JWT auth, no server-side session)."""
    device_id = request.headers.get("X-Device-ID", "unknown")
    token_pair = jwt_service_v2.create_token_pair(
        user_id=str(user.id),
        email=user.email,
        device_id=device_id,
    )
    return _create_auth_response(user, token_pair)


def _find_user_by_id(user_id: str) -> User | None:
    """Look up a user by primary key (string)."""
    try:
        return db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        return None


def _find_user_by_email(email: str) -> User | None:
    """Look up a user by email."""
    return User.query.filter_by(email=email).first()


def _find_or_create_oauth_user(
    *, email: str, name: str, provider: str, provider_id: str
) -> User:
    """Find an existing user by email, or create a new one for OAuth."""
    user = _find_user_by_email(email)

    if user:
        if name and user.name != name:
            user.name = name
        return user

    user = User(name=name or email.split("@")[0], email=email)
    user.set_password(uuid.uuid4().hex)
    db.session.add(user)
    db.session.flush()
    return user


# ============================================================================
# OAuth helpers
# ============================================================================

def _verify_google_access_token(access_token: str) -> dict | None:
    """Exchange a Google access token for user profile info."""
    try:
        response = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if response.status_code != 200:
            logger.warning("Google token verification failed: %s", response.status_code)
            return None

        profile = response.json()
        if not profile.get("email"):
            return None
        if profile.get("email_verified") in (False, "false", "False"):
            return None
        return profile
    except requests.RequestException as exc:
        logger.warning("Google token verification error: %s", exc)
        return None


def _apple_audiences() -> list[str]:
    raw = os.environ.get("APPLE_CLIENT_ID", "")
    return [v.strip() for v in raw.split(",") if v.strip()]


def _verify_apple_identity_token(identity_token: str) -> dict | None:
    """Verify an Apple identity token using Apple's JWKS."""
    try:
        jwk_client = jwt.PyJWKClient(APPLE_JWKS_URL)
        signing_key = jwk_client.get_signing_key_from_jwt(identity_token)
        audiences = _apple_audiences()

        decode_kwargs = {
            "algorithms": ["RS256"],
            "issuer": "https://appleid.apple.com",
        }
        if audiences:
            decode_kwargs["audience"] = audiences

        payload = jwt.decode(identity_token, signing_key.key, **decode_kwargs)
        if not payload.get("email"):
            return None
        return payload
    except Exception as exc:
        logger.warning("Apple token verification failed: %s", exc)
        return None


# ============================================================================
# ROUTES — Register / Login / Refresh / Logout
# ============================================================================

@auth_v2_bp.route("/register", methods=["POST"])
@limiter.limit(lambda: current_app.config.get("AUTH_REGISTER_RATE_LIMIT", "20 per hour"))
def register():
    """Register a new user and return JWT tokens."""
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    if not all([name, email, password]):
        return jsonify({"error": "validation_error", "message": "Name, email, and password required"}), 400

    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return jsonify({"error": "validation_error", "message": "Invalid email format"}), 400

    if len(password) < 8:
        return jsonify({"error": "validation_error", "message": "Password must be at least 8 characters"}), 400
    if not re.search(r"[A-Z]", password):
        return jsonify({"error": "validation_error", "message": "Password must contain an uppercase letter"}), 400
    if not re.search(r"[a-z]", password):
        return jsonify({"error": "validation_error", "message": "Password must contain a lowercase letter"}), 400
    if not re.search(r"[0-9]", password):
        return jsonify({"error": "validation_error", "message": "Password must contain a digit"}), 400
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]", password):
        return jsonify({"error": "validation_error", "message": "Password must contain a special character"}), 400

    if _find_user_by_email(email):
        return jsonify({"error": "user_exists", "message": "Account with this email already exists"}), 409

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("Failed to register user: %s", email)
        return jsonify({"error": "Registration failed due to a server error"}), 500

    logger.info("User registered: %s", email)
    return jsonify(_issue_tokens(user)), 201


@auth_v2_bp.route("/login", methods=["POST"])
@limiter.limit(lambda: current_app.config.get("AUTH_LOGIN_RATE_LIMIT", "30 per minute"))
def login():
    """Login with email and password, return JWT tokens."""
    data = request.get_json() or {}

    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "validation_error", "message": "Email and password required"}), 400

    user = _find_user_by_email(email)

    if not user or not user.check_password(password):
        return jsonify({"error": "invalid_credentials", "message": "Invalid email or password"}), 401

    logger.info("User logged in: %s", email)
    return jsonify(_issue_tokens(user))


@auth_v2_bp.route("/refresh", methods=["POST"])
def refresh():
    """Refresh access token using a refresh token."""
    data = request.get_json() or {}
    refresh_token = data.get("refresh_token")
    device_id = request.headers.get("X-Device-ID")

    if not refresh_token:
        return jsonify({"error": "validation_error", "message": "Refresh token required"}), 400

    token_pair = jwt_service_v2.refresh_tokens(refresh_token, device_id)

    if not token_pair:
        return jsonify({"error": "invalid_refresh_token", "message": "Invalid or expired refresh token"}), 401

    return jsonify({
        "success": True,
        "tokens": {
            "access_token": token_pair.access_token,
            "refresh_token": token_pair.refresh_token,
            "token_type": token_pair.token_type,
            "expires_in": token_pair.expires_in,
        },
    })


@auth_v2_bp.route("/logout", methods=["POST"])
@require_auth
def logout():
    """Logout current user and invalidate JWT."""
    data = request.get_json() or {}
    logout_all = data.get("logout_all_devices", False)

    auth_header = request.headers.get("Authorization")
    access_token = auth_header.split()[1]

    jwt_service_v2.logout(access_token, logout_all_devices=logout_all)
    logout_user()
    session.clear()

    message = "Logged out from all devices" if logout_all else "Logged out successfully"
    return jsonify({"success": True, "message": message})


# ============================================================================
# ROUTES — User Info / Profile
# ============================================================================

@auth_v2_bp.route("/me", methods=["GET"])
@require_auth
def get_current_user():
    """Get current authenticated user's info."""
    user = _find_user_by_id(g.user.get("user_id")) or _find_user_by_email(g.user.get("email", ""))

    if not user:
        return jsonify({"error": "user_not_found", "message": "User not found"}), 404

    return jsonify({"user": _serialize_user(user)})


@auth_v2_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile():
    """Update user name and/or email."""
    user = _find_user_by_id(g.user.get("user_id"))

    if not user:
        return jsonify({"error": "user_not_found", "message": "User not found"}), 404

    data = request.get_json() or {}

    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "validation_error", "message": "Name cannot be empty"}), 400
    if len(name) > 100:
        return jsonify({"error": "validation_error", "message": "Name is too long (max 100 characters)"}), 400

    email = data.get("email", "").lower().strip()
    if email and not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return jsonify({"error": "validation_error", "message": "Invalid email format"}), 400

    if email and email != user.email:
        if User.query.filter(User.email == email, User.id != user.id).first():
            return jsonify({"error": "email_exists", "message": "Email already in use"}), 409
        user.email = email

    user.name = name
    db.session.commit()

    logger.info("Profile updated for user_id=%s", user.id)
    return jsonify({"success": True, "user": _serialize_user(user)})


# ============================================================================
# ROUTES — Sessions
# ============================================================================

@auth_v2_bp.route("/sessions", methods=["GET"])
@require_auth
def get_sessions():
    """List active JWT sessions for the current user."""
    sessions = jwt_service_v2.get_active_sessions(g.user["user_id"])
    return jsonify({"sessions": sessions})


@auth_v2_bp.route("/sessions/<session_id>", methods=["DELETE"])
@require_auth
def revoke_session(session_id):
    """Revoke a specific session."""
    jwt_service_v2.revoke_session(g.user["user_id"], session_id)
    return jsonify({"success": True, "message": "Session revoked"})


# ============================================================================
# ROUTES — Password Reset
# ============================================================================

@auth_v2_bp.route("/password-reset", methods=["POST"])
def password_reset():
    """Request a password reset link (always returns success for privacy)."""
    data = request.get_json() or {}
    email = data.get("email", "").lower().strip()

    if not email:
        return jsonify({"error": "validation_error", "message": "Email is required"}), 400

    user = _find_user_by_email(email)
    if user:
        logger.info("Password reset requested for user_id=%s", user.id)

    return jsonify({
        "success": True,
        "message": "If the account exists, password reset instructions will be sent.",
    })


# ============================================================================
# ROUTES — OAuth
# ============================================================================

@auth_v2_bp.route("/oauth/google", methods=["POST"])
def oauth_google():
    """Login/register via Google OAuth."""
    data = request.get_json() or {}
    access_token = data.get("access_token")

    if not access_token:
        return jsonify({"error": "validation_error", "message": "Google access token required"}), 400

    profile = _verify_google_access_token(access_token)
    if not profile:
        return jsonify({"error": "invalid_oauth_token", "message": "Unable to verify Google account"}), 401

    email = profile.get("email", "").lower().strip()
    name = profile.get("name") or profile.get("given_name") or email.split("@")[0]

    user = _find_or_create_oauth_user(
        email=email,
        name=name,
        provider="google",
        provider_id=profile.get("sub", email),
    )
    db.session.commit()

    return jsonify(_issue_tokens(user)), 200


@auth_v2_bp.route("/oauth/apple", methods=["POST"])
def oauth_apple():
    """Login/register via Apple OAuth."""
    data = request.get_json() or {}
    identity_token = data.get("identity_token")

    if not identity_token:
        return jsonify({"error": "validation_error", "message": "Apple identity token required"}), 400

    payload = _verify_apple_identity_token(identity_token)
    if not payload:
        return jsonify({"error": "invalid_oauth_token", "message": "Unable to verify Apple account"}), 401

    email = (payload.get("email") or data.get("email") or "").lower().strip()
    if not email:
        return jsonify({"error": "validation_error", "message": "Apple email is required"}), 400

    full_name = data.get("name") or payload.get("name") or email.split("@")[0]
    if isinstance(full_name, dict):
        parts = [p for p in [full_name.get("givenName"), full_name.get("familyName")] if p]
        full_name = " ".join(parts) if parts else email.split("@")[0]

    user = _find_or_create_oauth_user(
        email=email,
        name=full_name,
        provider="apple",
        provider_id=payload.get("sub", email),
    )
    db.session.commit()

    return jsonify(_issue_tokens(user)), 200
