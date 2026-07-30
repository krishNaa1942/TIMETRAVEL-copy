"""
Weather & Packing API Route
============================
GET /api/weather/<destination> – Fetch live weather data and return
packing suggestions tailored to current conditions.

Response JSON:
    {
        "destination": "Manali",
        "temperature_c": 2.5,
        "feels_like_c": -1.3,
        "humidity": 85,
        "description": "Light snow",
        "wind_speed_kmh": 12.4,
        "packing_suggestions": [ "Heavy winter jacket", ... ]
    }
"""

from flask import Blueprint, jsonify, current_app
import random

from app.services.weather_service import fetch_weather

weather_bp = Blueprint("weather", __name__)

# Fallback weather data for Indian destinations
_FALLBACK_WEATHER = {
    # Hill stations
    "manali": {
        "temp": 15,
        "feels_like": 12,
        "humidity": 65,
        "desc": "Pleasant mountain weather",
    },
    "shimla": {"temp": 18, "feels_like": 15, "humidity": 60, "desc": "Cool and clear"},
    "darjeeling": {
        "temp": 16,
        "feels_like": 14,
        "humidity": 75,
        "desc": "Misty mountains",
    },
    "ooty": {
        "temp": 15,
        "feels_like": 13,
        "humidity": 70,
        "desc": "Pleasant hill station",
    },
    "munnar": {
        "temp": 20,
        "feels_like": 18,
        "humidity": 80,
        "desc": "Cool tea gardens",
    },
    "kodaikanal": {
        "temp": 17,
        "feels_like": 15,
        "humidity": 72,
        "desc": "Pleasant and misty",
    },
    "coorg": {
        "temp": 22,
        "feels_like": 21,
        "humidity": 75,
        "desc": "Pleasant coffee lands",
    },
    "kasol": {
        "temp": 14,
        "feels_like": 11,
        "humidity": 55,
        "desc": "Cool mountain air",
    },
    "gulmarg": {"temp": 10, "feels_like": 6, "humidity": 60, "desc": "Cold and scenic"},
    "srinagar": {
        "temp": 18,
        "feels_like": 16,
        "humidity": 62,
        "desc": "Pleasant valley",
    },
    "leh": {"temp": 12, "feels_like": 8, "humidity": 35, "desc": "Cold desert"},
    "nainital": {
        "temp": 18,
        "feels_like": 16,
        "humidity": 68,
        "desc": "Cool lake breeze",
    },
    "mussoorie": {
        "temp": 20,
        "feels_like": 18,
        "humidity": 65,
        "desc": "Queen of hills",
    },
    "dharamshala": {
        "temp": 18,
        "feels_like": 16,
        "humidity": 60,
        "desc": "Cool mountain town",
    },
    # Beaches
    "goa": {
        "temp": 30,
        "feels_like": 34,
        "humidity": 80,
        "desc": "Tropical beach paradise",
    },
    "kerala": {
        "temp": 29,
        "feels_like": 33,
        "humidity": 85,
        "desc": "Tropical backwaters",
    },
    "andaman": {
        "temp": 28,
        "feels_like": 32,
        "humidity": 82,
        "desc": "Tropical island bliss",
    },
    "lakshadweep": {
        "temp": 28,
        "feels_like": 32,
        "humidity": 80,
        "desc": "Tropical island paradise",
    },
    "kovalam": {
        "temp": 29,
        "feels_like": 33,
        "humidity": 82,
        "desc": "Sunny beach weather",
    },
    "varkala": {
        "temp": 29,
        "feels_like": 33,
        "humidity": 80,
        "desc": "Coastal paradise",
    },
    "pondicherry": {
        "temp": 30,
        "feels_like": 34,
        "humidity": 78,
        "desc": "Coastal charm",
    },
    "gokarna": {"temp": 29, "feels_like": 32, "humidity": 80, "desc": "Beach bliss"},
    # Major cities
    "delhi": {"temp": 32, "feels_like": 36, "humidity": 45, "desc": "Warm and dry"},
    "mumbai": {"temp": 30, "feels_like": 34, "humidity": 80, "desc": "Humid coastal"},
    "bangalore": {
        "temp": 26,
        "feels_like": 26,
        "humidity": 65,
        "desc": "Pleasant garden city",
    },
    "chennai": {"temp": 33, "feels_like": 38, "humidity": 75, "desc": "Hot and humid"},
    "kolkata": {"temp": 32, "feels_like": 38, "humidity": 80, "desc": "Warm and humid"},
    "hyderabad": {"temp": 32, "feels_like": 35, "humidity": 55, "desc": "Warm and dry"},
    "pune": {"temp": 28, "feels_like": 29, "humidity": 60, "desc": "Pleasant city"},
    "ahmedabad": {"temp": 35, "feels_like": 40, "humidity": 40, "desc": "Hot and dry"},
    "jaipur": {
        "temp": 34,
        "feels_like": 38,
        "humidity": 35,
        "desc": "Hot desert climate",
    },
    "udaipur": {
        "temp": 32,
        "feels_like": 35,
        "humidity": 40,
        "desc": "Warm city of lakes",
    },
    "jaisalmer": {"temp": 36, "feels_like": 40, "humidity": 25, "desc": "Hot desert"},
    # Heritage sites
    "agra": {"temp": 34, "feels_like": 38, "humidity": 40, "desc": "Warm and sunny"},
    "varanasi": {
        "temp": 33,
        "feels_like": 37,
        "humidity": 50,
        "desc": "Warm spiritual city",
    },
    "khajuraho": {
        "temp": 32,
        "feels_like": 36,
        "humidity": 45,
        "desc": "Warm and clear",
    },
    "hampi": {"temp": 32, "feels_like": 35, "humidity": 55, "desc": "Warm ruins"},
    # Wildlife
    "ranthambore": {
        "temp": 32,
        "feels_like": 36,
        "humidity": 40,
        "desc": "Warm safari weather",
    },
    "jim corbett": {
        "temp": 28,
        "feels_like": 30,
        "humidity": 65,
        "desc": "Jungle climate",
    },
    "kaziranga": {
        "temp": 28,
        "feels_like": 32,
        "humidity": 85,
        "desc": "Humid grasslands",
    },
    "bandhavgarh": {
        "temp": 30,
        "feels_like": 34,
        "humidity": 55,
        "desc": "Warm jungle",
    },
    "kanha": {"temp": 29, "feels_like": 32, "humidity": 60, "desc": "Pleasant jungle"},
    # Northeast
    "gangtok": {
        "temp": 18,
        "feels_like": 15,
        "humidity": 70,
        "desc": "Cool mountain capital",
    },
    "shillong": {
        "temp": 20,
        "feels_like": 18,
        "humidity": 75,
        "desc": "Scotland of the East",
    },
    "tawang": {
        "temp": 12,
        "feels_like": 8,
        "humidity": 60,
        "desc": "Cold mountain air",
    },
    "meghalaya": {
        "temp": 18,
        "feels_like": 16,
        "humidity": 85,
        "desc": "Abode of clouds",
    },
}


# Default packing suggestions based on temperature
def _get_packing_suggestions(temp_c: float, humidity: int) -> list:
    """Generate packing suggestions based on weather conditions."""
    suggestions = []

    if temp_c <= 5:
        suggestions = [
            "Heavy winter jacket",
            "Thermal innerwear",
            "Woolen cap and gloves",
            "Snow boots",
            "Warm layers",
        ]
    elif temp_c <= 15:
        suggestions = [
            "Light jacket or sweater",
            "Long pants",
            "Light layers for evening",
            "Comfortable walking shoes",
        ]
    elif temp_c <= 25:
        suggestions = [
            "Light cotton clothes",
            "Comfortable walking shoes",
            "Light jacket for evenings",
            "Sunscreen",
        ]
    else:
        suggestions = [
            "Light cotton clothes",
            "Sun hat or cap",
            "Sunscreen (SPF 30+)",
            "Sunglasses",
            "Stay hydrated",
        ]

    if humidity >= 80:
        suggestions.append("Moisture-wicking clothes")
        suggestions.append("Umbrella")
    elif humidity <= 40:
        suggestions.append("Moisturizer")
        suggestions.append("Lip balm")

    return suggestions


def _get_fallback_weather(destination: str) -> dict:
    """Generate fallback weather data for a destination."""
    dest_lower = destination.lower()

    # Try to find a matching destination
    weather_data = None
    for key, data in _FALLBACK_WEATHER.items():
        if key in dest_lower or dest_lower in key:
            weather_data = data
            break

    # Default fallback
    if weather_data is None:
        weather_data = {
            "temp": 25 + random.randint(-5, 10),
            "feels_like": 25 + random.randint(-5, 10),
            "humidity": 60 + random.randint(-20, 20),
            "desc": "Pleasant travel weather",
        }

    # Add slight variation
    temp = weather_data["temp"] + random.randint(-2, 2)
    feels_like = weather_data["feels_like"] + random.randint(-2, 2)
    humidity = max(20, min(95, weather_data["humidity"] + random.randint(-10, 10)))

    return {
        "destination": destination,
        "temperature_c": temp,
        "feels_like_c": feels_like,
        "humidity": humidity,
        "description": weather_data["desc"],
        "wind_speed_kmh": round(5 + random.random() * 15, 1),
        "packing_suggestions": _get_packing_suggestions(temp, humidity),
        "using_fallback": True,
        "provider": "fallback",
    }


@weather_bp.route("/api/weather/<destination>", methods=["GET"])
def weather_info(destination: str):
    """Get current weather and packing advice for a destination."""

    if not destination or len(destination.strip()) < 2 or len(destination) > 100:
        return jsonify({"error": "Invalid destination name"}), 400

    api_key = current_app.config.get("OPENWEATHER_API_KEY", "")
    base_url = current_app.config.get("OPENWEATHER_BASE_URL")

    # Try to fetch real weather data
    result = fetch_weather(destination, api_key, base_url)

    if result is None:
        # Return fallback weather data instead of 503 error
        fallback = _get_fallback_weather(destination)
        return jsonify(fallback), 200

    return jsonify(result.to_dict()), 200
