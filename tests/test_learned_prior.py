"""
Tests for the offline learned-prior service (ML model runtime loader).
"""

import pytest

from app.services.learned_prior import LearnedPriors, blend_prior

LEARNED_WEIGHT = 0.6
HEURISTIC_WEIGHT = 1 - LEARNED_WEIGHT


class TestBlendPrior:
    def test_blend_mixes_learned_and_heuristic(self):
        blended = blend_prior(1.0, 0.0)
        assert blended == pytest.approx(LEARNED_WEIGHT)

    def test_blend_full_agreement(self):
        assert blend_prior(0.8, 0.8) == pytest.approx(0.8)

    def test_blend_clips_to_unit_interval(self):
        assert blend_prior(2.0, 0.0) == pytest.approx(1.0)

    def test_blend_none_keeps_heuristic(self):
        assert blend_prior(None, 0.8) == pytest.approx(0.8)


class TestLearnedPriorsFallback:
    """Degrades gracefully when no model artifacts exist."""

    def test_unavailable_when_no_models_dir(self, tmp_path):
        priors = LearnedPriors(model_dir=str(tmp_path))
        assert not priors.is_available

    def test_quality_falls_back_to_none(self, tmp_path):
        assert LearnedPriors(model_dir=str(tmp_path)).quality("Taj Mahal") is None

    def test_popularity_falls_back_to_none(self, tmp_path):
        assert LearnedPriors(model_dir=str(tmp_path)).popularity("Goa") is None

    def test_priors_tuple_falls_back(self, tmp_path):
        priors = LearnedPriors(model_dir=str(tmp_path))
        assert priors.priors("Goa") == (None, None)

    def test_content_similarity_falls_back_to_empty(self, tmp_path):
        priors = LearnedPriors(model_dir=str(tmp_path))
        assert priors.content_similarity("goa beach", top_k=5) == []

    def test_content_score_falls_back_to_none(self, tmp_path):
        priors = LearnedPriors(model_dir=str(tmp_path))
        assert priors.content_score("goa beach", "Baga Beach") is None

    def test_singleton_shared(self):
        assert LearnedPriors.get_instance() is LearnedPriors.get_instance()


class TestLearnedPriorsWithArtifacts:
    """End-to-end with real artifacts from scripts/train_models.py."""

    @pytest.fixture(scope="class")
    def priors(self):
        p = LearnedPriors()
        assert p.is_available, "run scripts/train_models.py first"
        return p

    def test_quality_returns_float_in_range(self, priors):
        q = priors.quality("Taj Mahal")
        assert isinstance(q, float)
        assert 0.0 <= q <= 5.0

    def test_popularity_returns_float_in_unit_range(self, priors):
        pop = priors.popularity("Goa")
        assert isinstance(pop, float)
        assert 0.0 <= pop <= 1.0

    def test_priors_tuple(self, priors):
        quality, popularity = priors.priors("Goa")
        assert isinstance(quality, float)
        assert isinstance(popularity, float)

    def test_content_similarity_top_k(self, priors):
        matches = priors.content_similarity("goa beach nightlife", top_k=5)
        assert isinstance(matches, list)
        assert 0 < len(matches) <= 5
        for name, score in matches:
            assert isinstance(name, str)
            assert isinstance(score, float)
        # Sorted best-first
        scores = [s for _, s in matches]
        assert scores == sorted(scores, reverse=True)

    def test_content_score_single(self, priors):
        score = priors.content_score("goa beach nightlife", "Baga Beach")
        assert isinstance(score, float)
        assert 0.0 <= score <= 1.0

    def test_content_score_unknown_destination(self, priors):
        assert priors.content_score("tropical island", "Nonexistent Place XYZ") is None

    def test_metadata_present(self, priors):
        meta = priors.metadata
        assert isinstance(meta, dict)
        assert "quality" in meta
        assert "popularity" in meta
        assert "content" in meta
