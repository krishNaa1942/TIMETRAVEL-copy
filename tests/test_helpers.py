"""
Tests for app.utils.helpers
==============================
Unit tests for utility functions.
"""

from app.utils.helpers import (
    sanitise_destination,
    clamp,
    safe_float,
    safe_int,
    truncate,
)

# ── sanitise_destination ───────────────────────────────────────────────


class TestSanitiseDestination:
    def test_strips_whitespace(self):
        assert sanitise_destination("  goa  ") == "Goa"

    def test_title_cases(self):
        assert sanitise_destination("new delhi") == "New Delhi"

    def test_preserves_hyphens(self):
        assert sanitise_destination("new-delhi") == "New-Delhi"

    def test_removes_special_chars(self):
        assert sanitise_destination("goa!!!") == "Goa"
        assert sanitise_destination("j@ipur#") == "Jipur"

    def test_empty_string(self):
        assert sanitise_destination("") == ""

    def test_already_clean(self):
        assert sanitise_destination("Manali") == "Manali"


# ── clamp ──────────────────────────────────────────────────────────────


class TestClamp:
    def test_within_bounds(self):
        assert clamp(5, 0, 10) == 5

    def test_below_low(self):
        assert clamp(-5, 0, 10) == 0

    def test_above_high(self):
        assert clamp(15, 0, 10) == 10

    def test_at_boundaries(self):
        assert clamp(0, 0, 10) == 0
        assert clamp(10, 0, 10) == 10

    def test_negative_range(self):
        assert clamp(-5, -10, -1) == -5

    def test_float_values(self):
        assert clamp(3.7, 1.0, 5.0) == 3.7


# ── safe_float ─────────────────────────────────────────────────────────


class TestSafeFloat:
    def test_valid_string(self):
        assert safe_float("3.14") == 3.14

    def test_valid_int(self):
        assert safe_float(42) == 42.0

    def test_none_returns_default(self):
        assert safe_float(None) == 0.0

    def test_invalid_string(self):
        assert safe_float("abc") == 0.0

    def test_custom_default(self):
        assert safe_float("bad", default=-1.0) == -1.0

    def test_empty_string(self):
        assert safe_float("") == 0.0


# ── safe_int ───────────────────────────────────────────────────────────


class TestSafeInt:
    def test_valid_string(self):
        assert safe_int("42") == 42

    def test_valid_float(self):
        assert safe_int(3.9) == 3

    def test_none_returns_default(self):
        assert safe_int(None) == 0

    def test_invalid_string(self):
        assert safe_int("xyz") == 0

    def test_custom_default(self):
        assert safe_int(None, default=-1) == -1

    def test_empty_string(self):
        assert safe_int("") == 0


# ── truncate ───────────────────────────────────────────────────────────


class TestTruncate:
    def test_short_text_unchanged(self):
        assert truncate("hello", 200) == "hello"

    def test_exact_length(self):
        text = "a" * 200
        assert truncate(text, 200) == text

    def test_long_text_truncated(self):
        text = "a" * 300
        result = truncate(text, 200)
        assert len(result) == 200
        assert result.endswith("...")

    def test_custom_length(self):
        result = truncate("hello world", 8)
        assert result == "hello..."
        assert len(result) == 8

    def test_empty_string(self):
        assert truncate("", 10) == ""
