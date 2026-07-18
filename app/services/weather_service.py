"""
Weather Service
================
Fetches current weather data from the OpenWeatherMap API and returns
a structured WeatherResponse.  Falls back to a friendly error message
when the API key is missing or the request fails.

Docs: https://openweathermap.org/current
"""

import logging
import requests
from typing import Optional

from app.models.schemas import WeatherResponse
from app.services.packing_service import suggest_packing
from app.utils.retry import api_retry

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenWeather helper
# ---------------------------------------------------------------------------

@api_retry
def fetch_weather(
    destination: str,
    api_key: str,
    base_url: str = "https://api.openweathermap.org/data/2.5",
) -> Optional[WeatherResponse]:
    """
    Call OpenWeatherMap Current Weather API and return a WeatherResponse.

    Args:
        destination: City name (e.g. "Jaipur").
        api_key: OpenWeatherMap API key.
        base_url: API base URL.

    Returns:
        WeatherResponse on success, None on failure.
    """
    if not api_key:
        logger.warning("OpenWeather API key not configured – returning None")
        return None

    params = {
        "q": destination,
        "appid": api_key,
        "units": "metric",       # Celsius
    }

    try:
        resp = requests.get(f"{base_url}/weather", params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        logger.error("OpenWeather API error for '%s': %s", destination, exc)
        return None

    # Extract fields
    main = data.get("main", {})
    wind = data.get("wind", {})
    weather_desc = (
        data.get("weather", [{}])[0].get("description", "unknown").capitalize()
    )

    temp_c = main.get("temp", 0.0)
    feels_like = main.get("feels_like", 0.0)
    humidity = main.get("humidity", 0)
    wind_speed = round(wind.get("speed", 0.0) * 3.6, 1)  # m/s → km/h

    # Generate packing suggestions based on weather
    packing = suggest_packing(temp_c, humidity, weather_desc)

    return WeatherResponse(
        destination=destination,
        temperature_c=round(temp_c, 1),
        feels_like_c=round(feels_like, 1),
        humidity=humidity,
        description=weather_desc,
        wind_speed_kmh=wind_speed,
        packing_suggestions=packing,
    )
