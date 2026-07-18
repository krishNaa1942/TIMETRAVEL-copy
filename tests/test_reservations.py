"""
Tests for Reservations API
=============================
POST   /api/reservations                  – Add reservation
PUT    /api/reservations/<id>             – Update reservation
DELETE /api/reservations/<id>             – Delete reservation
GET    /api/reservations/trip/<trip_id>   – List reservations for trip
"""

import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, Trip, Reservation


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

        trip = Trip(
            user_id=user.id, title="Test Trip", destination="Goa",
            num_days=3, status="planning",
        )
        _db.session.add(trip)
        _db.session.commit()

        client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
    return client


def _get_trip_id(client):
    return client.get("/api/trips/planner").get_json()["trips"][0]["id"]


def _add_reservation(client, trip_id, **overrides):
    payload = {
        "trip_id": trip_id,
        "res_type": "hotel",
        "title": "Beach Resort",
        "provider": "Booking.com",
        "confirmation_code": "ABC123",
        "amount": 5000,
        "currency": "INR",
        "status": "confirmed",
    }
    payload.update(overrides)
    return client.post("/api/reservations", json=payload)


# ═══════════════════════════════════════════════════════════
# Unauthenticated access
# ═══════════════════════════════════════════════════════════

class TestReservationsUnauth:
    def test_add_reservation_unauth(self, client):
        res = client.post("/api/reservations", json={"trip_id": 1, "res_type": "hotel", "title": "X"})
        assert res.status_code == 401

    def test_update_reservation_unauth(self, client):
        res = client.put("/api/reservations/1", json={"title": "X"})
        assert res.status_code == 401

    def test_delete_reservation_unauth(self, client):
        res = client.delete("/api/reservations/1")
        assert res.status_code == 401

    def test_list_reservations_unauth(self, client):
        res = client.get("/api/reservations/trip/1")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════

class TestReservationsCRUD:
    def test_add_reservation_success(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        res = _add_reservation(auth_client, trip_id)
        assert res.status_code == 201
        data = res.get_json()["reservation"]
        assert data["title"] == "Beach Resort"
        assert data["res_type"] == "hotel"
        assert data["amount"] == 5000

    def test_add_reservation_missing_trip_id(self, auth_client):
        res = auth_client.post("/api/reservations", json={"res_type": "hotel", "title": "X"})
        assert res.status_code == 400

    def test_add_reservation_missing_type(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        res = auth_client.post("/api/reservations", json={"trip_id": trip_id, "title": "X"})
        assert res.status_code == 400

    def test_add_reservation_missing_title(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        res = auth_client.post("/api/reservations", json={"trip_id": trip_id, "res_type": "hotel"})
        assert res.status_code == 400

    def test_add_reservation_trip_not_found(self, auth_client):
        res = _add_reservation(auth_client, trip_id=9999)
        assert res.status_code == 404

    def test_list_reservations(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        _add_reservation(auth_client, trip_id)
        _add_reservation(auth_client, trip_id, title="Flight", res_type="flight")
        res = auth_client.get(f"/api/reservations/trip/{trip_id}")
        assert res.status_code == 200
        assert len(res.get_json()["reservations"]) == 2

    def test_list_reservations_trip_not_found(self, auth_client):
        res = auth_client.get("/api/reservations/trip/9999")
        assert res.status_code == 404

    def test_update_reservation(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        add_res = _add_reservation(auth_client, trip_id)
        res_id = add_res.get_json()["reservation"]["id"]
        res = auth_client.put(f"/api/reservations/{res_id}", json={
            "title": "Luxury Resort",
            "amount": 10000,
            "status": "pending",
        })
        assert res.status_code == 200
        data = res.get_json()["reservation"]
        assert data["title"] == "Luxury Resort"
        assert data["amount"] == 10000
        assert data["status"] == "pending"

    def test_update_reservation_not_found(self, auth_client):
        res = auth_client.put("/api/reservations/9999", json={"title": "X"})
        assert res.status_code == 404

    def test_delete_reservation(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        add_res = _add_reservation(auth_client, trip_id)
        res_id = add_res.get_json()["reservation"]["id"]
        res = auth_client.delete(f"/api/reservations/{res_id}")
        assert res.status_code == 200
        remaining = auth_client.get(f"/api/reservations/trip/{trip_id}").get_json()["reservations"]
        assert len(remaining) == 0

    def test_delete_reservation_not_found(self, auth_client):
        res = auth_client.delete("/api/reservations/9999")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Ownership isolation
# ═══════════════════════════════════════════════════════════

class TestReservationOwnership:
    def test_cannot_delete_other_users_reservation(self, app, client):
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()
            trip = Trip(user_id=user_a.id, title="A Trip", destination="Goa", num_days=3, status="planning")
            _db.session.add(trip)
            _db.session.commit()
            trip_id = trip.id

        client.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"})
        add_res = _add_reservation(client, trip_id)
        res_id = add_res.get_json()["reservation"]["id"]
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "b@example.com", "password": "password123"})
        res = client.delete(f"/api/reservations/{res_id}")
        assert res.status_code == 404
