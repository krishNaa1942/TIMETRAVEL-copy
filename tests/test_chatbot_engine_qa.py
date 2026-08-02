"""
Tests for the chatbot engine's learned-QA intent tier — the handcrafted
pipeline stays authoritative for its own intents; low-confidence messages
can be rescued by the offline QA classifier.
"""

import numpy as np
import pytest

from app.chatbot import engine as engine_module
from app.chatbot.engine import QA_INTENT_MAP, classify_intent

HIGH_CONF = 0.9
LOW_CONF = 0.2


class _FakeLearned:
    def __init__(self, result):
        self._result = result

    def intent(self, query):
        return self._result


class TestQaIntentMap:
    @pytest.mark.parametrize(
        "coarse,expected",
        [
            ("TTD", "destination_info"),
            ("TGU", "destination_info"),
            ("TRS", "transport"),
            ("ACM", "accommodation"),
            ("FOD", "food_dining"),
            ("ENT", "entertainment"),
            ("WTH", "weather"),
        ],
    )
    def test_coarse_intents_map_to_responses(self, coarse, expected):
        assert QA_INTENT_MAP[coarse] == expected


class TestClassifyIntentWithLearnedTier:
    @pytest.fixture(autouse=True)
    def patch_pipeline(self, monkeypatch):
        monkeypatch.setattr(
            engine_module,
            "_get_pipeline",
            lambda: _StubHandcrafted(HIGH_CONF, "destination_info"),
        )
        monkeypatch.setattr(engine_module, "CONFIDENCE_THRESHOLD", 0.35)

    def test_high_confidence_handcrafted_wins(self, monkeypatch):
        monkeypatch.setattr(
            engine_module,
            "_classify_learned_qa",
            lambda m: ("transport", 0.9),
        )
        intent, conf = classify_intent("hello")
        assert intent == "destination_info"
        assert conf == pytest.approx(0.9)

    def test_low_confidence_handcrafted_uses_learned(self, monkeypatch):
        monkeypatch.setattr(
            engine_module,
            "_get_pipeline",
            lambda: _StubHandcrafted(LOW_CONF, "destination_info"),
        )
        monkeypatch.setattr(
            engine_module,
            "_classify_learned_qa",
            lambda m: ("transport", 0.9),
        )
        intent, conf = classify_intent("how do I travel to jaipur")
        assert intent == "transport"
        assert conf == pytest.approx(0.9)

    def test_low_confidence_both_fallback(self, monkeypatch):
        monkeypatch.setattr(
            engine_module,
            "_get_pipeline",
            lambda: _StubHandcrafted(LOW_CONF, "destination_info"),
        )
        monkeypatch.setattr(
            engine_module,
            "_classify_learned_qa",
            lambda m: ("fallback", 0.0),
        )
        intent, conf = classify_intent("zzzz nonsense")
        assert intent == "fallback"
        assert conf == 0.0


class TestClassifyLearnedQa:
    def test_high_confidence_mapped(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.learned_prior.LearnedPriors.intent",
            lambda self, q: ("FOD", 0.8),
        )
        intent, conf = engine_module._classify_learned_qa("food places near me")
        assert intent == "food_dining"
        assert conf == pytest.approx(0.8)

    def test_low_confidence_rejected(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.learned_prior.LearnedPriors.intent",
            lambda self, q: ("FOD", 0.4),
        )
        intent, conf = engine_module._classify_learned_qa("food places near me")
        assert intent == "fallback"
        assert conf == 0.0

    def test_unmapped_coarse_rejected(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.learned_prior.LearnedPriors.intent",
            lambda self, q: ("UNKNOWN", 0.9),
        )
        intent, conf = engine_module._classify_learned_qa("random question")
        assert intent == "fallback"

    def test_learned_unavailable_falls_back(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.learned_prior.LearnedPriors.intent",
            lambda self, q: (_ for _ in ()).throw(RuntimeError("no models")),
        )
        intent, conf = engine_module._classify_learned_qa("anything")
        assert intent == "fallback"
        assert conf == 0.0


class _StubHandcrafted:
    def __init__(self, confidence, intent):
        self._confidence = confidence
        self._intent = intent

    def predict_proba(self, texts):
        return np.array([[self._confidence, min(self._confidence * 0.5, 0.9)]])

    @property
    def classes_(self):
        return [self._intent, "other"]
