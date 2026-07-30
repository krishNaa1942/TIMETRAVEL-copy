"""
Tests for User Authentication & Trip History
=============================================
Covers: register, login, logout, /me, validation, trip CRUD.
"""

import pytest
from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db


# ── Fixtures (function-scoped for clean state) ────────────────────


@pytest.fixture()
def app():
    """Create a fresh app + DB per test."""
    _app = create_app(config_class=TestingConfig)
    with _app.app_context():
        _db.create_all()
        yield _app
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _register(client, name="Test User", email="test@example.com", password="Secret123!"):
    return client.post("/api/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
    })


def _login(client, email="test@example.com", password="Secret123!"):
    return client.post("/api/auth/login", json={
        "email": email,
        "password": password,
    })


# ═══════════════════════════════════════════════════════════
# REGISTRATION
# ═══════════════════════════════════════════════════════════

class TestRegister:
    def test_register_success(self, client):
        res = _register(client)
        assert res.status_code == 201
        data = res.get_json()
        assert data["user"]["email"] == "test@example.com"
        assert data["user"]["name"] == "Test User"

    def test_register_duplicate_email(self, client):
        _register(client)
        res = _register(client)
        assert res.status_code == 409
        assert "already exists" in res.get_json()["error"]

    def test_register_missing_fields(self, client):
        res = client.post("/api/auth/register", json={"name": "A"})
        assert res.status_code == 422
        assert "details" in res.get_json()

    def test_register_short_password(self, client):
        res = _register(client, password="abc")
        assert res.status_code == 422
        details = res.get_json()["details"]
        assert any("8 characters" in d for d in details)

    def test_register_invalid_email(self, client):
        res = _register(client, email="not-an-email")
        assert res.status_code == 422

    def test_register_auto_login(self, client):
        """After registering, /me should show authenticated."""
        _register(client)
        me = client.get("/api/auth/me")
        assert me.get_json()["authenticated"] is True


# ═══════════════════════════════════════════════════════════
# LOGIN / LOGOUT
# ═══════════════════════════════════════════════════════════

class TestLogin:
    def test_login_success(self, client):
        _register(client)
        client.post("/api/auth/logout")

        res = _login(client)
        assert res.status_code == 200
        assert res.get_json()["user"]["email"] == "test@example.com"

    def test_login_wrong_password(self, client):
        _register(client)
        client.post("/api/auth/logout")

        res = _login(client, password="wrong")
        assert res.status_code == 401

    def test_login_nonexistent_user(self, client):
        res = _login(client, email="nobody@x.com")
        assert res.status_code == 401

    def test_logout(self, client):
        _register(client)
        res = client.post("/api/auth/logout")
        assert res.status_code == 200

        me = client.get("/api/auth/me")
        assert me.get_json()["authenticated"] is False


class TestMe:
    def test_unauthenticated(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.get_json()["authenticated"] is False

    def test_authenticated(self, client):
        _register(client)
        res = client.get("/api/auth/me")
        data = res.get_json()
        assert data["authenticated"] is True
        assert data["user"]["name"] == "Test User"


# ═══════════════════════════════════════════════════════════
# TRIP HISTORY (requires auth)
# ═══════════════════════════════════════════════════════════

class TestTrips:
    def _create_trip(self, client):
        """Create a budget trip so it appears in trip history."""
        return client.post("/api/budget/estimate", json={
            "destination": "Goa",
            "num_days": 3,
            "family_size": 4,
            "travel_class": "economy",
        })

    def test_list_trips_unauthenticated(self, client):
        res = client.get("/api/trips")
        assert res.status_code == 401

    def test_list_trips_empty(self, client):
        _register(client)
        res = client.get("/api/trips")
        assert res.status_code == 200
        assert res.get_json()["count"] == 0

    def test_create_and_list_trip(self, client):
        _register(client)
        self._create_trip(client)
        res = client.get("/api/trips")
        data = res.get_json()
        assert data["count"] == 1
        assert data["trips"][0]["destination"] == "Goa"
        assert data["trips"][0]["estimated_budget"] > 0

    def test_get_trip_detail(self, client):
        _register(client)
        self._create_trip(client)
        trips = client.get("/api/trips").get_json()["trips"]
        trip_id = trips[0]["id"]

        res = client.get(f"/api/trips/{trip_id}")
        assert res.status_code == 200
        assert res.get_json()["destination"] == "Goa"

    def test_delete_trip(self, client):
        _register(client)
        self._create_trip(client)
        trips = client.get("/api/trips").get_json()["trips"]
        trip_id = trips[0]["id"]

        res = client.delete(f"/api/trips/{trip_id}")
        assert res.status_code == 200

        # Verify it's gone
        remaining = client.get("/api/trips").get_json()
        assert remaining["count"] == 0

    def test_delete_other_users_trip(self, client):
        """User A's trip should not be deletable by User B."""
        _register(client, name="UserA", email="a@example.com")
        self._create_trip(client)
        trip_id = client.get("/api/trips").get_json()["trips"][0]["id"]
        client.post("/api/auth/logout")

        # Register User B
        _register(client, name="UserB", email="b@example.com")
        res = client.delete(f"/api/trips/{trip_id}")
        assert res.status_code == 404

    def test_trip_not_found(self, client):
        _register(client)
        res = client.get("/api/trips/9999")
        assert res.status_code == 404
