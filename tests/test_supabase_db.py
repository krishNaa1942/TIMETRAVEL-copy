"""
Tests for app.services.supabase_db
====================================
Tests the Supabase DB client, connection checks, and backend detection.
"""

import pytest
from app.main import create_app
from app.config import TestingConfig


@pytest.fixture
def app():
    _app = create_app(config_class=TestingConfig)
    yield _app


class TestGetDbBackend:
    def test_sqlite_backend(self, app):
        with app.app_context():
            from app.services.supabase_db import get_db_backend
            assert get_db_backend() == "SQLite (local)"

    def test_postgresql_with_supabase(self, app):
        with app.app_context():
            app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://user:pass@host/db"
            app.config["SUPABASE_URL"] = "https://xyz.supabase.co"
            from app.services.supabase_db import get_db_backend
            assert get_db_backend() == "Supabase PostgreSQL"

    def test_postgresql_without_supabase(self, app):
        with app.app_context():
            app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://user:pass@host/db"
            app.config["SUPABASE_URL"] = ""
            from app.services.supabase_db import get_db_backend
            assert get_db_backend() == "PostgreSQL"

    def test_unknown_backend(self, app):
        with app.app_context():
            app.config["SQLALCHEMY_DATABASE_URI"] = "mysql://user:pass@host/db"
            from app.services.supabase_db import get_db_backend
            assert get_db_backend() == "unknown"


class TestIsCloudDb:
    def test_sqlite_is_not_cloud(self, app):
        with app.app_context():
            from app.services.supabase_db import is_cloud_db
            assert is_cloud_db() is False

    def test_postgresql_is_cloud(self, app):
        with app.app_context():
            app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://user:pass@host/db"
            from app.services.supabase_db import is_cloud_db
            assert is_cloud_db() is True


class TestCheckConnection:
    def test_sqlite_connection_succeeds(self, app):
        with app.app_context():
            from app.models.database import db
            db.create_all()
            from app.services.supabase_db import check_connection
            result = check_connection()
            assert result["ok"] is True
            assert result["backend"] == "SQLite (local)"
            assert "latency_ms" in result
            assert result["latency_ms"] >= 0
            db.drop_all()


class TestTableAndRpc:
    def test_table_raises_without_supabase(self, app):
        with app.app_context():
            app.config["SUPABASE_URL"] = ""
            app.config["SUPABASE_KEY"] = ""
            from app.services.supabase_db import table
            with pytest.raises(RuntimeError, match="Supabase is not configured"):
                table("users")

    def test_rpc_raises_without_supabase(self, app):
        with app.app_context():
            app.config["SUPABASE_URL"] = ""
            app.config["SUPABASE_KEY"] = ""
            from app.services.supabase_db import rpc
            with pytest.raises(RuntimeError, match="Supabase is not configured"):
                rpc("my_function")


class TestEnsureStorageBuckets:
    def test_no_op_without_supabase(self, app):
        """Should silently return when Supabase is not configured."""
        with app.app_context():
            app.config["SUPABASE_URL"] = ""
            app.config["SUPABASE_KEY"] = ""
            from app.services.supabase_db import ensure_storage_buckets
            ensure_storage_buckets()  # Should not raise
