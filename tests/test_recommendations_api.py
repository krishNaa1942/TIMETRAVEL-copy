"""
Tests for the Recommendations API (Phase 10: engine exposure)
==============================================================
GET /api/recommendations – auth, param validation, pagination,
service integration, and graceful failure.
"""

from unittest.mock import patch

import pytest

from app.services.ai_recommendations import (
    AIRecommendationService,
    RecommendationContext,
)


@pytest.fixture()
def auth(client):
    """Register and login a test user, returning the authenticated client."""
    client.post(
        "/api/auth/register",
        json={"name": "Tester", "email": "test@example.com", "password": "Test1234!"},
    )
    return client


def _sample_rec(**overrides):
    item = {
        "id": "d1",
        "name": "Manali",
        "country": "India",
        "rating": 4.5,
        "score": 0.87,
        "score_breakdown": {"preference_match": 0.9, "seasonality": 0.8},
        "reason": "Matches your travel preferences perfectly",
        "highlights": ["Himalayan views"],
        "avg_daily_cost": 2500.0,
        "categories": ["adventure"],
    }
    item.update(overrides)
    return item


class TestRecommendationsEndpoint:
    def test_requires_auth(self, app):
        # Fresh client (no session cookies) must be rejected.
        fresh = app.test_client()
        resp = fresh.get("/api/recommendations")
        assert resp.status_code == 401

    def test_returns_recommendations_for_authed_user(self, auth):
        with patch("app.api.routes.recommendations.recommendation_service") as svc:
            svc.get_recommendations.return_value = [
                _sample_rec(),
                _sample_rec(id="d2", name="Goa", rating=4.2, score=0.72),
            ]
            resp = auth.get("/api/recommendations?group_size=2&budget_max=5000")

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] == 2
        assert len(data["recommendations"]) == 2
        assert data["context"]["group_size"] == 2
        assert data["context"]["budget_max"] == 5000.0
        assert "generated_at" in data

        first = data["recommendations"][0]
        assert first["id"] == "d1"
        assert first["name"] == "Manali"
        assert first["country"] == "India"
        assert first["region"] == "India"
        assert first["rating"] == 4.5
        assert first["score"] == pytest.approx(87.0)
        assert first["explanations"] == ["Matches your travel preferences perfectly"]
        assert first["tags"] == ["Himalayan views"]
        assert first["avg_daily_cost"] == 2500.0
        assert first["categories"] == ["adventure"]

    def test_passes_context_to_service(self, auth):
        with patch("app.api.routes.recommendations.recommendation_service") as svc:
            svc.get_recommendations.return_value = [_sample_rec()]
            auth.get("/api/recommendations?season=summer&group_size=4&budget_max=3000")

        _, kwargs = svc.get_recommendations.call_args
        context = kwargs["context"]
        assert isinstance(context, RecommendationContext)
        assert context.season == "summer"
        assert context.group_size == 4
        assert context.budget_max == 3000.0

    def test_paginates_locally(self, auth):
        recs = [_sample_rec(id=f"d{i}") for i in range(6)]
        with patch("app.api.routes.recommendations.recommendation_service") as svc:
            svc.get_recommendations.return_value = recs
            resp = auth.get("/api/recommendations?limit=2&offset=1")

        data = resp.get_json()
        assert data["total"] == 6
        assert [r["id"] for r in data["recommendations"]] == ["d1", "d2"]
        assert len(data["recommendations"]) == 2

    def test_graceful_empty_results(self, auth):
        with patch("app.api.routes.recommendations.recommendation_service") as svc:
            svc.get_recommendations.return_value = []
            resp = auth.get("/api/recommendations")

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["recommendations"] == []
        assert data["total"] == 0

    def test_service_exception_returns_500(self, auth):
        with patch("app.api.routes.recommendations.recommendation_service") as svc:
            svc.get_recommendations.side_effect = RuntimeError("boom")
            resp = auth.get("/api/recommendations")

        assert resp.status_code == 500
        assert "error" in resp.get_json()

    def test_invalid_season_returns_400(self, auth):
        resp = auth.get("/api/recommendations?season=festive")
        assert resp.status_code == 400

    def test_invalid_group_size_returns_400(self, auth):
        resp = auth.get("/api/recommendations?group_size=0")
        assert resp.status_code == 400

    def test_invalid_limit_returns_400(self, auth):
        resp = auth.get("/api/recommendations?limit=500")
        assert resp.status_code == 400

    def test_invalid_budget_returns_400(self, auth):
        resp = auth.get("/api/recommendations?budget_max=-5")
        assert resp.status_code == 400


class TestServiceSeasonality:
    """Season label now feeds the seasonality score factor."""

    def test_season_affects_seasonality_score(self):
        svc = AIRecommendationService(learned=None)
        from app.services.ai_recommendations import Destination

        dest = Destination(
            id="d1",
            name="Goa",
            country="India",
            rating=4.4,
            booking_count=100,
            categories=["beach"],
            climate="tropical",
            avg_cost=200.0,
            seasonality_score=0.8,
            activities=[],
            cuisine_types=[],
        )
        summer = RecommendationContext(season="summer")
        monsoon = RecommendationContext(season="monsoon")

        assert svc._calculate_seasonality(dest, summer) == pytest.approx(0.8)
        assert svc._calculate_seasonality(dest, monsoon) == pytest.approx(0.56)

    def test_no_season_uses_default_seasonality(self):
        svc = AIRecommendationService(learned=None)
        from app.services.ai_recommendations import Destination

        dest = Destination(
            id="d1",
            name="Goa",
            country="India",
            rating=4.4,
            booking_count=100,
            categories=["beach"],
            climate="tropical",
            avg_cost=200.0,
            seasonality_score=0.8,
            activities=[],
            cuisine_types=[],
        )
        score = svc._calculate_seasonality(dest, RecommendationContext())
        assert score == pytest.approx(0.8)
