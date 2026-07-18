"""
Database Initialisation
========================
Sets up the database via Flask-SQLAlchemy with a single shared ``db`` instance.
Supports PostgreSQL (Supabase) in production and SQLite for local development.
Tables are created automatically on first run.

When connected to PostgreSQL, connection pooling is configured automatically
for reliability with Supabase's connection limits.
"""

import logging
from pathlib import Path

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine

logger = logging.getLogger(__name__)

db = SQLAlchemy()


def _local_sqlite_uri(app):
    """Return the default local SQLite URI for this app instance."""
    return f"sqlite:///{Path(app.instance_path) / 'timetravel.db'}"


def _ensure_database_reachable(app):
    """Fallback to local SQLite when configured PostgreSQL is unreachable.

    This prevents runtime 500s on auth/routes when DATABASE_URL is set but
    credentials/tenant are invalid.
    """
    uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if "postgresql" not in uri:
        return

    try:
        engine = create_engine(uri, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        engine.dispose()
    except Exception as exc:
        fallback_uri = _local_sqlite_uri(app)
        logger.error(
            "PostgreSQL is unreachable (%s). Falling back to local SQLite: %s",
            exc,
            fallback_uri,
        )
        app.config["SQLALCHEMY_DATABASE_URI"] = fallback_uri
        app.config.pop("SQLALCHEMY_ENGINE_OPTIONS", None)


def _apply_pool_settings(app):
    """Configure connection pooling for PostgreSQL (Supabase).

    SQLite uses NullPool (single connection) by default so this only
    applies when the URI contains ``postgresql``.
    """
    uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if "postgresql" not in uri:
        return

    opts = app.config.setdefault("SQLALCHEMY_ENGINE_OPTIONS", {})
    opts.setdefault("pool_size", 5)
    opts.setdefault("max_overflow", 10)
    opts.setdefault("pool_timeout", 30)
    opts.setdefault("pool_recycle", 300)
    opts.setdefault("pool_pre_ping", True)


def init_db(app):
    """
    Bind the SQLAlchemy instance to the Flask app and create tables.

    Applies connection-pool tuning for PostgreSQL and logs the active
    database backend on startup.

    Args:
        app: Flask application instance.
    """
    initial_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    was_pg_configured = "postgresql" in initial_uri

    _ensure_database_reachable(app)
    _apply_pool_settings(app)
    db.init_app(app)

    with app.app_context():
        # Import entity models so SQLAlchemy registers them before create_all()
        from app.models import entities  # noqa: F401

        uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        is_pg = "postgresql" in uri

        try:
            db.create_all()
        except Exception as exc:
            if is_pg or was_pg_configured:
                logger.warning(
                    "Could not create tables on PostgreSQL — check DATABASE_URL "
                    "and password. Error: %s", exc,
                )
            else:
                raise

        if is_pg:
            logger.info("Database: Supabase PostgreSQL (cloud)")
        else:
            logger.info("Database: SQLite (local)")
