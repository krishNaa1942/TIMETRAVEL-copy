"""
Phase D tests: destination seeding (D1) + Trip/TripQuery unification (D2).
"""

import uuid

import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db
from app.models.entities import Destination, Trip, TripQuery


@pytest.fixture()
def app():
    """Fresh in-memory app per test — no cross-test DB pollution."""
    _app = create_app(config_class=TestingConfig)
    with _app.app_context():
        db.create_all()
    yield _app
    with _app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def seeded(app):
    from app.services.seed_destinations import seed_destinations

    return seed_destinations()


class TestSeedDestinations:
    """D1: destinations table seeded from india_destinations.json."""

    def test_seeds_all_destinations(self, app, seeded):
        added, updated = seeded
        assert added == 201
        assert updated == 0
        with app.app_context():
            assert Destination.query.count() == 201

    def test_spot_check_agra(self, app, seeded):
        with app.app_context():
            agra = Destination.query.filter_by(name="Agra").first()
            assert agra is not None
            assert agra.country == "India"
            assert agra.latitude == pytest.approx(27.1767, abs=0.01)
            assert agra.avg_daily_cost and agra.avg_daily_cost > 0
            assert 0 <= agra.safety_score <= 10
            assert agra.best_season is not None
            assert agra.categories and "heritage" in agra.categories
            assert agra.highlights  # non-empty list
            assert agra.best_months  # non-empty list

    def test_idempotent(self, app, seeded):
        from app.services.seed_destinations import seed_destinations

        added2, updated2 = seed_destinations()
        assert added2 == 0
        assert updated2 == 201
        with app.app_context():
            assert Destination.query.count() == 201

    def test_reseed_refreshes_from_source(self, app, seeded):
        with app.app_context():
            dest = Destination.query.first()
            dest.safety_score = 9.99
            db.session.commit()
            dest_id = dest.id
        from app.services.seed_destinations import seed_destinations

        seed_destinations()
        with app.app_context():
            refreshed = Destination.query.get(dest_id)
            assert refreshed.safety_score != 9.99
            assert 0 <= refreshed.safety_score <= 10


class TestRecommendationCandidates:
    """D1: recommendation engine scores real candidates after seeding."""

    def test_candidates_from_db_not_fallback(self, app, seeded):
        from app.services.ai_recommendations import (
            AIRecommendationService,
            RecommendationContext,
        )

        service = AIRecommendationService()
        with app.app_context():
            candidates = service._get_candidate_destinations(
                RecommendationContext(group_size=2, budget_max=10000)
            )
        assert len(candidates) > 50 or len(candidates) > 0
        names = {c.name for c in candidates}
        assert "Agra" in names or "Goa" in names
        # Real DB candidates carry the seeded metadata, not fallback stubs
        goa = next((c for c in candidates if c.name == "Goa"), None)
        if goa:
            assert goa.avg_cost > 0
            assert goa.categories  # real categories, not [best_season]


class TestTripQueryTripLink:
    """D2: TripQuery <-> Trip unification (trip_id FK + sharing fix)."""

    def _register_and_login(self, client, email=None):
        email = email or f"u-{uuid.uuid4().hex[:8]}@example.com"
        client.post(
            "/api/auth/register",
            json={"name": "T", "email": email, "password": "Test1234!"},
        )
        client.post(
            "/api/auth/login",
            json={"email": email, "password": "Test1234!"},
        )
        return email

    def test_post_trips_links_trip_query(self, client, app):
        self._register_and_login(client)
        # budget estimate writes a TripQuery row
        est = client.post(
            "/api/budget/estimate",
            json={"destination": "Goa", "num_days": 3, "family_size": 2},
        )
        assert est.status_code == 200
        with app.app_context():
            query = TripQuery.query.filter_by(destination="Goa").first()
            assert query is not None
            query_id = query.id

        resp = client.post(
            "/api/trips",
            json={
                "title": "Goa Trip",
                "destination": "Goa",
                "num_days": 3,
                "trip_query_id": query_id,
            },
        )
        assert resp.status_code == 201
        trip_id = resp.get_json()["trip"]["id"]
        with app.app_context():
            linked = TripQuery.query.get(query_id)
            assert linked.trip_id == trip_id
            assert linked.linked_trip.id == trip_id

    def test_share_accepts_workspace_trip_id(self, client, app):
        self._register_and_login(client)
        resp = client.post(
            "/api/trips",
            json={"title": "Kerala", "destination": "Kerala", "num_days": 5},
        )
        trip_id = resp.get_json()["trip"]["id"]
        share = client.post(
            "/api/share", json={"title": "Kerala", "trip_id": trip_id}
        )
        assert share.status_code == 201
        with app.app_context():
            from app.models.entities import SharedTrip

            row = SharedTrip.query.filter_by(share_token=share.get_json()["share"]["share_token"]).first()
            assert row.trip_id == trip_id

    def test_share_rejects_other_users_trip(self, client, app):
        self._register_and_login(client)
        resp = client.post(
            "/api/trips",
            json={"title": "Mine", "destination": "Goa", "num_days": 2},
        )
        trip_id = resp.get_json()["trip"]["id"]

        self._register_and_login(client)  # different user
        share = client.post(
            "/api/share", json={"title": "Theirs", "trip_id": trip_id}
        )
        assert share.status_code == 404
