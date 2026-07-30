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


# ═══════════════════════════════════════════════════════════
# JWT REFRESH (v2 auth)
# ═══════════════════════════════════════════════════════════


def _v2_register(client):
    return client.post("/api/auth/v2/register", json={
        "name": "JWT Test",
        "email": "jwt-test@example.com",
        "password": "Secret123!",
    })


def _v2_login(client):
    return client.post("/api/auth/v2/login", json={
        "email": "jwt-test@example.com",
        "password": "Secret123!",
    })


class TestJWTRefresh:
    def test_refresh_success(self, client):
        _v2_register(client)
        login_res = _v2_login(client)
        tokens = login_res.get_json()["tokens"]
        refresh_token = tokens["refresh_token"]

        res = client.post("/api/auth/v2/refresh", json={
            "refresh_token": refresh_token,
        })
        assert res.status_code == 200
        new_tokens = res.get_json()["tokens"]
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens

    def test_refresh_with_new_token_works(self, client):
        _v2_register(client)
        login_res = _v2_login(client)
        tokens = login_res.get_json()["tokens"]

        res = client.post("/api/auth/v2/refresh", json={
            "refresh_token": tokens["refresh_token"],
        })
        new_tokens = res.get_json()["tokens"]

        me_res = client.get(
            "/api/auth/v2/me",
            headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
        )
        assert me_res.status_code == 200
        assert me_res.get_json()["user"]["email"] == "jwt-test@example.com"

    def test_refresh_missing_token(self, client):
        res = client.post("/api/auth/v2/refresh", json={})
        assert res.status_code == 400

    def test_refresh_invalid_token(self, client):
        res = client.post("/api/auth/v2/refresh", json={
            "refresh_token": "totally-invalid-token",
        })
        assert res.status_code == 401

    def test_refresh_tampered_token(self, client):
        _v2_register(client)
        login_res = _v2_login(client)
        token = login_res.get_json()["tokens"]["refresh_token"]
        parts = token.split(".")
        if len(parts) == 3:
            tampered = parts[0] + ".eyJtYWxpY2lvdXMiOiJ0cnVlIn0." + parts[2]
            res = client.post("/api/auth/v2/refresh", json={"refresh_token": tampered})
            assert res.status_code == 401

    def test_refresh_blacklisted_after_logout(self, client):
        _v2_register(client)
        login_res = _v2_login(client)
        tokens = login_res.get_json()["tokens"]
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]

        client.post(
            "/api/auth/v2/logout",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"logout_all_devices": False},
        )

        res = client.post("/api/auth/v2/refresh", json={
            "refresh_token": refresh_token,
        })
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# SQL INJECTION TESTS
# ═══════════════════════════════════════════════════════════


SQL_PAYLOADS = [
    "' OR 1=1 --",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "admin' --",
    "test@example.com' OR '1'='1",
    "<script>alert('xss')</script>",
    "${7*7}",
    "../../etc/passwd",
    "1; SELECT * FROM users",
]


class TestSQLInjection:
    def test_login_sql_injection_email(self, client):
        for payload in SQL_PAYLOADS:
            res = client.post("/api/auth/login", json={
                "email": payload,
                "password": "irrelevant123",
            })
            assert res.status_code in (401, 422, 400), f"Payload '{payload}' returned {res.status_code}"

    def test_register_sql_injection(self, client):
        for payload in SQL_PAYLOADS:
            res = client.post("/api/auth/register", json={
                "name": payload,
                "email": f"sqli-{abs(hash(payload))}@test.com",
                "password": "Secret123!",
            })
            assert res.status_code in (201, 422, 400), f"Payload '{payload}' returned {res.status_code}"

    def test_chat_sql_injection(self, client):
        _register(client)

        for payload in SQL_PAYLOADS:
            res = client.post("/api/chat", json={
                "message": payload,
            })
            assert res.status_code in (200, 400, 422), f"Payload '{payload}' returned {res.status_code}"

    def test_budget_sql_injection(self, client):
        _register(client)
        res = client.post("/api/budget/estimate", json={
            "destination": "Goa' OR 1=1 --",
            "num_days": 3,
            "family_size": 2,
            "travel_class": "economy",
        })
        assert res.status_code in (200, 400, 422)


# ═══════════════════════════════════════════════════════════
# RATE LIMITING TESTS  (requires RATELIMIT_ENABLED=True in config)
# ═══════════════════════════════════════════════════════════

import os

pytestmark_rate_limit = pytest.mark.skipif(
    os.environ.get("RATELIMIT_ENABLED", "False") != "True",
    reason="Rate limiting disabled in test config. Set RATELIMIT_ENABLED=True to run.",
)


@pytestmark_rate_limit
class TestRateLimiting:
    def test_rate_limit_returns_429(self, client):
        RATE_LIMIT = 10
        for i in range(RATE_LIMIT + 2):
            res = client.post("/api/auth/login", json={
                "email": f"spam{i}@test.com",
                "password": "irrelevant",
            })
            if i >= RATE_LIMIT:
                if res.status_code == 429:
                    return
        assert False, "Rate limit did not trigger 429 after burst of requests"
