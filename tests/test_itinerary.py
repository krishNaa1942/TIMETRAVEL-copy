"""
Tests for AI Itinerary Generator API
=======================================
"""

import json
from unittest.mock import patch


class TestItineraryValidation:
    """Tests for POST /api/itinerary/generate input validation."""

    def test_missing_json_body(self, client):
        resp = client.post("/api/itinerary/generate", data="not json")
        assert resp.status_code == 400
        assert "JSON" in resp.get_json()["error"]

    def test_missing_destination(self, client):
        resp = client.post("/api/itinerary/generate", json={
            "num_days": 3, "family_size": 4, "travel_class": "economy",
        })
        assert resp.status_code == 400
        assert "destination" in resp.get_json()["error"].lower()

    def test_invalid_destination(self, client):
        resp = client.post("/api/itinerary/generate", json={
            "destination": "Mars",
            "num_days": 3, "family_size": 4, "travel_class": "economy",
        })
        assert resp.status_code == 400

    def test_days_too_low(self, client):
        resp = client.post("/api/itinerary/generate", json={
            "destination": "Goa", "num_days": 0, "family_size": 4,
            "travel_class": "economy",
        })
        assert resp.status_code == 400

    def test_days_too_high(self, client):
        resp = client.post("/api/itinerary/generate", json={
            "destination": "Goa", "num_days": 15, "family_size": 4,
            "travel_class": "economy",
        })
        assert resp.status_code == 400

    def test_invalid_family_size(self, client):
        resp = client.post("/api/itinerary/generate", json={
            "destination": "Goa", "num_days": 3, "family_size": 0,
            "travel_class": "economy",
        })
        assert resp.status_code == 400

    def test_invalid_travel_class(self, client):
        resp = client.post("/api/itinerary/generate", json={
            "destination": "Goa", "num_days": 3, "family_size": 4,
            "travel_class": "ultra-luxury",
        })
        assert resp.status_code == 400

    def test_non_integer_days(self, client):
        resp = client.post("/api/itinerary/generate", json={
            "destination": "Goa", "num_days": "abc", "family_size": 4,
            "travel_class": "economy",
        })
        assert resp.status_code == 400


class TestItineraryGeneration:
    """Tests for successful itinerary generation (Gemini mocked)."""

    SAMPLE_ITINERARY = [
        {
            "day": 1,
            "title": "Arrival & Beach Day",
            "morning": {
                "activity": "Check in at hotel",
                "description": "Settle in and freshen up.",
                "duration": "2 hours",
                "cost": "Free",
            },
            "afternoon": {
                "activity": "Baga Beach",
                "description": "Relax at the famous beach.",
                "duration": "3 hours",
                "cost": "₹200 per person",
            },
            "evening": {
                "activity": "Tito's Lane",
                "description": "Walk through the vibrant area.",
                "duration": "2 hours",
                "cost": "₹500 per person",
            },
            "tip": "Apply sunscreen generously!",
        }
    ]

    @patch("app.api.routes.itinerary.generate_itinerary")
    def test_successful_generation(self, mock_gen, client, app):
        mock_gen.return_value = {
            "destination": "Goa",
            "num_days": 1,
            "family_size": 4,
            "travel_class": "economy",
            "interests": "",
            "itinerary": self.SAMPLE_ITINERARY,
        }

        # Need to set GOOGLE_API_KEY so route doesn't return 503
        app.config["GOOGLE_API_KEY"] = "test-key-123"

        resp = client.post("/api/itinerary/generate", json={
            "destination": "Goa",
            "num_days": 1,
            "family_size": 4,
            "travel_class": "economy",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["destination"] == "Goa"
        assert len(data["itinerary"]) == 1
        assert data["itinerary"][0]["morning"]["activity"] == "Check in at hotel"

    @patch("app.api.routes.itinerary.generate_itinerary")
    def test_generation_error_returns_502(self, mock_gen, client, app):
        mock_gen.return_value = {"error": "AI returned invalid response"}
        app.config["GOOGLE_API_KEY"] = "test-key-123"

        resp = client.post("/api/itinerary/generate", json={
            "destination": "Jaipur",
            "num_days": 3,
            "family_size": 2,
            "travel_class": "comfort",
        })
        assert resp.status_code == 502
        assert "error" in resp.get_json()

    def test_no_api_key_returns_503(self, client, app):
        app.config["GOOGLE_API_KEY"] = ""

        resp = client.post("/api/itinerary/generate", json={
            "destination": "Goa",
            "num_days": 3,
            "family_size": 4,
            "travel_class": "economy",
        })
        assert resp.status_code == 503
        assert "configured" in resp.get_json()["error"].lower()

    def test_interests_passed_through(self, client, app):
        """Interests field is optional and passed to the service."""
        app.config["GOOGLE_API_KEY"] = "test-key-123"

        with patch("app.api.routes.itinerary.generate_itinerary") as mock_gen:
            mock_gen.return_value = {
                "destination": "Munnar",
                "num_days": 2,
                "family_size": 3,
                "travel_class": "economy",
                "interests": "backwaters, food",
                "itinerary": self.SAMPLE_ITINERARY,
            }
            resp = client.post("/api/itinerary/generate", json={
                "destination": "Munnar",
                "num_days": 2,
                "family_size": 3,
                "travel_class": "economy",
                "interests": "backwaters, food",
            })
            assert resp.status_code == 200
            # Verify interests were passed to the service
            call_kwargs = mock_gen.call_args
            assert call_kwargs[1]["interests"] == "backwaters, food"


class TestItineraryServiceUnit:
    """Unit tests for the itinerary service helper."""

    def test_extract_json_strips_fences(self):
        from app.services.itinerary_service import _extract_json

        raw = '```json\n[{"day": 1}]\n```'
        result = _extract_json(raw)
        assert result == [{"day": 1}]

    def test_extract_json_plain(self):
        from app.services.itinerary_service import _extract_json

        raw = '[{"day": 1, "title": "Arrival"}]'
        result = _extract_json(raw)
        assert result[0]["title"] == "Arrival"

    def test_extract_json_invalid_raises(self):
        from app.services.itinerary_service import _extract_json
        import json as json_mod

        with __import__("pytest").raises(json_mod.JSONDecodeError):
            _extract_json("not valid json at all")
