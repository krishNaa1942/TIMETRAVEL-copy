"""
Tests for Trip History API (/api/trips)
=========================================
List, get, delete, create, update, and duplicate.
"""

import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, Trip


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
        user = User(name="Tester", email="trips-tester@example.com")
        user.set_password("password123")
        _db.session.add(user)
        _db.session.commit()
        client.post(
            "/api/auth/login",
            json={"email": "trips-tester@example.com", "password": "password123"},
        )
    return client


# ═══════════════════════════════════════════════════════════
# Unauthenticated access
# ═══════════════════════════════════════════════════════════


class TestTripsUnauth:
    def test_create_unauth(self, client):
        res = client.post("/api/trips", json={"title": "X", "destination": "Y"})
        assert res.status_code == 401

    def test_update_unauth(self, client):
        res = client.put("/api/trips/1", json={"title": "X"})
        assert res.status_code == 401

    def test_duplicate_unauth(self, client):
        res = client.post("/api/trips/1/duplicate")
        assert res.status_code == 401

    def test_list_unauth(self, client):
        res = client.get("/api/trips")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# Create
# ═══════════════════════════════════════════════════════════


class TestTripsCreate:
    def test_create_trip_success(self, auth_client):
        res = auth_client.post(
            "/api/trips",
            json={
                "title": "Goa Trip",
                "destination": "Goa",
                "num_days": 3,
                "family_size": 4,
                "travel_class": "comfort",
                "start_date": "2026-06-01",
                "end_date": "2026-06-03",
                "status": "planning",
                "budget_total": 50000,
                "notes": "Beach holiday",
            },
        )
        assert res.status_code == 201
        trip = res.get_json()["trip"]
        assert trip["title"] == "Goa Trip"
        assert trip["destination"] == "Goa"
        assert trip["num_days"] == 3
        assert trip["family_size"] == 4
        assert trip["start_date"] == "2026-06-01"
        assert trip["end_date"] == "2026-06-03"
        assert trip["budget_total"] == 50000
        assert trip["notes"] == "Beach holiday"
        assert len(trip.get("days", [])) == 3

    def test_create_comfort_class_normalized(self, auth_client):
        res = auth_client.post(
            "/api/trips",
            json={"title": "T", "destination": "D", "travel_class": "comfort"},
        )
        assert res.status_code == 201
        assert res.get_json()["trip"]["travel_class"] == "standard"

    def test_create_invalid_class_rejected(self, auth_client):
        res = auth_client.post(
            "/api/trips",
            json={"title": "T", "destination": "D", "travel_class": "helicopter"},
        )
        assert res.status_code == 400

    def test_create_invalid_status_rejected(self, auth_client):
        res = auth_client.post(
            "/api/trips", json={"title": "T", "destination": "D", "status": "paused"}
        )
        assert res.status_code == 400

    def test_create_missing_destination(self, auth_client):
        res = auth_client.post("/api/trips", json={"title": "T"})
        assert res.status_code == 400


# ═══════════════════════════════════════════════════════════
# Update
# ═══════════════════════════════════════════════════════════


class TestTripsUpdate:
    def _create(self, auth_client):
        res = auth_client.post(
            "/api/trips",
            json={"title": "Goa Trip", "destination": "Goa", "num_days": 2},
        )
        return res.get_json()["trip"]["id"]

    def test_update_trip(self, auth_client):
        trip_id = self._create(auth_client)
        res = auth_client.put(
            f"/api/trips/{trip_id}",
            json={"title": "Goa Revisited", "status": "active", "budget_total": 75000},
        )
        assert res.status_code == 200
        trip = res.get_json()["trip"]
        assert trip["title"] == "Goa Revisited"
        assert trip["status"] == "active"
        assert trip["budget_total"] == 75000

    def test_update_other_users_trip(self, app, auth_client):
        with app.app_context():
            other = User(name="Other", email="other-trips@example.com")
            other.set_password("password123")
            _db.session.add(other)
            _db.session.flush()
            trip = Trip(
                user_id=other.id,
                title="Theirs",
                destination="Mumbai",
                num_days=1,
                family_size=1,
                travel_class="economy",
            )
            _db.session.add(trip)
            _db.session.commit()
            trip_id = trip.id
        res = auth_client.put(f"/api/trips/{trip_id}", json={"title": "Hacked"})
        assert res.status_code == 404

    def test_update_missing_trip(self, auth_client):
        res = auth_client.put("/api/trips/99999", json={"title": "X"})
        assert res.status_code == 404

    def test_update_invalid_class(self, auth_client):
        trip_id = self._create(auth_client)
        res = auth_client.put(
            f"/api/trips/{trip_id}", json={"travel_class": "zeppelin"}
        )
        assert res.status_code == 400


# ═══════════════════════════════════════════════════════════
# Duplicate
# ═══════════════════════════════════════════════════════════


class TestTripsDuplicate:
    def test_duplicate_trip(self, auth_client):
        res = auth_client.post(
            "/api/trips",
            json={"title": "Goa Trip", "destination": "Goa", "num_days": 2},
        )
        original = res.get_json()["trip"]

        res = auth_client.post(f"/api/trips/{original['id']}/duplicate")
        assert res.status_code == 201
        copy = res.get_json()["trip"]
        assert copy["id"] != original["id"]
        assert copy["title"] == "Copy of Goa Trip"
        assert copy["destination"] == "Goa"
        assert copy["status"] == "planning"
        assert len(copy.get("days", [])) == 2

        # Only two trips now: original + copy
        res = auth_client.get("/api/trips/planner")
        assert len(res.get_json()["trips"]) == 2

    def test_duplicate_missing_trip(self, auth_client):
        res = auth_client.post("/api/trips/99999/duplicate")
        assert res.status_code == 404
