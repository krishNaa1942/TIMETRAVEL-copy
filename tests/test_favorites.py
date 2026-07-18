"""
Tests for Favorites / Wishlist API
=====================================
GET    /api/favorites
POST   /api/favorites
DELETE /api/favorites/<id>
GET    /api/favorites/check
"""

import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, Favorite


# ── Fixtures ────────────────────────────────────────────────

@pytest.fixture()
def app():
    """Fresh app with clean DB per test."""
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
    """Client with a logged-in user."""
    with app.app_context():
        user = User(name="Tester", email="test@example.com")
        user.set_password("password123")
        _db.session.add(user)
        _db.session.commit()

        client.post(
            "/api/auth/login",
            data=json.dumps({"email": "test@example.com", "password": "password123"}),
            content_type="application/json",
        )
    return client


# ═══════════════════════════════════════════════════════════
# Unauthenticated access tests
# ═══════════════════════════════════════════════════════════

class TestFavoritesUnauth:
    """Unauthenticated requests should be rejected."""

    def test_list_requires_login(self, client):
        res = client.get("/api/favorites")
        assert res.status_code == 401

    def test_add_requires_login(self, client):
        res = client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "destination"}),
            content_type="application/json",
        )
        assert res.status_code == 401

    def test_delete_requires_login(self, client):
        res = client.delete("/api/favorites/1")
        assert res.status_code == 401

    def test_check_requires_login(self, client):
        res = client.get("/api/favorites/check?item_name=Goa")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# Add favorite
# ═══════════════════════════════════════════════════════════

class TestAddFavorite:

    def test_add_destination(self, auth_client):
        res = auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "destination"}),
            content_type="application/json",
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["favorite"]["item_name"] == "Goa"
        assert data["favorite"]["item_type"] == "destination"

    def test_add_place(self, auth_client):
        res = auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Taj Mahal", "item_type": "place"}),
            content_type="application/json",
        )
        assert res.status_code == 201
        assert res.get_json()["favorite"]["item_type"] == "place"

    def test_add_with_notes(self, auth_client):
        res = auth_client.post(
            "/api/favorites",
            data=json.dumps({
                "item_name": "Goa",
                "item_type": "destination",
                "notes": "Beach trip in December",
            }),
            content_type="application/json",
        )
        assert res.status_code == 201
        assert res.get_json()["favorite"]["notes"] == "Beach trip in December"

    def test_add_duplicate_returns_409(self, auth_client):
        auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "destination"}),
            content_type="application/json",
        )
        res = auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "destination"}),
            content_type="application/json",
        )
        assert res.status_code == 409

    def test_add_missing_name(self, auth_client):
        res = auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_type": "destination"}),
            content_type="application/json",
        )
        assert res.status_code == 400

    def test_add_invalid_type(self, auth_client):
        res = auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "hotel"}),
            content_type="application/json",
        )
        assert res.status_code == 400

    def test_add_no_json(self, auth_client):
        res = auth_client.post("/api/favorites")
        assert res.status_code == 400

    def test_default_type_is_destination(self, auth_client):
        res = auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Kerala"}),
            content_type="application/json",
        )
        assert res.status_code == 201
        assert res.get_json()["favorite"]["item_type"] == "destination"


# ═══════════════════════════════════════════════════════════
# List favorites
# ═══════════════════════════════════════════════════════════

class TestListFavorites:

    def test_list_empty(self, auth_client):
        res = auth_client.get("/api/favorites")
        assert res.status_code == 200
        assert res.get_json()["favorites"] == []

    def test_list_returns_added(self, auth_client):
        auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "destination"}),
            content_type="application/json",
        )
        auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Taj Mahal", "item_type": "place"}),
            content_type="application/json",
        )
        res = auth_client.get("/api/favorites")
        data = res.get_json()
        assert len(data["favorites"]) == 2

    def test_filter_by_type(self, auth_client):
        auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "destination"}),
            content_type="application/json",
        )
        auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Taj Mahal", "item_type": "place"}),
            content_type="application/json",
        )

        res = auth_client.get("/api/favorites?type=place")
        data = res.get_json()
        assert len(data["favorites"]) == 1
        assert data["favorites"][0]["item_type"] == "place"


# ═══════════════════════════════════════════════════════════
# Delete favorite
# ═══════════════════════════════════════════════════════════

class TestDeleteFavorite:

    def test_delete_existing(self, auth_client):
        res = auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "destination"}),
            content_type="application/json",
        )
        fav_id = res.get_json()["favorite"]["id"]

        res = auth_client.delete(f"/api/favorites/{fav_id}")
        assert res.status_code == 200

        # Verify it's gone
        res = auth_client.get("/api/favorites")
        assert len(res.get_json()["favorites"]) == 0

    def test_delete_nonexistent(self, auth_client):
        res = auth_client.delete("/api/favorites/999")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Check favorite
# ═══════════════════════════════════════════════════════════

class TestCheckFavorite:

    def test_check_not_favorited(self, auth_client):
        res = auth_client.get("/api/favorites/check?item_name=Goa&item_type=destination")
        data = res.get_json()
        assert data["is_favorite"] is False
        assert data["favorite"] is None

    def test_check_is_favorited(self, auth_client):
        auth_client.post(
            "/api/favorites",
            data=json.dumps({"item_name": "Goa", "item_type": "destination"}),
            content_type="application/json",
        )
        res = auth_client.get("/api/favorites/check?item_name=Goa&item_type=destination")
        data = res.get_json()
        assert data["is_favorite"] is True
        assert data["favorite"]["item_name"] == "Goa"

    def test_check_missing_name(self, auth_client):
        res = auth_client.get("/api/favorites/check")
        assert res.status_code == 400


# ═══════════════════════════════════════════════════════════
# Model tests
# ═══════════════════════════════════════════════════════════

class TestFavoriteModel:

    def test_to_dict(self, app):
        with app.app_context():
            user = User(name="A", email="a@b.com")
            user.set_password("123456")
            _db.session.add(user)
            _db.session.commit()

            fav = Favorite(user_id=user.id, item_type="destination", item_name="Goa", notes="Beaches!")
            _db.session.add(fav)
            _db.session.commit()

            d = fav.to_dict()
            assert d["item_name"] == "Goa"
            assert d["item_type"] == "destination"
            assert d["notes"] == "Beaches!"
            assert "id" in d
            assert "created_at" in d

    def test_repr(self, app):
        fav = Favorite(item_type="place", item_name="Taj Mahal")
        assert "place:Taj Mahal" in repr(fav)

    def test_user_relationship(self, app):
        with app.app_context():
            user = User(name="B", email="b@c.com")
            user.set_password("123456")
            _db.session.add(user)
            _db.session.commit()

            fav = Favorite(user_id=user.id, item_type="destination", item_name="Jaipur")
            _db.session.add(fav)
            _db.session.commit()

            assert user.favorites.count() == 1
            assert user.favorites.first().item_name == "Jaipur"
