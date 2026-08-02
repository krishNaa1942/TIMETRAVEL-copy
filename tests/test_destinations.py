"""Tests for destination entity extraction (Phase 8)."""

from app.chatbot.destinations import extract_destination


class TestExtractDestination:
    def test_matches_known_destination(self):
        assert extract_destination("best restaurants in goa") == "Goa"

    def test_case_insensitive(self):
        assert extract_destination("Is it safe to travel to DELHI?") == "Delhi"

    def test_word_boundaries(self):
        assert extract_destination("agrarian concerns") is None
        assert extract_destination("goa") == "Goa"

    def test_unknown_place_returns_none(self):
        assert extract_destination("what to do in thekkady") is None

    def test_empty_message(self):
        assert extract_destination("") is None
        assert extract_destination("   ") is None

    def test_no_destination_message(self):
        assert extract_destination("hi there") is None

    def test_prefers_longest_match(self, monkeypatch):
        monkeypatch.setattr(
            "app.chatbot.destinations._lexicon",
            {"goa velha": "Goa Velha", "goa": "Goa"},
        )
        assert extract_destination("stay in goa velha") == "Goa Velha"
