"""
Safety Score Service
=====================
Provides a composite travel safety score (0–10) for destinations.
Reads static data from data/safety_scores.json and returns a structured
SafetyResponse with sub-scores and an advisory message.

Future: integrate live data from government travel advisories & news APIs.
"""

import json
import logging
from typing import Optional

from app.models.schemas import SafetyResponse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory cache for safety data
# ---------------------------------------------------------------------------
_SAFETY_CACHE: Optional[dict] = None


def _load_safety_data(path: str) -> dict:
    """Load and cache safety scores from JSON file."""
    global _SAFETY_CACHE
    if _SAFETY_CACHE is None:
        try:
            with open(path, "r") as fh:
                _SAFETY_CACHE = json.load(fh)
            logger.info("Safety data loaded (%d destinations)", len(_SAFETY_CACHE))
        except FileNotFoundError:
            logger.warning("Safety data file not found at %s", path)
            _SAFETY_CACHE = {}
        except json.JSONDecodeError:
            logger.error("Safety data file is malformed JSON at %s", path)
            _SAFETY_CACHE = {}
    return _SAFETY_CACHE


# ---------------------------------------------------------------------------
# Advisory thresholds
# ---------------------------------------------------------------------------
def _advisory_text(score: float) -> str:
    """Generate a human-readable advisory based on the overall score."""
    if score >= 8.0:
        return "Very safe destination. Ideal for families with children."
    elif score >= 6.0:
        return "Generally safe. Take standard precautions."
    elif score >= 4.0:
        return "Moderate risk. Stay in well-known tourist areas and travel in groups."
    elif score >= 2.0:
        return "Elevated risk. Consider travel insurance and register with your embassy."
    else:
        return "High risk. Travel is not recommended for families at this time."


# ---------------------------------------------------------------------------
# Default scores for unknown destinations
# ---------------------------------------------------------------------------
_DEFAULT_SCORES = {
    "crime_score": 5.0,
    "health_score": 5.0,
    "infrastructure_score": 5.0,
    "tourist_friendliness": 5.0,
}


def get_safety_score(destination: str, data_path: str) -> SafetyResponse:
    """
    Look up or estimate the safety profile of a destination.

    Args:
        destination: Name of the city/region.
        data_path: Filesystem path to safety_scores.json.

    Returns:
        SafetyResponse with sub-scores and advisory.
    """
    data = _load_safety_data(data_path)
    key = destination.strip().lower()

    scores = data.get(key, _DEFAULT_SCORES)
    is_estimated = key not in data

    # Composite overall score (weighted average)
    overall = round(
        scores["crime_score"] * 0.30
        + scores["health_score"] * 0.25
        + scores["infrastructure_score"] * 0.25
        + scores["tourist_friendliness"] * 0.20,
        1,
    )

    advisory = _advisory_text(overall)
    if is_estimated:
        advisory = (
            "Safety data not yet verified for this destination. "
            "Scores shown are estimates. Please check government travel advisories."
        )

    return SafetyResponse(
        destination=destination,
        overall_score=overall,
        crime_score=scores["crime_score"],
        health_score=scores["health_score"],
        infrastructure_score=scores["infrastructure_score"],
        tourist_friendliness=scores["tourist_friendliness"],
        advisory=advisory,
        is_estimated=is_estimated,
    )
