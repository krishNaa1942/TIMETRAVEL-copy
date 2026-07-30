"""
Tests for Trip Planner API
=============================
CRUD for trips, days, places, and companions.
"""

import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, Trip

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


def _create_trip(client, **overrides):
    payload = {
        "title": "Goa Trip",
        "destination": "Goa",
        "num_days": 3,
        "start_date": "2026-06-01",
    }
    payload.update(overrides)
    return client.post("/api/trips/planner", json=payload)


def _get_trip_id(client):
    return client.get("/api/trips/planner").get_json()["trips"][0]["id"]


# ═══════════════════════════════════════════════════════════
# Unauthenticated access
# ═══════════════════════════════════════════════════════════


class TestTripPlannerUnauth:
    def test_create_trip_unauth(self, client):
        res = client.post("/api/trips/planner", json={"title": "X", "destination": "Y"})
        assert res.status_code == 401

    def test_list_trips_unauth(self, client):
        res = client.get("/api/trips/planner")
        assert res.status_code == 200
        assert res.get_json()["trips"] == []

    def test_get_trip_unauth(self, client):
        res = client.get("/api/trips/planner/1")
        assert res.status_code == 401

    def test_delete_trip_unauth(self, client):
        res = client.delete("/api/trips/planner/1")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# Trip CRUD
# ═══════════════════════════════════════════════════════════


class TestTripPlannerCRUD:
    def test_create_trip_success(self, auth_client):
        res = _create_trip(auth_client)
        assert res.status_code == 201
        trip = res.get_json()["trip"]
        assert trip["title"] == "Goa Trip"
        assert trip["destination"] == "Goa"
        assert trip["num_days"] == 3
        # Auto-created days
        assert len(trip.get("days", [])) == 3

    def test_create_trip_missing_title(self, auth_client):
        res = auth_client.post("/api/trips/planner", json={"destination": "Goa"})
        assert res.status_code == 400

    def test_create_trip_missing_destination(self, auth_client):
        res = auth_client.post("/api/trips/planner", json={"title": "My Trip"})
        assert res.status_code == 400

    def test_list_trips_empty(self, auth_client):
        res = auth_client.get("/api/trips/planner")
        assert res.status_code == 200
        assert res.get_json()["trips"] == []

    def test_list_trips_after_create(self, auth_client):
        _create_trip(auth_client)
        _create_trip(auth_client, title="Delhi Trip", destination="Delhi")
        res = auth_client.get("/api/trips/planner")
        assert len(res.get_json()["trips"]) == 2

    def test_get_trip_detail(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.get(f"/api/trips/planner/{trip_id}")
        assert res.status_code == 200
        trip = res.get_json()["trip"]
        assert trip["title"] == "Goa Trip"
        assert "days" in trip
        assert "reservations" in trip
        assert "photos" in trip
        assert "companions" in trip

    def test_get_trip_not_found(self, auth_client):
        res = auth_client.get("/api/trips/planner/9999")
        assert res.status_code == 404

    def test_update_trip(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.put(
            f"/api/trips/planner/{trip_id}",
            json={
                "title": "Updated Title",
                "status": "active",
            },
        )
        assert res.status_code == 200
        assert res.get_json()["trip"]["title"] == "Updated Title"
        assert res.get_json()["trip"]["status"] == "active"

    def test_update_trip_not_found(self, auth_client):
        res = auth_client.put("/api/trips/planner/9999", json={"title": "X"})
        assert res.status_code == 404

    def test_delete_trip(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.delete(f"/api/trips/planner/{trip_id}")
        assert res.status_code == 200
        remaining = auth_client.get("/api/trips/planner").get_json()["trips"]
        assert len(remaining) == 0

    def test_delete_trip_not_found(self, auth_client):
        res = auth_client.delete("/api/trips/planner/9999")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Trip Days
# ═══════════════════════════════════════════════════════════


class TestTripDays:
    def test_add_day(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.post(
            f"/api/trips/planner/{trip_id}/days",
            json={
                "title": "Day 4 - Beach",
            },
        )
        assert res.status_code == 201
        assert res.get_json()["day"]["title"] == "Day 4 - Beach"

    def test_add_day_trip_not_found(self, auth_client):
        res = auth_client.post("/api/trips/planner/9999/days", json={"title": "X"})
        assert res.status_code == 404

    def test_update_day(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        trip = auth_client.get(f"/api/trips/planner/{trip_id}").get_json()["trip"]
        day_id = trip["days"][0]["id"]
        res = auth_client.put(
            f"/api/trips/planner/{trip_id}/days/{day_id}",
            json={
                "title": "Beach Day!",
                "notes": "Don't forget sunscreen",
            },
        )
        assert res.status_code == 200
        assert res.get_json()["day"]["title"] == "Beach Day!"

    def test_update_day_not_found(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.put(
            f"/api/trips/planner/{trip_id}/days/9999", json={"title": "X"}
        )
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Trip Places
# ═══════════════════════════════════════════════════════════


class TestTripPlaces:
    def test_add_place(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        trip = auth_client.get(f"/api/trips/planner/{trip_id}").get_json()["trip"]
        day_id = trip["days"][0]["id"]
        res = auth_client.post(
            f"/api/trips/planner/{trip_id}/places",
            json={
                "name": "Baga Beach",
                "day_id": day_id,
                "category": "beach",
            },
        )
        assert res.status_code == 201
        assert res.get_json()["place"]["name"] == "Baga Beach"

    def test_add_place_missing_name(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.post(
            f"/api/trips/planner/{trip_id}/places", json={"category": "beach"}
        )
        assert res.status_code == 400

    def test_add_place_trip_not_found(self, auth_client):
        res = auth_client.post("/api/trips/planner/9999/places", json={"name": "X"})
        assert res.status_code == 404

    def test_update_place(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        add_res = auth_client.post(
            f"/api/trips/planner/{trip_id}/places", json={"name": "Beach"}
        )
        place_id = add_res.get_json()["place"]["id"]
        res = auth_client.put(
            f"/api/trips/planner/{trip_id}/places/{place_id}",
            json={
                "name": "Calangute Beach",
                "notes": "Great waves",
            },
        )
        assert res.status_code == 200
        assert res.get_json()["place"]["name"] == "Calangute Beach"

    def test_delete_place(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        add_res = auth_client.post(
            f"/api/trips/planner/{trip_id}/places", json={"name": "Beach"}
        )
        place_id = add_res.get_json()["place"]["id"]
        res = auth_client.delete(f"/api/trips/planner/{trip_id}/places/{place_id}")
        assert res.status_code == 200

    def test_delete_place_not_found(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.delete(f"/api/trips/planner/{trip_id}/places/9999")
        assert res.status_code == 404

    def test_reorder_places(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        trip = auth_client.get(f"/api/trips/planner/{trip_id}").get_json()["trip"]
        day_id = trip["days"][0]["id"]

        p1 = auth_client.post(
            f"/api/trips/planner/{trip_id}/places", json={"name": "A", "day_id": day_id}
        ).get_json()["place"]
        p2 = auth_client.post(
            f"/api/trips/planner/{trip_id}/places", json={"name": "B", "day_id": day_id}
        ).get_json()["place"]

        res = auth_client.put(
            f"/api/trips/planner/{trip_id}/places/reorder",
            json={
                "order": [
                    {"id": p2["id"], "day_id": day_id, "position": 1},
                    {"id": p1["id"], "day_id": day_id, "position": 2},
                ]
            },
        )
        assert res.status_code == 200


# ═══════════════════════════════════════════════════════════
# Companions
# ═══════════════════════════════════════════════════════════


class TestCompanions:
    def test_add_companion(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.post(
            f"/api/trips/planner/{trip_id}/companions",
            json={
                "name": "Alice",
                "email": "alice@example.com",
                "role": "traveler",
            },
        )
        assert res.status_code == 201
        comp = res.get_json()["companion"]
        assert comp["name"] == "Alice"
        assert comp["avatar_color"] is not None

    def test_add_companion_missing_name(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.post(
            f"/api/trips/planner/{trip_id}/companions", json={"email": "x@y.com"}
        )
        assert res.status_code == 400

    def test_add_companion_trip_not_found(self, auth_client):
        res = auth_client.post(
            "/api/trips/planner/9999/companions", json={"name": "Bob"}
        )
        assert res.status_code == 404

    def test_remove_companion(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        add_res = auth_client.post(
            f"/api/trips/planner/{trip_id}/companions", json={"name": "Alice"}
        )
        comp_id = add_res.get_json()["companion"]["id"]
        res = auth_client.delete(f"/api/trips/planner/{trip_id}/companions/{comp_id}")
        assert res.status_code == 200

    def test_remove_companion_not_found(self, auth_client):
        _create_trip(auth_client)
        trip_id = _get_trip_id(auth_client)
        res = auth_client.delete(f"/api/trips/planner/{trip_id}/companions/9999")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Ownership isolation
# ═══════════════════════════════════════════════════════════


class TestTripPlannerOwnership:
    def test_cannot_view_other_users_trip(self, app, client):
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "a@example.com", "password": "password123"},
        )
        _create_trip(client)
        trip_id = _get_trip_id(client)
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "b@example.com", "password": "password123"},
        )
        res = client.get(f"/api/trips/planner/{trip_id}")
        assert res.status_code == 404

    def test_cannot_delete_other_users_trip(self, app, client):
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "a@example.com", "password": "password123"},
        )
        _create_trip(client)
        trip_id = _get_trip_id(client)
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "b@example.com", "password": "password123"},
        )
        res = client.delete(f"/api/trips/planner/{trip_id}")
        assert res.status_code == 404
