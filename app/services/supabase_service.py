"""
Supabase Service
=================
Provides a thin abstraction over Supabase Storage for uploading,
downloading, and deleting files.  Falls back to local-disk storage
when ``SUPABASE_URL`` is not configured (e.g. local dev / tests).
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from flask import current_app

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy Supabase client (created once per app context)
# ---------------------------------------------------------------------------
_client_cache: dict = {}


def _get_supabase_client():
    """Return a cached ``supabase.Client``, or *None* when not configured."""
    url = current_app.config.get("SUPABASE_URL", "")
    key = current_app.config.get("SUPABASE_SERVICE_KEY", "") or current_app.config.get(
        "SUPABASE_KEY", ""
    )
    if not url or not key:
        return None

    cache_key = f"{url}:{key}"
    if cache_key not in _client_cache:
        from supabase import create_client

        _client_cache[cache_key] = create_client(url, key)
        logger.info("Supabase client initialised for %s", url)

    return _client_cache[cache_key]


def is_supabase_configured() -> bool:
    """Return *True* when Supabase credentials are present in config."""
    return bool(current_app.config.get("SUPABASE_URL"))


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------


def upload_file(
    bucket: str,
    file_path: str,
    file_data: bytes,
    content_type: str = "application/octet-stream",
) -> Optional[str]:
    """Upload *file_data* to ``bucket/file_path`` in Supabase Storage.

    Returns the **public URL** of the uploaded file, or *None* on failure.
    """
    client = _get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase is not configured – cannot upload file.")

    try:
        client.storage.from_(bucket).upload(
            path=file_path,
            file=file_data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        public_url = client.storage.from_(bucket).get_public_url(file_path)
        logger.info("Uploaded %s/%s", bucket, file_path)
        return public_url
    except Exception:
        logger.exception("Supabase upload failed for %s/%s", bucket, file_path)
        raise


def delete_file(bucket: str, file_path: str) -> bool:
    """Delete a single file from Supabase Storage.  Returns *True* on success."""
    client = _get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase is not configured – cannot delete file.")

    try:
        client.storage.from_(bucket).remove([file_path])
        logger.info("Deleted %s/%s", bucket, file_path)
        return True
    except Exception:
        logger.exception("Supabase delete failed for %s/%s", bucket, file_path)
        return False


def get_public_url(bucket: str, file_path: str) -> str:
    """Return the public URL for a file in Supabase Storage."""
    client = _get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase is not configured – cannot get URL.")

    return client.storage.from_(bucket).get_public_url(file_path)


def get_signed_url(bucket: str, file_path: str, expires_in: int = 3600) -> str:
    """Return a time-limited signed URL (default 1 hour)."""
    client = _get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase is not configured – cannot create signed URL.")

    try:
        resp = client.storage.from_(bucket).create_signed_url(file_path, expires_in)
        return resp.get("signedURL") or resp.get("signedUrl", "")
    except Exception:
        logger.exception("Supabase signed-url failed for %s/%s", bucket, file_path)
        raise


# ---------------------------------------------------------------------------
# Local-disk fallback helpers (used when Supabase is NOT configured)
# ---------------------------------------------------------------------------


def get_local_upload_dir(subdir: str) -> str:
    """Get (and create) the local upload directory for a type of file."""
    base = os.path.join(current_app.instance_path, "..", "uploads", subdir)
    base = os.path.abspath(base)
    os.makedirs(base, exist_ok=True)
    return base
