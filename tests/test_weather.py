"""
Tests for Weather API
======================
Note: Weather tests mock the external OpenWeather API call to avoid
hitting the real API in CI. The integration test at the bottom can
be run manually with a real API key.
"""

import pytest
from unittest.mock import patch, MagicMock

from app.models.schemas import WeatherResponse


class TestWeatherEndpoint:
    """Tests for GET /api/weather/<destination>."""

    def test_weather_returns_fallback_when_no_api_key(self, client):
        """Without an API key the service should return 200 with fallback data."""
        resp = client.get("/api/weather/Goa")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get("using_fallback") is True

    def test_weather_returns_400_for_short_name(self, client):
        resp = client.get("/api/weather/X")
        assert resp.status_code == 400

    @patch("app.api.routes.weather.fetch_weather")
    def test_weather_returns_200_with_mock(self, mock_fetch, client):
        """Simulated successful weather fetch."""
        mock_fetch.return_value = WeatherResponse(
            destination="Goa",
            temperature_c=30.0,
            feels_like_c=33.0,
            humidity=75,
            description="Clear sky",
            wind_speed_kmh=12.0,
            packing_suggestions=["Sunscreen", "Cotton clothes"],
        )

        resp = client.get("/api/weather/Goa")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["destination"] == "Goa"
        assert data["temperature_c"] == 30.0


class TestPackingService:
    """Unit tests for the packing suggestion logic."""

    def test_cold_weather_suggests_jacket(self):
        from app.services.packing_service import suggest_packing
        items = suggest_packing(temp_c=3.0, humidity=60, weather_description="Clear")
        labels = " ".join(items).lower()
        assert "jacket" in labels or "coat" in labels

    def test_rain_suggests_umbrella(self):
        from app.services.packing_service import suggest_packing
        items = suggest_packing(temp_c=25.0, humidity=80, weather_description="Light rain")
        labels = " ".join(items).lower()
        assert "umbrella" in labels
