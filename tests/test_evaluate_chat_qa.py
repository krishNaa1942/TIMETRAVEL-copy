"""Tests for scripts/evaluate_chat_qa.py (Phase 6 chat QA gate)."""

import pytest

from scripts.evaluate_chat_qa import (
    build_qa_pairs,
    chat_qa_report,
    check_gates,
)


class TestBuildQaPairs:
    def test_all_coarse_intents_mapped(self):
        questions = ["a", "b", "c"]
        coarse = ["TTD", "TRS", "WTH"]
        pairs = build_qa_pairs(questions, coarse, {"TTD": "destination_info"})
        assert len(pairs) == 1
        assert pairs[0] == ("a", "destination_info")

    def test_unmapped_coarse_dropped(self):
        pairs = build_qa_pairs(
            ["x"],
            ["SAFETY"],
            {"TTD": "destination_info"},
        )
        assert pairs == []

    def test_preserves_question_order(self):
        questions = ["q1", "q2", "q3"]
        coarse = ["ACM", "ENT", "FOD"]
        intent_map = {
            "ACM": "accommodation",
            "ENT": "entertainment",
            "FOD": "food_dining",
        }
        pairs = build_qa_pairs(questions, coarse, intent_map)
        assert pairs == [
            ("q1", "accommodation"),
            ("q2", "entertainment"),
            ("q3", "food_dining"),
        ]


class TestChatQaReport:
    def test_accuracy_and_fallback_rate(self):
        def classifier(q):
            if q == "perfect":
                return ("destination_info", 0.9)
            if q == "unknown":
                return ("fallback", 0.0)
            return ("transport", 0.7)

        report = chat_qa_report(
            classifier,
            ["perfect", "wrong", "unknown", "perfect"],
            ["destination_info", "transport", "transport", "transport"],
        )
        assert report["questions"] == 4
        assert report["chat_intent_accuracy"] == 0.5
        assert report["fallback_rate"] == 0.25

    def test_per_intent_recall(self):
        def classifier(_q):
            return ("food_dining", 0.8)

        report = chat_qa_report(
            classifier,
            ["a", "b", "c", "d"],
            ["food_dining", "food_dining", "weather", "weather"],
        )
        assert report["per_intent_recall"] == {
            "food_dining": 1.0,
            "weather": 0.0,
        }

    def test_mismatched_lengths_rejected(self):
        with pytest.raises(ValueError):
            chat_qa_report(lambda q: ("a", 0.5), ["a"], ["a", "b"])

    def test_empty_input(self):
        report = chat_qa_report(lambda q: ("a", 0.5), [], [])
        assert report["chat_intent_accuracy"] == 0.0
        assert report["fallback_rate"] == 0.0


class TestCheckGates:
    def test_higher_is_better(self):
        failures = check_gates(
            {"chat_intent_accuracy": 0.79}, {"chat_intent_accuracy": 0.80}
        )
        assert len(failures) == 1
        assert "chat_intent_accuracy" in failures[0]

    def test_fallback_rate_is_lower_better(self):
        failures = check_gates({"fallback_rate": 0.81}, {"fallback_rate": 0.80})
        assert len(failures) == 1

    def test_all_pass(self):
        metrics = {"chat_intent_accuracy": 0.85, "fallback_rate": 0.10}
        gates = {"chat_intent_accuracy": 0.80, "fallback_rate": 0.80}
        assert check_gates(metrics, gates) == []
