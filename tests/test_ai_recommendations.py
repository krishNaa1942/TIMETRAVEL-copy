"""
Tests for AIRecommendationService with the offline content-matcher prior.
"""

import pytest

from app.services.ai_recommendations import (
    AIRecommendationService,
    Destination,
    RecommendationContext,
    UserPreferences,
)


def make_dest(**overrides):
    fields = dict(
        id="d1",
        name="Baga Beach",
        country="India",
        rating=4.4,
        booking_count=3000,
        categories=["beach"],
        climate="tropical",
        avg_cost=250.0,
        seasonality_score=0.8,
        activities=["swimming", "water sports"],
        cuisine_types=["seafood"],
    )
    fields.update(overrides)
    return Destination(**fields)


def make_prefs(**overrides):
    prefs = UserPreferences(
        travel_style="adventure",
        budget_preference="moderate",
        climate_preference="tropical",
        activity_preferences=["water sports"],
    )
    return prefs


class _StubLearned:
    """LearnedPriors stand-in returning fixed content scores."""

    def __init__(self, content=0.8, available=True):
        self._content = content
        self._available = available

    def content_score(self, query, name):
        if not self._available:
            return None
        return self._content


class TestPreferenceMatchContentBlend:
    def test_service_accepts_injected_learned(self):
        svc = AIRecommendationService(learned=_StubLearned())
        assert svc.learned is not None

    def test_content_prior_pulls_score_toward_it(self):
        dest = make_dest()
        prefs = make_prefs()

        plain = AIRecommendationService(learned=_StubLearned(available=False))
        boosted = AIRecommendationService(learned=_StubLearned(content=1.0))

        low = plain._calculate_preference_match(prefs, dest)
        high = boosted._calculate_preference_match(prefs, dest)

        assert low >= 0.0
        assert high >= low  # max content similarity can only help
        assert 0.0 <= high <= 1.0

    def test_content_prior_degrades_when_unavailable(self):
        dest = make_dest()
        prefs = make_prefs()
        svc = AIRecommendationService(learned=_StubLearned(available=False))
        score = svc._calculate_preference_match(prefs, dest)
        assert 0.0 <= score <= 1.0
        # Identical feature-based scoring when the prior is missing
        again = AIRecommendationService(learned=None)._calculate_preference_match(
            prefs, dest
        )
        assert score == pytest.approx(again)

    def test_preferences_query_includes_style_activities(self):
        svc = AIRecommendationService(learned=None)
        query = svc._preferences_query(make_prefs())
        assert "adventure" in query
        assert "water sports" in query
        assert "tropical" in query
        assert "moderate" in query

    def test_end_to_end_calculate_score_available(self):
        svc = AIRecommendationService(learned=_StubLearned(content=0.7))
        dest = make_dest()
        score = svc._calculate_score(
            make_prefs(), dest, RecommendationContext(), "user-1"
        )
        assert 0.0 <= score <= 100.0
