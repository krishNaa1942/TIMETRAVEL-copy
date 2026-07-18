"""
Tests for Packing Checklist API
==================================
POST   /api/packing/generate      – Generate checklist
GET    /api/packing               – Get checklist
PUT    /api/packing/<id>/toggle   – Toggle item
POST   /api/packing/custom        – Add custom item
DELETE /api/packing/<id>          – Delete custom item
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, PackingItem


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


# ═══════════════════════════════════════════════════════════
# Unauthenticated access
# ═══════════════════════════════════════════════════════════

class TestPackingUnauth:
    def test_generate_unauth(self, client):
        res = client.post("/api/packing/generate", json={"destination": "Goa"})
        assert res.status_code == 401

    def test_get_checklist_unauth(self, client):
        res = client.get("/api/packing")
        assert res.status_code == 401

    def test_toggle_unauth(self, client):
        res = client.put("/api/packing/1/toggle")
        assert res.status_code == 401

    def test_add_custom_unauth(self, client):
        res = client.post("/api/packing/custom", json={"destination": "Goa", "item_text": "Hat"})
        assert res.status_code == 401

    def test_delete_unauth(self, client):
        res = client.delete("/api/packing/1")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# Generate Checklist
# ═══════════════════════════════════════════════════════════

class TestPackingGenerate:
    @patch("app.api.routes.packing.fetch_weather")
    def test_generate_checklist_no_weather(self, mock_weather, auth_client):
        """When weather API unavailable, should still return generic items."""
        mock_weather.return_value = None
        res = auth_client.post("/api/packing/generate", json={"destination": "Goa"})
        assert res.status_code == 200
        data = res.get_json()
        assert data["weather_available"] is False
        assert len(data["items"]) > 0

    @patch("app.api.routes.packing.fetch_weather")
    @patch("app.api.routes.packing.suggest_packing")
    def test_generate_checklist_with_weather(self, mock_suggest, mock_weather, auth_client):
        """When weather available, should use suggest_packing result."""
        weather = MagicMock()
        weather.temp_c = 32
        weather.humidity = 80
        weather.description = "clear sky"
        mock_weather.return_value = weather
        mock_suggest.return_value = ["Sunscreen", "Sunglasses", "Light clothes"]
        res = auth_client.post("/api/packing/generate", json={"destination": "Goa"})
        assert res.status_code == 200
        data = res.get_json()
        assert data["weather_available"] is True
        assert len(data["items"]) == 3

    def test_generate_missing_destination(self, auth_client):
        res = auth_client.post("/api/packing/generate", json={})
        assert res.status_code == 400


# ═══════════════════════════════════════════════════════════
# Get / Toggle / Custom / Delete
# ═══════════════════════════════════════════════════════════

class TestPackingCRUD:
    def test_get_checklist_empty(self, auth_client):
        res = auth_client.get("/api/packing")
        assert res.status_code == 200
        data = res.get_json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["progress"] == 0

    def test_add_custom_item(self, auth_client):
        res = auth_client.post("/api/packing/custom", json={
            "destination": "Goa",
            "item_text": "Snorkeling mask",
        })
        assert res.status_code == 201
        item = res.get_json()["item"]
        assert item["item_text"] == "Snorkeling mask"
        assert item["is_custom"] is True
        assert item["is_checked"] is False

    def test_add_custom_item_missing_fields(self, auth_client):
        res = auth_client.post("/api/packing/custom", json={"destination": "Goa"})
        assert res.status_code == 400

    def test_toggle_item(self, auth_client):
        # Add an item first
        add_res = auth_client.post("/api/packing/custom", json={
            "destination": "Goa",
            "item_text": "Flip flops",
        })
        item_id = add_res.get_json()["item"]["id"]

        # Toggle to checked
        res = auth_client.put(f"/api/packing/{item_id}/toggle")
        assert res.status_code == 200
        assert res.get_json()["item"]["is_checked"] is True

        # Toggle back to unchecked
        res = auth_client.put(f"/api/packing/{item_id}/toggle")
        assert res.status_code == 200
        assert res.get_json()["item"]["is_checked"] is False

    def test_delete_custom_item(self, auth_client):
        add_res = auth_client.post("/api/packing/custom", json={
            "destination": "Goa",
            "item_text": "Extra towel",
        })
        item_id = add_res.get_json()["item"]["id"]
        res = auth_client.delete(f"/api/packing/{item_id}")
        assert res.status_code == 200

    def test_delete_auto_generated_item_fails(self, app, auth_client):
        """Cannot delete auto-generated (non-custom) items via DELETE."""
        with app.app_context():
            user = User.query.filter_by(email="test@example.com").first()
            item = PackingItem(
                user_id=user.id,
                destination="Goa",
                item_text="Sunscreen",
                is_checked=False,
                is_custom=False,
            )
            _db.session.add(item)
            _db.session.commit()
            item_id = item.id

        res = auth_client.delete(f"/api/packing/{item_id}")
        assert res.status_code == 400

    def test_get_checklist_with_progress(self, auth_client):
        auth_client.post("/api/packing/custom", json={"destination": "Goa", "item_text": "A"})
        add_res = auth_client.post("/api/packing/custom", json={"destination": "Goa", "item_text": "B"})
        item_id = add_res.get_json()["item"]["id"]
        auth_client.put(f"/api/packing/{item_id}/toggle")

        res = auth_client.get("/api/packing?destination=Goa")
        data = res.get_json()
        assert data["total"] == 2
        assert data["checked"] == 1
        assert data["progress"] == 50


# ═══════════════════════════════════════════════════════════
# Ownership
# ═══════════════════════════════════════════════════════════

class TestPackingOwnership:
    def test_cannot_toggle_other_users_item(self, app, client):
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"})
        add_res = client.post("/api/packing/custom", json={"destination": "Goa", "item_text": "X"})
        item_id = add_res.get_json()["item"]["id"]
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "b@example.com", "password": "password123"})
        res = client.put(f"/api/packing/{item_id}/toggle")
        assert res.status_code == 403
