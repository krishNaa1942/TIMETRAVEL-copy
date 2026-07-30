"""
Tests for Travel Stats API
=============================
GET /api/stats – Get comprehensive travel statistics (auth required)
"""

import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, Trip, TripPlace, Expense, Favorite

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
# Auth check
# ═══════════════════════════════════════════════════════════


class TestStatsUnauth:
    def test_stats_unauth(self, client):
        res = client.get("/api/stats")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# Stats – empty state
# ═══════════════════════════════════════════════════════════


class TestStatsEmpty:
    def test_stats_empty_user(self, auth_client):
        res = auth_client.get("/api/stats")
        assert res.status_code == 200
        data = res.get_json()["stats"]
        assert data["trips"]["total"] == 0
        assert data["total_spent"] == 0
        assert data["places_visited"] == 0
        assert data["photos_uploaded"] == 0


# ═══════════════════════════════════════════════════════════
# Stats – with data
# ═══════════════════════════════════════════════════════════


class TestStatsWithData:
    def test_stats_counts(self, app, auth_client):
        """Create trips, expenses, favorites and verify stats."""
        with app.app_context():
            user = User.query.filter_by(email="test@example.com").first()
            uid = user.id

            # Create trips
            t1 = Trip(
                user_id=uid,
                title="Goa Trip",
                destination="Goa",
                num_days=3,
                status="completed",
            )
            t2 = Trip(
                user_id=uid,
                title="Delhi Trip",
                destination="Delhi",
                num_days=5,
                status="planning",
            )
            _db.session.add_all([t1, t2])
            _db.session.flush()

            # Add a place
            place = TripPlace(trip_id=t1.id, name="Baga Beach", category="beach")
            _db.session.add(place)

            # Add expenses
            e1 = Expense(
                user_id=uid,
                destination="Goa",
                category="food",
                description="Lunch",
                amount=500,
            )
            e2 = Expense(
                user_id=uid,
                destination="Goa",
                category="transport",
                description="Taxi",
                amount=300,
            )
            _db.session.add_all([e1, e2])

            # Add favorites
            f1 = Favorite(user_id=uid, item_type="destination", item_name="Goa")
            _db.session.add(f1)

            _db.session.commit()

        res = auth_client.get("/api/stats")
        assert res.status_code == 200
        data = res.get_json()["stats"]
        assert data["trips"]["total"] == 2
        assert data["trips"]["completed"] == 1
        assert data["trips"]["planning"] == 1
        assert data["destinations_visited"] == 2
        assert data["places_visited"] == 1
        assert data["total_travel_days"] == 8
        assert data["total_spent"] == 800.0
        assert data["favorites_count"] == 1
        assert len(data["spending_breakdown"]) == 2
        assert data["spending_breakdown"]["food"] == 500.0
        assert data["spending_breakdown"]["transport"] == 300.0

    def test_stats_top_destinations(self, app, auth_client):
        with app.app_context():
            user = User.query.filter_by(email="test@example.com").first()
            uid = user.id
            for i in range(3):
                _db.session.add(
                    Trip(
                        user_id=uid,
                        title=f"Goa {i}",
                        destination="Goa",
                        num_days=3,
                        status="completed",
                    )
                )
            _db.session.add(
                Trip(
                    user_id=uid,
                    title="Delhi",
                    destination="Delhi",
                    num_days=5,
                    status="completed",
                )
            )
            _db.session.commit()

        res = auth_client.get("/api/stats")
        data = res.get_json()["stats"]
        assert len(data["top_destinations"]) >= 1
        # Goa should be first (3 trips vs Delhi's 1)
        assert data["top_destinations"][0]["destination"] == "Goa"


# ═══════════════════════════════════════════════════════════
# Stats – isolation
# ═══════════════════════════════════════════════════════════


class TestStatsIsolation:
    def test_stats_only_show_own_data(self, app, client):
        """User B should not see User A's stats."""
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()
            t = Trip(
                user_id=user_a.id,
                title="A Trip",
                destination="Goa",
                num_days=3,
                status="completed",
            )
            _db.session.add(t)
            _db.session.commit()

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "b@example.com", "password": "password123"},
        )
        res = client.get("/api/stats")
        assert res.status_code == 200
        data = res.get_json()["stats"]
        assert data["trips"]["total"] == 0
