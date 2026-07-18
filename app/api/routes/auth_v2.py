"""
Authentication API Routes (v2)
Production-Grade JWT Authentication Endpoints
"""

from flask import Blueprint, request, jsonify, g, session
from functools import wraps
import os
import logging
import re
import uuid

import jwt
import requests
from flask_login import login_user, logout_user

from app.models.database import db
from app.models.entities import User
from app.services.jwt_service_v2 import jwt_service_v2, TokenType
from app.utils.security import hash_password, verify_password

logger = logging.getLogger(__name__)

auth_v2_bp = Blueprint("auth_v2", __name__, url_prefix="/api/auth/v2")

# Simple in-memory user store for development (replace with database in production)
_users_db = {}  # email -> user data

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"

# ============================================================================
# DECORATORS
# ============================================================================

def require_auth(f):
    """Decorator to require authentication"""
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


def _serialize_auth_user(user: dict | User) -> dict:
    if isinstance(user, User):
        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }

    return {
        "id": user["id"],
        "name": user.get("name", ""),
        "email": user["email"],
    }


def _sync_memory_user(
    user: User,
    *,
    password_hash: str | None = None,
    provider: str | None = None,
    provider_id: str | None = None,
    avatar_url: str | None = None,
) -> dict:
    record = {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "password_hash": password_hash or user.password_hash,
    }

    if provider is not None:
        record["provider"] = provider
    if provider_id is not None:
        record["provider_id"] = provider_id
    if avatar_url is not None:
        record["avatar_url"] = avatar_url

    _users_db[user.email] = record
    return record


def _resolve_db_user(
    *,
    user_id: str | None = None,
    email: str | None = None,
    name: str | None = None,
    create_if_missing: bool = False,
) -> User | None:
    user = None

    if user_id:
        try:
            user = db.session.get(User, int(user_id))
        except (TypeError, ValueError):
            user = None

    if not user and email:
        user = User.query.filter_by(email=email).first()

    if user and name and user.name != name:
        user.name = name

    if not user and create_if_missing and email:
        user = User(
            name=name or email.split("@", 1)[0] or "User",
            email=email,
            password_hash=hash_password(uuid.uuid4().hex),
        )
        db.session.add(user)
        db.session.flush()

    return user


def _login_session_user(user: User) -> None:
    login_user(user)
    session.permanent = True


def _create_auth_response(user: dict, token_pair) -> dict:
    return {
        "success": True,
        "user": _serialize_auth_user(user),
        "tokens": {
            "access_token": token_pair.access_token,
            "refresh_token": token_pair.refresh_token,
            "token_type": token_pair.token_type,
            "expires_in": token_pair.expires_in,
        },
    }


def _upsert_oauth_user(
    *,
    email: str,
    name: str,
    provider: str,
    provider_id: str,
    avatar_url: str | None = None,
) -> User:
    user = _resolve_db_user(
        email=email,
        name=name,
        create_if_missing=True,
    )

    if not user:
        raise RuntimeError("Failed to resolve OAuth user")

    _sync_memory_user(
        user,
        provider=provider,
        provider_id=provider_id,
        avatar_url=avatar_url,
    )

    return user


def _verify_google_access_token(access_token: str) -> dict | None:
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
    raw_values = os.environ.get("APPLE_CLIENT_ID", "")
    audiences = [value.strip() for value in raw_values.split(",") if value.strip()]
    if audiences:
        return audiences
    if os.environ.get("FLASK_ENV") == "development":
        return []
    return []


def _verify_apple_identity_token(identity_token: str) -> dict | None:
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
# ROUTES
# ============================================================================

@auth_v2_bp.route("/register", methods=["POST"])
def register():
    """Register a new user"""
    data = request.get_json() or {}
    
    name = data.get("name", "").strip()
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    device_id = request.headers.get("X-Device-ID", "unknown")
    
    # Validation
    if not all([name, email, password]):
        return jsonify({"error": "validation_error", "message": "Name, email, and password required"}), 400
    
    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return jsonify({"error": "validation_error", "message": "Invalid email format"}), 400
    
    if len(password) < 8:
        return jsonify({"error": "validation_error", "message": "Password must be at least 8 characters"}), 400
    
    # Check existing user
    if email in _users_db or User.query.filter_by(email=email).first():
        return jsonify({"error": "user_exists", "message": "Account with this email already exists"}), 409
    
    # Create user
    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    _sync_memory_user(user)
    _login_session_user(user)
    
    # Generate tokens
    token_pair = jwt_service_v2.create_token_pair(
        user_id=str(user.id),
        email=user.email,
        device_id=device_id
    )
    
    logger.info(f"User registered: {email}")
    
    return jsonify({
        "success": True,
        "user": _serialize_auth_user(user),
        "tokens": {
            "access_token": token_pair.access_token,
            "refresh_token": token_pair.refresh_token,
            "token_type": token_pair.token_type,
            "expires_in": token_pair.expires_in
        }
    }), 201


@auth_v2_bp.route("/login", methods=["POST"])
def login():
    """Login with email and password"""
    data = request.get_json() or {}
    
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    device_id = request.headers.get("X-Device-ID", "unknown")
    
    if not email or not password:
        return jsonify({"error": "validation_error", "message": "Email and password required"}), 400
    
    memory_user = _users_db.get(email)
    db_user = User.query.filter_by(email=email).first()
    authenticated = False

    if db_user and db_user.check_password(password):
        authenticated = True
    elif memory_user and memory_user.get("password_hash") and verify_password(password, memory_user["password_hash"]):
        authenticated = True
        if not db_user:
            db_user = User(
                name=memory_user.get("name") or email.split("@", 1)[0] or "User",
                email=email,
            )
            db_user.set_password(password)
            db.session.add(db_user)
        elif not db_user.check_password(password):
            db_user.set_password(password)

    if not authenticated or not db_user:
        return jsonify({"error": "invalid_credentials", "message": "Invalid email or password"}), 401

    db.session.commit()
    _sync_memory_user(db_user)
    _login_session_user(db_user)
    
    # Generate tokens
    token_pair = jwt_service_v2.create_token_pair(
        user_id=str(db_user.id),
        email=db_user.email,
        device_id=device_id
    )
    
    logger.info(f"User logged in: {email}")
    
    return jsonify({
        "success": True,
        "user": _serialize_auth_user(db_user),
        "tokens": {
            "access_token": token_pair.access_token,
            "refresh_token": token_pair.refresh_token,
            "token_type": token_pair.token_type,
            "expires_in": token_pair.expires_in
        }
    })


@auth_v2_bp.route("/refresh", methods=["POST"])
def refresh():
    """Refresh access token"""
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
            "expires_in": token_pair.expires_in
        }
    })


@auth_v2_bp.route("/password-reset", methods=["POST"])
def password_reset():
    data = request.get_json() or {}
    email = data.get("email", "").lower().strip()

    if not email:
        return jsonify({"error": "validation_error", "message": "Email is required"}), 400

    if email in _users_db:
        logger.info("Password reset requested for: %s", email)

    return jsonify({
        "success": True,
        "message": "If the account exists, password reset instructions will be sent.",
    })


@auth_v2_bp.route("/oauth/google", methods=["POST"])
def oauth_google():
    data = request.get_json() or {}
    access_token = data.get("access_token")

    if not access_token:
        return jsonify({"error": "validation_error", "message": "Google access token required"}), 400

    profile = _verify_google_access_token(access_token)
    if not profile:
        return jsonify({"error": "invalid_oauth_token", "message": "Unable to verify Google account"}), 401

    email = profile.get("email", "").lower().strip()
    name = profile.get("name") or profile.get("given_name") or email.split("@")[0]
    provider_id = profile.get("sub") or email
    avatar_url = profile.get("picture")

    user = _upsert_oauth_user(
        email=email,
        name=name,
        provider="google",
        provider_id=provider_id,
        avatar_url=avatar_url,
    )

    db.session.commit()
    _login_session_user(user)

    token_pair = jwt_service_v2.create_token_pair(
        user_id=str(user.id),
        email=user.email,
        device_id=request.headers.get("X-Device-ID", "unknown"),
    )

    return jsonify(_create_auth_response(user, token_pair)), 200


@auth_v2_bp.route("/oauth/apple", methods=["POST"])
def oauth_apple():
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
        parts = [part for part in [full_name.get("givenName"), full_name.get("familyName")] if part]
        full_name = " ".join(parts) if parts else email.split("@")[0]

    user = _upsert_oauth_user(
        email=email,
        name=full_name,
        provider="apple",
        provider_id=payload.get("sub") or email,
    )

    db.session.commit()
    _login_session_user(user)

    token_pair = jwt_service_v2.create_token_pair(
        user_id=str(user.id),
        email=user.email,
        device_id=request.headers.get("X-Device-ID", "unknown"),
    )

    return jsonify(_create_auth_response(user, token_pair)), 200


@auth_v2_bp.route("/logout", methods=["POST"])
@require_auth
def logout():
    """Logout current user"""
    data = request.get_json() or {}
    logout_all = data.get("logout_all_devices", False)
    
    auth_header = request.headers.get("Authorization")
    access_token = auth_header.split()[1]
    
    jwt_service_v2.logout(access_token, logout_all_devices=logout_all)
    logout_user()
    session.clear()
    
    message = "Logged out from all devices" if logout_all else "Logged out successfully"
    return jsonify({"success": True, "message": message})


@auth_v2_bp.route("/me", methods=["GET"])
@require_auth
def get_current_user():
    """Get current user info"""
    user_email = g.user.get("email")
    user = _resolve_db_user(
        user_id=g.user.get("user_id"),
        email=user_email,
        name=_users_db.get(user_email, {}).get("name") if user_email else None,
        create_if_missing=True,
    )
    
    if not user:
        return jsonify({"error": "user_not_found", "message": "User not found"}), 404

    db.session.commit()
    _sync_memory_user(user)
    _login_session_user(user)
    
    return jsonify({
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }
    })


@auth_v2_bp.route("/sessions", methods=["GET"])
@require_auth
def get_sessions():
    """Get active sessions"""
    sessions = jwt_service_v2.get_active_sessions(g.user["user_id"])
    return jsonify({"sessions": sessions})


@auth_v2_bp.route("/sessions/<session_id>", methods=["DELETE"])
@require_auth
def revoke_session(session_id):
    """Revoke a specific session"""
    jwt_service_v2.revoke_session(g.user["user_id"], session_id)
    return jsonify({"success": True, "message": "Session revoked"})


@auth_v2_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile():
    """Update user profile (name and email)"""
    user_email = g.user.get("email")
    user = _resolve_db_user(
        user_id=g.user.get("user_id"),
        email=user_email,
        create_if_missing=False,
    )
    
    if not user:
        return jsonify({"error": "user_not_found", "message": "User not found"}), 404
    
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").lower().strip()
    
    # Validation
    if not name:
        return jsonify({"error": "validation_error", "message": "Name cannot be empty"}), 400
    
    if len(name) > 100:
        return jsonify({"error": "validation_error", "message": "Name is too long (max 100 characters)"}), 400
    
    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return jsonify({"error": "validation_error", "message": "Invalid email format"}), 400
    
    # Check if email is being changed and if new email already exists
    if email != user_email:
        if User.query.filter(User.email == email, User.id != user.id).first():
            return jsonify({"error": "email_exists", "message": "Email already in use"}), 409
        if user_email in _users_db:
            del _users_db[user_email]
    
    # Update user data
    user.name = name
    user.email = email
    db.session.commit()

    _sync_memory_user(user)
    
    logger.info(f"Profile updated for user: {email}")
    
    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }
    })
