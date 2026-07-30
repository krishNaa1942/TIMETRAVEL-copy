"""
Tests for database initialisation and pool configuration.
"""

import logging
from unittest.mock import patch, MagicMock

from flask import Flask

from app.models.database import _apply_pool_settings, init_db, db


class _FakeConfig(dict):
    """A real dict that allows attribute-style access for MagicMock compat."""

    pass


class TestApplyPoolSettings:
    def test_skips_sqlite(self, app):
        """No pool settings applied for SQLite."""
        _apply_pool_settings(app)
        opts = app.config.get("SQLALCHEMY_ENGINE_OPTIONS", {})
        assert "pool_size" not in opts

    def test_applies_pg_pool_settings(self):
        """Pool settings applied when URI contains 'postgresql'."""
        mock_app = MagicMock()
        cfg = _FakeConfig(SQLALCHEMY_DATABASE_URI="postgresql://user:pass@host/db")
        mock_app.config = cfg

        _apply_pool_settings(mock_app)

        opts = cfg["SQLALCHEMY_ENGINE_OPTIONS"]
        assert opts["pool_size"] == 5
        assert opts["max_overflow"] == 10
        assert opts["pool_timeout"] == 30
        assert opts["pool_recycle"] == 300
        assert opts["pool_pre_ping"] is True

    def test_does_not_override_existing_options(self):
        """Existing pool options are preserved."""
        mock_app = MagicMock()
        cfg = _FakeConfig(
            SQLALCHEMY_DATABASE_URI="postgresql://user:pass@host/db",
            SQLALCHEMY_ENGINE_OPTIONS={"pool_size": 20},
        )
        mock_app.config = cfg

        _apply_pool_settings(mock_app)

        assert cfg["SQLALCHEMY_ENGINE_OPTIONS"]["pool_size"] == 20

    def test_empty_uri(self):
        """No crash when URI is empty."""
        mock_app = MagicMock()
        mock_app.config = _FakeConfig()
        _apply_pool_settings(mock_app)


class TestInitDb:
    def test_pg_create_all_failure_logs_warning(self, caplog):
        """When PostgreSQL create_all fails, a warning is logged."""
        test_app = Flask(__name__)
        test_app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://user:pass@host/db"

        with patch.object(db, "init_app"):
            with patch.object(db, "create_all", side_effect=Exception("conn refused")):
                with caplog.at_level(logging.WARNING):
                    init_db(test_app)

        assert any("Could not create tables" in r.message for r in caplog.records)
