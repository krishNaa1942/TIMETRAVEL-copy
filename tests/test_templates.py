"""
Tests for Trip Templates API
================================
GET    /api/templates                  – List templates (public)
POST   /api/templates/<id>/clone       – Clone template into trip (auth)
"""

import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, Trip, TripTemplate

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
        client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
    return client


# ═══════════════════════════════════════════════════════════
# List Templates
# ═══════════════════════════════════════════════════════════


class TestListTemplates:
    def test_list_templates_no_auth(self, client):
        """Templates listing should not require authentication."""
        res = client.get("/api/templates")
        assert res.status_code == 200
        data = res.get_json()
        assert "templates" in data

    def test_list_templates_returns_builtins(self, client):
        """Should return the built-in templates."""
        res = client.get("/api/templates")
        templates = res.get_json()["templates"]
        assert len(templates) > 0
        # Each template should have required fields
        for t in templates:
            assert "title" in t
            assert "destination" in t
            assert "num_days" in t

    def test_list_templates_filter_by_category(self, client):
        """Should filter templates by category if param provided."""
        res = client.get("/api/templates?category=honeymoon")
        assert res.status_code == 200

    def test_list_templates_authenticated(self, auth_client):
        """Authenticated users should also see templates."""
        res = auth_client.get("/api/templates")
        assert res.status_code == 200
        assert len(res.get_json()["templates"]) > 0


# ═══════════════════════════════════════════════════════════
# Clone Template
# ═══════════════════════════════════════════════════════════


class TestCloneTemplate:
    def test_clone_template_unauth(self, client):
        """Cloning requires authentication."""
        res = client.post("/api/templates/1/clone")
        assert res.status_code == 401

    def test_clone_builtin_template(self, auth_client):
        """Clone a built-in template into a new trip."""
        # Get a template ID first
        templates = auth_client.get("/api/templates").get_json()["templates"]
        if not templates:
            pytest.skip("No templates available")
        template_id = templates[0]["id"]

        res = auth_client.post(f"/api/templates/{template_id}/clone")
        assert res.status_code == 201
        trip = res.get_json()["trip"]
        assert trip["title"] is not None
        assert trip["destination"] is not None

    def test_clone_nonexistent_template(self, auth_client):
        """Cloning a non-existent template should fail."""
        res = auth_client.post("/api/templates/99999/clone")
        assert res.status_code == 404

    def test_clone_creates_trip_in_planner(self, auth_client):
        """After cloning, the trip should appear in the planner list."""
        templates = auth_client.get("/api/templates").get_json()["templates"]
        if not templates:
            pytest.skip("No templates available")
        template_id = templates[0]["id"]

        auth_client.post(f"/api/templates/{template_id}/clone")
        trips = auth_client.get("/api/trips/planner").get_json()["trips"]
        assert len(trips) >= 1
