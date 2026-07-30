"""
Supabase Database Client
=========================
Wraps the Supabase Python client for direct PostgREST database
operations — table queries, RPC calls, and real-time readiness.

This complements SQLAlchemy (the primary ORM) by exposing Supabase-
native features like:

  * PostgREST table queries (select / insert / update / delete)
  * Server-side function calls via ``rpc()``
  * Connection health checks
  * Storage bucket management

Falls back gracefully when ``SUPABASE_URL`` is not configured
(i.e. running locally with SQLite).
"""

from __future__ import annotations

import logging
import socket
from typing import Any, Optional
from urllib.parse import urlparse

from flask import current_app

logger = logging.getLogger(__name__)

# ---------- Lazy client cache (one per URL+key pair) ----------

_db_client_cache: dict = {}


def _resolve_host(host: str, timeout: float = 3.0) -> bool:
    """Quickly check whether *host* resolves via DNS (NXDOMAIN = False)."""
    try:
        socket.setdefaulttimeout(timeout)
        socket.gethostbyname(host)
        return True
    except (socket.gaierror, OSError):
        return False
    finally:
        socket.setdefaulttimeout(None)


def _get_db_client():
    """Return a cached ``supabase.Client`` configured for database access.

    Returns ``None`` when Supabase credentials are absent or the
    host does not resolve (prevents a ~30s hang on stale DNS).
    """
    url = current_app.config.get("SUPABASE_URL", "")
    key = (
        current_app.config.get("SUPABASE_SERVICE_KEY", "")
        or current_app.config.get("SUPABASE_KEY", "")
    )
    if not url or not key:
        return None

    parsed = urlparse(url)
    if parsed.hostname and not _resolve_host(parsed.hostname):
        logger.warning("Supabase host %s does not resolve — skipping", parsed.hostname)
        return None

    cache_key = f"db:{url}:{key}"
    if cache_key not in _db_client_cache:
        from supabase import create_client

        _db_client_cache[cache_key] = create_client(url, key)
        logger.info("Supabase DB client initialised for %s", url)

    return _db_client_cache[cache_key]


# ---------- Public API ----------


def is_cloud_db() -> bool:
    """Return ``True`` when a Supabase PostgreSQL connection is active."""
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
    return "postgresql" in uri


def get_db_backend() -> str:
    """Return a human-readable label for the active database backend."""
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if "postgresql" in uri:
        supa_url = current_app.config.get("SUPABASE_URL", "")
        if supa_url:
            return "Supabase PostgreSQL"
        return "PostgreSQL"
    if "sqlite" in uri:
        return "SQLite (local)"
    return "unknown"


def check_connection() -> dict[str, Any]:
    """Verify that the database is reachable.

    Returns a dict with ``ok`` (bool), ``backend`` (str), and optional
    ``latency_ms`` (float) or ``error`` (str) keys.
    """
    import time

    backend = get_db_backend()

    try:
        from app.models.database import db

        start = time.monotonic()
        db.session.execute(db.text("SELECT 1"))
        latency = round((time.monotonic() - start) * 1000, 1)
        return {"ok": True, "backend": backend, "latency_ms": latency}
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        return {"ok": False, "backend": backend, "error": str(exc)}


# ---------- PostgREST table helpers ----------


def table(name: str):
    """Return a Supabase PostgREST table builder (``client.table(name)``).

    Raises ``RuntimeError`` when Supabase is not configured.
    """
    client = _get_db_client()
    if client is None:
        raise RuntimeError(
            "Supabase is not configured — set SUPABASE_URL and SUPABASE_KEY."
        )
    return client.table(name)


def rpc(fn_name: str, params: Optional[dict] = None):
    """Call a Supabase server-side function via PostgREST ``rpc()``.

    Returns the response data or raises on failure.
    """
    client = _get_db_client()
    if client is None:
        raise RuntimeError("Supabase is not configured — cannot call rpc().")
    return client.rpc(fn_name, params or {}).execute()


# ---------- Storage bucket management ----------


def ensure_storage_buckets():
    """Create default storage buckets if they don't already exist.

    Silently succeeds when buckets already exist or Supabase is not
    configured.
    """
    client = _get_db_client()
    if client is None:
        return

    buckets = [
        current_app.config.get("SUPABASE_STORAGE_BUCKET_PHOTOS", "photos"),
        current_app.config.get("SUPABASE_STORAGE_BUCKET_DOCS", "documents"),
    ]
    for bucket_name in buckets:
        try:
            client.storage.create_bucket(
                bucket_name,
                options={"public": True, "allowed_mime_types": None},
            )
            logger.info("Created storage bucket: %s", bucket_name)
        except Exception:
            # Bucket already exists — ignore
            pass
