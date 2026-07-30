"""
Shared authentication utilities for API routes.

Provides a single `resolve_authenticated_user()` that handles both
Flask-Login session auth (v1) and JWT bearer token auth (v2).
"""

from typing import Optional, Union

from flask import g, request
from flask_login import current_user

from app.models.database import db
from app.models.entities import User
from app.services.jwt_service_v2 import jwt_service_v2, TokenType


def resolve_authenticated_user() -> Optional[User]:
    """Resolve the current user from session cookie or bearer token.

    Returns the User object, or None if unauthenticated.

    Sets g.user_id and g.user_email as side effects.
    """
    if current_user.is_authenticated:
        uid = getattr(current_user, "id", None)
        if uid is not None:
            g.user_id = uid
            g.user_email = getattr(current_user, "email", None)
            return current_user

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None

    token = auth_header.split(None, 1)[1].strip()
    payload = jwt_service_v2.verify_token(token, TokenType.ACCESS)
    if not payload:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    g.user_id = user_id
    g.user_email = payload.get("email")

    try:
        user = db.session.get(User, int(user_id))
        if user:
            return user
        email = (payload.get("email") or "").strip().lower()
        if email:
            user = User.query.filter_by(email=email).first()
            if user:
                return user
    except (TypeError, ValueError):
        pass

    return None


def resolve_user_id() -> Optional[int]:
    """Resolve the current user ID only (avoids DB lookup when only ID is needed)."""
    if current_user.is_authenticated:
        uid = getattr(current_user, "id", None)
        if uid is not None:
            g.user_id = uid
            g.user_email = getattr(current_user, "email", None)
            try:
                return int(uid)
            except (TypeError, ValueError):
                return None

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None

    token = auth_header.split(None, 1)[1].strip()
    payload = jwt_service_v2.verify_token(token, TokenType.ACCESS)
    if not payload:
        return None

    uid = payload.get("sub")
    if uid is None:
        return None

    g.user_id = uid
    g.user_email = payload.get("email")
    try:
        return int(uid)
    except (TypeError, ValueError):
        return None
