"""
Tests for Trip Sharing API
=============================
POST   /api/share          – Create share link
GET    /api/share/<token>  – View shared trip (public)
GET    /api/share          – List user's shares
DELETE /api/share/<token>  – Revoke share
"""

import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, SharedTrip, TripQuery


# ── Fixtures ────────────────────────────────────────────────

@pytest.fixture()
def app():
    application = create_app(config_class=TestingConfig)
    application.config["WTF_CSRF_ENABLED"] = False
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth_client(app, client):
    with app.app_context():
        user = User(name="Tester", email="test@example.com")
        user.set_password("password123")
        _db.session.add(user)
        _db.session.commit()
        client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
    return client


def _create_share(client, **overrides):
    payload = {
        "title": "My Goa Trip",
        "itinerary_json": {"day1": "Beach", "day2": "Fort"},
    }
    payload.update(overrides)
    return client.post("/api/share", json=payload)


# ═══════════════════════════════════════════════════════════
# Unauthenticated access
# ═══════════════════════════════════════════════════════════

class TestSharingUnauth:
    def test_create_share_unauth(self, client):
        res = _create_share(client)
        assert res.status_code == 401

    def test_list_shares_unauth(self, client):
        res = client.get("/api/share")
        assert res.status_code == 401

    def test_revoke_share_unauth(self, client):
        res = client.delete("/api/share/fake-token")
        assert res.status_code == 401

    def test_view_shared_no_auth_required(self, client):
        """Public endpoint – should return 404 (not 401) for bad token."""
        res = client.get("/api/share/nonexistent-token")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════

class TestSharingCRUD:
    def test_create_share_success(self, auth_client):
        res = _create_share(auth_client)
        assert res.status_code == 201
        data = res.get_json()
        assert data["share"]["title"] == "My Goa Trip"
        assert "share_token" in data["share"]
        assert data["share_url"].startswith("/shared/")

    def test_create_share_default_title(self, auth_client):
        res = auth_client.post("/api/share", json={})
        assert res.status_code == 201
        assert res.get_json()["share"]["title"] == "My Trip"

    def test_view_shared_trip(self, auth_client, client):
        create_res = _create_share(auth_client)
        token = create_res.get_json()["share"]["share_token"]
        auth_client.post("/api/auth/logout")

        res = client.get(f"/api/share/{token}")
        assert res.status_code == 200
        data = res.get_json()
        assert data["title"] == "My Goa Trip"
        assert data["itinerary"] is not None
        assert data["view_count"] == 1

    def test_view_shared_increments_view_count(self, auth_client, client):
        create_res = _create_share(auth_client)
        token = create_res.get_json()["share"]["share_token"]
        auth_client.post("/api/auth/logout")

        client.get(f"/api/share/{token}")
        client.get(f"/api/share/{token}")
        res = client.get(f"/api/share/{token}")
        assert res.get_json()["view_count"] == 3

    def test_list_shares_empty(self, auth_client):
        res = auth_client.get("/api/share")
        assert res.status_code == 200
        assert res.get_json()["shares"] == []

    def test_list_shares_after_create(self, auth_client):
        _create_share(auth_client)
        _create_share(auth_client, title="Second Share")
        res = auth_client.get("/api/share")
        assert len(res.get_json()["shares"]) == 2

    def test_revoke_share(self, auth_client, client):
        create_res = _create_share(auth_client)
        token = create_res.get_json()["share"]["share_token"]

        res = auth_client.delete(f"/api/share/{token}")
        assert res.status_code == 200

        # Verify revoked link returns 404
        auth_client.post("/api/auth/logout")
        res = client.get(f"/api/share/{token}")
        assert res.status_code == 404

    def test_revoke_share_not_found(self, auth_client):
        res = auth_client.delete("/api/share/nonexistent-token")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Ownership
# ═══════════════════════════════════════════════════════════

class TestSharingOwnership:
    def test_cannot_revoke_other_users_share(self, app, client):
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"})
        create_res = _create_share(client)
        token = create_res.get_json()["share"]["share_token"]
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "b@example.com", "password": "password123"})
        res = client.delete(f"/api/share/{token}")
        assert res.status_code == 404

    def test_cannot_list_other_users_shares(self, app, client):
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"})
        _create_share(client)
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "b@example.com", "password": "password123"})
        res = client.get("/api/share")
        assert res.get_json()["shares"] == []
