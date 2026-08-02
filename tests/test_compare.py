"""
Tests for Destination Comparison API
========================================
"""

from unittest.mock import patch, MagicMock

import pytest


@pytest.fixture()
def auth(client):
    client.post(
        "/api/auth/register",
        json={"name": "Tester", "email": "test@example.com", "password": "Test1234!"},
    )
    return client


class TestCompareValidation:
    """Tests for GET /api/compare input validation."""

    def test_missing_destinations(self, auth):
        resp = auth.get("/api/compare")
        assert resp.status_code == 400
        assert "required" in resp.get_json()["error"].lower()

    def test_missing_dest2(self, auth):
        resp = auth.get("/api/compare?dest1=Goa")
        assert resp.status_code == 400

    def test_invalid_destination(self, auth):
        resp = auth.get("/api/compare?dest1=Goa&dest2=Mars")
        assert resp.status_code == 400
        assert "Invalid" in resp.get_json()["error"]

    def test_same_destination(self, auth):
        resp = auth.get("/api/compare?dest1=Goa&dest2=Goa")
        assert resp.status_code == 400
        assert "different" in resp.get_json()["error"].lower()


class TestCompareSuccess:
    """Tests for successful comparison responses."""

    @patch("app.services.weather_service.fetch_weather")
    def test_compare_returns_both_profiles(self, mock_weather, auth):
        mock_weather.return_value = None
        resp = auth.get("/api/compare?dest1=Goa&dest2=Jaipur")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "dest1" in data
        assert "dest2" in data
        assert data["dest1"]["destination"] == "Goa"
        assert data["dest2"]["destination"] == "Jaipur"

    @patch("app.services.weather_service.fetch_weather")
    def test_compare_has_budget(self, mock_weather, auth):
        mock_weather.return_value = None
        resp = auth.get("/api/compare?dest1=Goa&dest2=Manali")
        data = resp.get_json()
        for profile in [data["dest1"], data["dest2"]]:
            b = profile["budget"]
            assert b["total"] > 0
            assert b["currency"] == "INR"
            assert "accommodation" in b
            assert "food" in b

    @patch("app.services.weather_service.fetch_weather")
    def test_compare_has_safety(self, mock_weather, auth):
        mock_weather.return_value = None
        resp = auth.get("/api/compare?dest1=Munnar&dest2=Delhi")
        data = resp.get_json()
        for profile in [data["dest1"], data["dest2"]]:
            s = profile["safety"]
            assert "overall_score" in s
            assert "crime_score" in s
            assert "advisory" in s

    @patch("app.services.weather_service.fetch_weather")
    def test_compare_includes_params(self, mock_weather, auth):
        mock_weather.return_value = None
        resp = auth.get(
            "/api/compare?dest1=Goa&dest2=Jaipur&days=7&family=6&class=comfort"
        )
        data = resp.get_json()
        assert data["params"]["num_days"] == 7
        assert data["params"]["family_size"] == 6
        assert data["params"]["travel_class"] == "comfort"

    @patch("app.services.weather_service.fetch_weather")
    def test_compare_default_params(self, mock_weather, auth):
        mock_weather.return_value = None
        resp = auth.get("/api/compare?dest1=Goa&dest2=Jaipur")
        data = resp.get_json()
        assert data["params"]["num_days"] == 5
        assert data["params"]["family_size"] == 4
        assert data["params"]["travel_class"] == "economy"

    @patch("app.api.routes.compare.fetch_weather")
    def test_compare_weather_when_available(self, mock_weather, auth, app):
        from app.models.schemas import WeatherResponse

        mock_weather.return_value = WeatherResponse(
            destination="Goa",
            temperature_c=32.5,
            feels_like_c=35.0,
            humidity=75,
            description="Clear sky",
            wind_speed_kmh=12.0,
            packing_suggestions=["Sunscreen"],
        )
        app.config["OPENWEATHER_API_KEY"] = "test-key"
        resp = auth.get("/api/compare?dest1=Goa&dest2=Jaipur")
        data = resp.get_json()
        assert (
            data["dest1"]["weather"] is not None or data["dest2"]["weather"] is not None
        )

    @patch("app.services.weather_service.fetch_weather")
    def test_compare_weather_null_when_no_key(self, mock_weather, auth, app):
        app.config["OPENWEATHER_API_KEY"] = ""
        resp = auth.get("/api/compare?dest1=Goa&dest2=Jaipur")
        data = resp.get_json()
        assert data["dest1"]["weather"] is None
        assert data["dest2"]["weather"] is None

    @patch("app.services.weather_service.fetch_weather")
    def test_compare_all_15_destinations(self, mock_weather, auth):
        mock_weather.return_value = None
        dests = [
            "Goa",
            "Jaipur",
            "Manali",
            "Munnar",
            "Shimla",
            "Varanasi",
            "Udaipur",
            "Mumbai",
            "Delhi",
            "Agra",
            "Rishikesh",
            "Ooty",
            "Darjeeling",
            "Pondicherry",
            "Andaman",
        ]
        resp = auth.get(f"/api/compare?dest1={dests[0]}&dest2={dests[-1]}")
        assert resp.status_code == 200
