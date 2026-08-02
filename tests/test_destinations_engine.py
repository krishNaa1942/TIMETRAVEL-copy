"""Tests for destination-aware responses (Phase 8)."""

import random

from app.chatbot.engine import chat, get_response


class TestGetResponseWithDestination:
    def test_destination_variant_used(self):
        reply = get_response("food_dining", "Goa")
        assert "Goa" in reply
        assert "tell me your destination" not in reply

    def test_destination_variant_lowercase_name(self):
        reply = get_response("transport", "Munnar")
        assert "Munnar" in reply

    def test_generic_response_without_destination(self):
        reply = get_response("food_dining")
        assert "destination" in reply
        assert "{name}" not in reply

    def test_fallback_intent_ignores_destination(self):
        reply = get_response("fallback", "Goa")
        assert "{name}" not in reply

    def test_missing_destination_variant_falls_back_to_generic(self, monkeypatch):
        monkeypatch.setattr("app.chatbot.engine.DESTINATION_RESPONSES", {})
        reply = get_response("greeting", "Goa")
        assert "Goa" not in reply


class TestChatReturnsDestination:
    def test_destination_extracted(self):
        random.seed(1)
        reply, intent, confidence, destination = chat("is it safe to travel to Delhi?")
        assert destination == "Delhi"
        assert intent == "safety"
        assert "Delhi" in reply

    def test_no_destination(self):
        random.seed(1)
        _reply, intent, _conf, destination = chat("hello")
        assert intent == "greeting"
        assert destination is None
