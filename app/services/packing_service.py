"""
Packing & Clothing Suggestion Service
=======================================
Generates weather-aware packing recommendations.
Uses simple rule-based logic today; ready to plug in an ML classifier later.
"""

from typing import List


def suggest_packing(
    temp_c: float,
    humidity: int,
    weather_description: str,
) -> List[str]:
    """
    Suggest clothing and packing items based on current weather.

    Args:
        temp_c: Temperature in Celsius.
        humidity: Relative humidity (0–100).
        weather_description: Short weather text (e.g. "Clear sky").

    Returns:
        List of packing recommendation strings.
    """
    suggestions: List[str] = []
    desc_lower = weather_description.lower()

    # ── Temperature-based ───────────────────────────────────────────
    if temp_c <= 5:
        suggestions += [
            "Heavy winter jacket or down coat",
            "Thermal innerwear",
            "Woollen gloves and beanie",
            "Insulated waterproof boots",
            "Warm scarf / muffler",
        ]
    elif temp_c <= 15:
        suggestions += [
            "Light jacket or hoodie",
            "Full-sleeve shirts / sweaters",
            "Closed-toe comfortable shoes",
            "Light scarf",
        ]
    elif temp_c <= 25:
        suggestions += [
            "T-shirts and light cotton shirts",
            "Jeans or chinos",
            "Comfortable walking shoes",
            "Light cardigan for evenings",
        ]
    elif temp_c <= 35:
        suggestions += [
            "Loose cotton / linen clothing",
            "Shorts and breathable tops",
            "Sandals or open-toe shoes",
            "Wide-brim hat or cap",
            "Sunscreen (SPF 50+)",
        ]
    else:
        suggestions += [
            "Ultra-light breathable fabrics",
            "Cooling towel",
            "Electrolyte packets / ORS",
            "UV-protection sunglasses",
            "Sunscreen (SPF 50+)",
        ]

    # ── Humidity-based ──────────────────────────────────────────────
    if humidity > 75:
        suggestions.append("Quick-dry / moisture-wicking clothes")
        suggestions.append("Anti-chafing powder or cream")

    # ── Rain / snow detection ───────────────────────────────────────
    if any(
        word in desc_lower for word in ("rain", "drizzle", "shower", "thunderstorm")
    ):
        suggestions.append("Compact foldable umbrella")
        suggestions.append("Waterproof rain jacket / poncho")
        suggestions.append("Waterproof shoe covers or rain boots")

    if "snow" in desc_lower:
        suggestions.append("Snow boots with grip soles")
        suggestions.append("Hand warmers")

    # ── Wind ────────────────────────────────────────────────────────
    if "wind" in desc_lower:
        suggestions.append("Windbreaker jacket")

    # ── Universal essentials ────────────────────────────────────────
    suggestions += [
        "Reusable water bottle",
        "Basic first-aid kit",
        "Power bank and universal charger",
        "Photocopies of ID and travel documents",
    ]

    return suggestions
