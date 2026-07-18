"""
Tests for weather service.
"""

from unittest.mock import patch, MagicMock
from app.services.weather_service import fetch_weather


class TestFetchWeather:
    def test_returns_none_without_api_key(self):
        result = fetch_weather("Jaipur", api_key="")
        assert result is None

    @patch("app.services.weather_service.requests.get")
    def test_successful_fetch(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "main": {"temp": 32.5, "feels_like": 35.0, "humidity": 45},
            "wind": {"speed": 3.5},
            "weather": [{"description": "clear sky"}],
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        result = fetch_weather("Jaipur", api_key="test-key")

        assert result is not None
        assert result.destination == "Jaipur"
        assert result.temperature_c == 32.5
        assert result.feels_like_c == 35.0
        assert result.humidity == 45
        assert result.description == "Clear sky"
        assert result.wind_speed_kmh == 12.6  # 3.5 * 3.6
        assert isinstance(result.packing_suggestions, list)

    @patch("app.services.weather_service.requests.get")
    def test_api_error_returns_none(self, mock_get):
        import requests
        mock_get.side_effect = requests.RequestException("API down")
        result = fetch_weather("Jaipur", api_key="key")
        assert result is None

    @patch("app.services.weather_service.requests.get")
    def test_missing_weather_data_uses_defaults(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "main": {},
            "wind": {},
            "weather": [{}],
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        result = fetch_weather("Delhi", api_key="key")
        assert result is not None
        assert result.temperature_c == 0.0
        assert result.humidity == 0
        assert result.description == "Unknown"

    @patch("app.services.weather_service.requests.get")
    def test_http_error_returns_none(self, mock_get):
        mock_resp = MagicMock()
        import requests
        mock_resp.raise_for_status.side_effect = requests.HTTPError("404")
        mock_get.return_value = mock_resp
        result = fetch_weather("Nowhere", api_key="key")
        assert result is None
