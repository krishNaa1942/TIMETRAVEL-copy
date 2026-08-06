"""
Server-side trip intent parser (single authority)
===================================================
The mobile client sends the raw free-text query (e.g. "3-day trip to Goa
from Bangalore on a budget") and this module resolves structured fields:

    destination -> canonical destination key (resolved against the catalog)
    num_days     -> 3 by default
    travel_class -> economy | comfort | premium (keyword driven)
    interests    -> derived travel styles + leftover tokens
    origin       -> "from X" capture (informational)

This removes the fragile client-side regex NLP and guarantees the exact
same parsing for every client.
"""

import re
from typing import Optional

from app.utils.constants import (
    VALID_DESTINATION_NAMES,
    resolve_destination_key,
)

# Longest forms first so "Mumbai" wins over "Mumba" style partials
_DESTINATION_FORMS: list[str] = sorted(
    {f for f in VALID_DESTINATION_NAMES if len(f) >= 3},
    key=len,
    reverse=True,
)

_DAYS_RE = re.compile(
    r"(?:^|\D)(\d{1,2})\s*-?\s*(?:day|days|night|nights)(?:\D|$)"
)
_ORIGIN_RE = re.compile(r"from\s+([a-zA-Z][a-zA-Z\s]{1,40}?)(?=\s+(?:to|for|in|on|with|under|budget)|$)", re.IGNORECASE)

_STYLE_KEYWORDS: dict[str, list[str]] = {
    "adventure": ["trek", "hiking", "adventure", "mountain", "safari", "climb", "rafting"],
    "beaches": ["beach", "coast", "sea", "island", "sand", "waves", "resort"],
    "culture": ["temple", "heritage", "history", "culture", "monument", "fort", "palace"],
    "nature": ["nature", "forest", "wildlife", "park", "hill station", "backwater"],
    "spiritual": ["spiritual", "pilgrimage", "ashram", "meditation", "yoga"],
    "luxury": ["luxury", "5-star", "exclusive", "resort"],
    "budget": ["budget", "cheap", "hostel", "affordable", "backpack"],
}

_TRAVEL_CLASS_KEYWORDS: dict[str, tuple[str, ...]] = {
    "premium": ("premium", "luxury", "5-star", "first class"),
    "comfort": ("comfort", "mid-range", "mid range", "business"),
}


def _find_destination(query: str, origin_match: re.Match | None = None) -> Optional[str]:
    """Locate a catalog destination mentioned in the free text.

    The origin phrase ("from X") is masked out so it can never win over the
    actual destination, wherever that appears in the query.
    """
    masked = query.lower()
    if origin_match:
        start, end = origin_match.span()
        masked = masked[:start] + (" " * (end - start)) + masked[end:]

    for form in _DESTINATION_FORMS:
        if form.lower() in masked:
            key = resolve_destination_key(form)
            if key:
                return key
    # Final attempt: fuzzy resolve on the whole query
    return resolve_destination_key(query)


def _find_days(query: str) -> int:
    match = _DAYS_RE.search(query.lower())
    if match:
        days = int(match.group(1))
        return max(1, min(days, 14))
    return 3


def _find_travel_class(query: str) -> str:
    lowered = query.lower()
    for travel_class, keywords in _TRAVEL_CLASS_KEYWORDS.items():
        if any(k in lowered for k in keywords):
            return travel_class
    return "economy"


def _find_interests(query: str) -> str:
    lowered = query.lower()
    styles = [
        style
        for style, keywords in _STYLE_KEYWORDS.items()
        if any(k in lowered for k in keywords)
    ]
    return ", ".join(styles[:5]) if styles else ""


def parse_trip_intent(query: str) -> dict:
    """Parse a raw trip-planning query into structured fields."""
    raw = (query or "").strip()
    if not raw:
        return {
            "query": "",
            "destination": None,
            "origin": "",
            "num_days": 3,
            "travel_class": "economy",
            "interests": "",
            "styles": [],
        }

    origin_match = _ORIGIN_RE.search(raw)
    destination = _find_destination(raw, origin_match)
    days = _find_days(raw)
    travel_class = _find_travel_class(raw)
    interests = _find_interests(raw)

    return {
        "query": raw,
        "destination": destination,
        "origin": origin_match.group(1).strip() if origin_match else "",
        "num_days": days,
        "travel_class": travel_class,
        "interests": interests,
        "styles": [s for s in interests.split(", ") if s],
    }
