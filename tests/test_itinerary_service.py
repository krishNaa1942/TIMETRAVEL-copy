"""
Tests for the itinerary generator service.
"""

import json
from unittest.mock import patch, MagicMock

import pytest

from app.services.itinerary_service import generate_itinerary, _extract_json


# ---------------------------------------------------------------------------
# Tests for _extract_json helper
# ---------------------------------------------------------------------------
class TestExtractJson:
    def test_plain_json(self):
        text = '[{"day": 1, "title": "Arrival"}]'
        assert _extract_json(text) == [{"day": 1, "title": "Arrival"}]

    def test_json_with_code_fences(self):
        text = '```json\n[{"day": 1}]\n```'
        assert _extract_json(text) == [{"day": 1}]

    def test_json_with_plain_fences(self):
        text = '```\n[{"day": 1}]\n```'
        assert _extract_json(text) == [{"day": 1}]

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            _extract_json("not json at all")


# ---------------------------------------------------------------------------
# Tests for generate_itinerary
# ---------------------------------------------------------------------------
SAMPLE_DAY = {
    "day": 1,
    "title": "Arrival in Goa",
    "morning": {
        "activity": "Check-in",
        "description": "Hotel check-in",
        "duration": "1 hour",
        "cost": "₹0",
    },
    "afternoon": {
        "activity": "Beach",
        "description": "Visit Baga Beach",
        "duration": "3 hours",
        "cost": "₹500",
    },
    "evening": {
        "activity": "Dinner",
        "description": "Seafood at Britto's",
        "duration": "2 hours",
        "cost": "₹1500",
    },
    "tip": "Carry sunscreen",
}


class TestGenerateItinerary:
    @patch("app.services.itinerary_service._configured", False)
    @patch("app.services.itinerary_service._client", None)
    @patch("app.services.itinerary_service.genai")
    def test_successful_generation(self, mock_genai):
        mock_client = MagicMock()
        mock_genai.Client.return_value = mock_client
        mock_client.models.generate_content.return_value = MagicMock(
            text=json.dumps([SAMPLE_DAY]),
        )

        result = generate_itinerary("Goa", 1, 2, "comfort", "beaches", "fake-key")

        assert result["destination"] == "Goa"
        assert result["num_days"] == 1
        assert result["family_size"] == 2
        assert result["travel_class"] == "comfort"
        assert len(result["itinerary"]) == 1
        assert result["itinerary"][0]["day"] == 1

    @patch("app.services.itinerary_service._configured", False)
    @patch("app.services.itinerary_service._client", None)
    @patch("app.services.itinerary_service.genai")
    def test_json_parse_error(self, mock_genai):
        mock_client = MagicMock()
        mock_genai.Client.return_value = mock_client
        mock_client.models.generate_content.return_value = MagicMock(text="not json")

        result = generate_itinerary("Goa", 3, 2, "economy", "", "fake-key")

        assert "error" in result
        assert "invalid response" in result["error"]

    @patch("app.services.itinerary_service._configured", False)
    @patch("app.services.itinerary_service._client", None)
    @patch("app.services.itinerary_service.genai")
    def test_empty_itinerary(self, mock_genai):
        mock_client = MagicMock()
        mock_genai.Client.return_value = mock_client
        mock_client.models.generate_content.return_value = MagicMock(text="[]")

        result = generate_itinerary("Goa", 3, 2, "premium", "food", "fake-key")

        assert "error" in result
        assert "Could not generate" in result["error"]

    @patch("app.services.itinerary_service._configured", False)
    @patch("app.services.itinerary_service._client", None)
    @patch("app.services.itinerary_service.genai")
    def test_api_exception(self, mock_genai):
        mock_client = MagicMock()
        mock_genai.Client.return_value = mock_client
        mock_client.models.generate_content.side_effect = RuntimeError("API down")

        result = generate_itinerary("Goa", 3, 2, "economy", "", "fake-key")

        assert "error" in result

    @patch("app.services.itinerary_service._configured", False)
    @patch("app.services.itinerary_service._client", None)
    @patch("app.services.itinerary_service.genai")
    def test_no_interests_uses_default(self, mock_genai):
        mock_client = MagicMock()
        mock_genai.Client.return_value = mock_client
        mock_client.models.generate_content.return_value = MagicMock(
            text=json.dumps([SAMPLE_DAY]),
        )

        generate_itinerary("Delhi", 2, 4, "economy", "", "fake-key")

        prompt = mock_client.models.generate_content.call_args[1]["contents"]
        assert "general sightseeing" in prompt
