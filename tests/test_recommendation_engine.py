"""
Tests for the deterministic recommendation engine and learned-prior blending.
"""

from datetime import datetime

import pytest

from app.services.recommendation_engine import (
    Destination,
    FeatureEngineer,
    RankingEngine,
    RecommendationContext,
    RecommendationResult,
    ScoreBreakdown,
    ScoringEngine,
    Season,
    TravelStyle,
    UserPreferences,
    UserProfile,
)


class _FakePriors:
    """In-memory stand-in for app.services.learned_prior.LearnedPriors."""

    def __init__(self, quality=None, popularity=None):
        self._quality = quality
        self._popularity = popularity

    def quality(self, name):
        return self._quality

    def popularity(self, name):
        return self._popularity


def make_destination(**overrides):
    fields = dict(
        id="goa",
        name="Goa",
        country="India",
        region="West",
        categories=[TravelStyle.BEACH, TravelStyle.NATURE],
        activities=["swimming", "boating"],
        rating=4.5,
        review_count=1200,
        booking_count=8000,
        avg_daily_cost=250.0,
        safety_score=0.8,
        infrastructure_score=0.7,
        accessibility_score=0.6,
        trending_score=0.5,
        social_score=0.6,
        current_season_score=0.9,
        peak_season=Season.WINTER,
        off_peak_season=Season.MONSOON,
    )
    fields.update(overrides)
    return Destination(**fields)


def make_user(**overrides):
    prefs = UserPreferences(
        travel_styles=[TravelStyle.BEACH, TravelStyle.NATURE],
        budget_range=(100, 500),
        price_sensitivity=0.5,
        style_affinity={"beach": 0.9, "nature": 0.7},
        activity_affinity={"water sports": 0.8},
    )
    fields = dict(
        id="u1",
        preferences=prefs,
        last_active=datetime(2026, 1, 1),
    )
    fields.update(overrides)
    return UserProfile(**fields)


class TestFeatureEngineerPopularity:
    def test_pure_heuristic_without_priors(self):
        dest = make_destination(rating=4.5, review_count=1200, booking_count=8000)
        score = FeatureEngineer.calculate_popularity(dest)
        assert 0.0 <= score <= 1.0
        assert score == pytest.approx(FeatureEngineer.calculate_popularity(dest))

    def test_blends_learned_prior(self):
        dest = make_destination()
        learned = _FakePriors(popularity=0.9)
        blended = FeatureEngineer.calculate_popularity(dest, learned)
        heuristic = FeatureEngineer.calculate_popularity(dest)
        expected = round(0.6 * 0.9 + 0.4 * heuristic, 4)
        assert blended == pytest.approx(expected)
        assert blended > heuristic  # learned prior is higher than heuristic

    def test_learned_prior_none_keeps_heuristic(self):
        dest = make_destination()
        learned = _FakePriors(popularity=None)
        assert FeatureEngineer.calculate_popularity(dest, learned) == pytest.approx(
            FeatureEngineer.calculate_popularity(dest)
        )


class TestFeatureEngineerQuality:
    def test_blends_learned_rating_prior(self):
        dest = make_destination()
        learned = _FakePriors(quality=5.0)
        blended, factors = FeatureEngineer.calculate_quality(dest, learned)
        heuristic, _ = FeatureEngineer.calculate_quality(dest)
        expected = 0.6 * (5.0 / 5.0) + 0.4 * heuristic
        assert blended == pytest.approx(expected)
        assert any("data-driven" in f for f in factors)

    def test_priors_absent_factors_unchanged(self):
        dest = make_destination(rating=4.6)
        _, factors = FeatureEngineer.calculate_quality(dest, None)
        assert any("Highly rated" in f for f in factors)
        assert not any("data-driven" in f for f in factors)


class TestScoringEngine:
    def test_valid_weights_required(self):
        with pytest.raises(ValueError):
            ScoringEngine(weights={"preference_match": 0.5})  # sums to 0.5

    def test_score_within_bounds(self):
        engine = ScoringEngine(priors=_FakePriors(quality=4.8, popularity=0.85))
        dest = make_destination()
        score, breakdown = engine.calculate_score(
            dest, make_user(), RecommendationContext()
        )
        assert 0 <= score <= 100
        assert isinstance(breakdown, ScoreBreakdown)

    def test_deterministic(self):
        dest = make_destination()
        user = make_user()
        ctx = RecommendationContext()
        s1, _ = ScoringEngine().calculate_score(dest, user, ctx)
        s2, _ = ScoringEngine().calculate_score(dest, user, ctx)
        assert s1 == s2

    def test_priors_raise_popularity_component(self):
        dest = make_destination()
        user = make_user()
        ctx = RecommendationContext()
        plain = ScoringEngine().calculate_score(dest, user, ctx)
        boosted = ScoringEngine(
            priors=_FakePriors(quality=5.0, popularity=1.0)
        ).calculate_score(dest, user, ctx)
        assert boosted[1].popularity >= plain[1].popularity
        assert boosted[1].quality >= plain[1].quality


class TestRankingEngine:
    def test_ranks_and_filters_by_min_score(self):
        engine = RankingEngine(ScoringEngine(), min_score=0.0)
        dests = [
            make_destination(id="a", name="A", categories=[TravelStyle.BEACH]),
            make_destination(id="b", name="B", categories=[TravelStyle.CULTURAL]),
            make_destination(id="c", name="C", categories=[TravelStyle.BEACH]),
        ]
        results = engine.rank(dests, make_user(), RecommendationContext())
        assert isinstance(results, list)
        assert all(isinstance(r, RecommendationResult) for r in results)
        assert len(results) <= 3
        # Sorted by score descending
        scores = [r.score for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_diversity_limits_same_category(self):
        engine = RankingEngine(ScoringEngine(), min_score=0.0, max_same_category=1)
        dests = (
            [
                make_destination(
                    id=f"b{i}", name=f"B{i}", categories=[TravelStyle.BEACH]
                )
                for i in range(2)
            ]
            + [
                make_destination(
                    id=f"n{i}", name=f"N{i}", categories=[TravelStyle.NATURE]
                )
                for i in range(2)
            ]
            + [
                make_destination(
                    id=f"c{i}", name=f"C{i}", categories=[TravelStyle.CULTURAL]
                )
                for i in range(2)
            ]
        )
        results = engine.rank(dests, make_user(), RecommendationContext())
        categories = [
            r.destination.categories[0].value
            for r in results
            if r.destination.categories
        ]
        assert len(categories) == len(results)
        # With max_same_category=1, a category may run at most twice in a row
        # (worst case: trailing same-category items get appended after a reset)
        max_run = 0
        current = 0
        for i in range(len(categories)):
            if i > 0 and categories[i] == categories[i - 1]:
                current += 1
            else:
                current = 1
            max_run = max(max_run, current)
        assert max_run <= 2
