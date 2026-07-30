"""
App-wide Constants
===================
Centralised constants used across multiple modules.
"""

import json
import os
import re
import unicodedata

# ═══════════════════════════════════════════════════════════════════════════
# Destinations Registry  –  THE SINGLE SOURCE OF TRUTH
# ═══════════════════════════════════════════════════════════════════════════
# Loaded from data/india_destinations.json (201 destinations).
# Services, routes, templates, and JS all derive their lists from this dict.
# ═══════════════════════════════════════════════════════════════════════════

_MONTH_ABBR = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
}


def _format_best_season(months: list[int]) -> str:
    """Convert month integers [10,11,12,1,2,3] → 'Oct – Mar'."""
    if not months:
        return "Year-round"
    if len(months) == 12:
        return "Year-round"
    # Find contiguous ranges
    sorted_m = sorted(months)
    ranges = []
    start = prev = sorted_m[0]
    for m in sorted_m[1:]:
        if m == prev + 1:
            prev = m
        else:
            ranges.append((start, prev))
            start = prev = m
    ranges.append((start, prev))
    # Handle wrap-around (e.g., [10,11,12,1,2,3])
    if len(ranges) > 1 and ranges[-1][1] == 12 and ranges[0][0] == 1:
        merged_start = ranges[-1][0]
        merged_end = ranges[0][1]
        ranges = [(merged_start, merged_end)] + ranges[1:-1]
    parts = []
    for s, e in ranges:
        if s == e:
            parts.append(_MONTH_ABBR[s])
        else:
            parts.append(f"{_MONTH_ABBR[s]} – {_MONTH_ABBR[e]}")
    return ", ".join(parts)


def _load_destinations() -> dict:
    """Load destinations from india_destinations.json and build DESTINATIONS dict."""
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "data",
        "india_destinations.json",
    )
    try:
        with open(data_path, "r") as fh:
            raw = json.load(fh)
    except FileNotFoundError:
        return {}

    dests = {}
    for d in raw.get("destinations", []):
        key = d["id"]
        name = d["name"]
        state = d.get("state", "")
        categories = d.get("category", [])
        highlights = d.get("highlights", [])

        dests[key] = {
            "label": name,
            "lat": d["lat"],
            "lon": d.get("lng", d.get("lon", 0)),
            "region": state,
            "best_season": _format_best_season(d.get("best_months", [])),
            "highlight": highlights[0] if highlights else "",
            "tagline": d.get("description", ""),
            "unsplash_kw": f"{name} India {state}",
            "news_kw": f"{name} tourism OR {name} travel OR {state}",
            "languages": d.get("languages", ["Hindi"]),
            "category": categories,
            "highlights_full": highlights,
            "altitude_m": d.get("altitude_m", 0),
            "nearest_airport": d.get("nearest_airport", ""),
        }
    return dests


DESTINATIONS = _load_destinations()

# ── Derived helpers (computed once at import time) ────────────────────────

# Maps every accepted name form → canonical lowercase key
_NAME_TO_KEY: dict[str, str] = {}
for _k, _d in DESTINATIONS.items():
    _NAME_TO_KEY[_k] = _k  # "varanasi"
    _NAME_TO_KEY[_k.title()] = _k  # "Varanasi"
    _NAME_TO_KEY[_d["label"]] = _k  # "Varanasi (Banaras)"


def _normalize_destination_name(name: str) -> str:
    """Normalize destination names for resilient lookups."""
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().strip().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _candidate_forms(name: str) -> set[str]:
    """Generate common alias forms for a destination name."""
    if not name:
        return set()

    forms = {
        name,
        name.replace("_", " "),
        name.replace("-", " "),
        name.replace("&", " and "),
        re.sub(r"\([^)]*\)", " ", name),
    }
    return {f.strip() for f in forms if f and f.strip()}


# Maps normalized names/forms → canonical lowercase key
_NORMALIZED_TO_KEY: dict[str, str] = {}
for _k, _d in DESTINATIONS.items():
    for _name in (
        _candidate_forms(_k)
        | _candidate_forms(_k.title())
        | _candidate_forms(_d["label"])
    ):
        _normalized = _normalize_destination_name(_name)
        if _normalized and _normalized not in _NORMALIZED_TO_KEY:
            _NORMALIZED_TO_KEY[_normalized] = _k

VALID_DESTINATION_NAMES: set[str] = set(_NAME_TO_KEY.keys())
"""All accepted destination name forms (key, title-cased key, label)."""


def resolve_destination_key(name: str) -> str | None:
    """Resolve a destination name to its canonical lowercase key.

    Supports exact match, normalized alias match, and safe fuzzy token match.
    """
    raw = (name or "").strip()
    if not raw:
        return None

    exact = _NAME_TO_KEY.get(raw)
    if exact:
        return exact

    normalized = _normalize_destination_name(raw)
    if not normalized:
        return None

    normalized_match = _NORMALIZED_TO_KEY.get(normalized)
    if normalized_match:
        return normalized_match

    # Safe fuzzy match for user-entered phrases like "jawai leopard"
    input_tokens = {t for t in normalized.split(" ") if len(t) >= 3}
    if not input_tokens:
        return None

    best_key = None
    best_score = 0.0

    for candidate_norm, candidate_key in _NORMALIZED_TO_KEY.items():
        candidate_tokens = {t for t in candidate_norm.split(" ") if len(t) >= 3}
        if not candidate_tokens:
            continue

        overlap = input_tokens & candidate_tokens
        if len(input_tokens) > 1 and len(overlap) < 2:
            continue

        coverage = len(overlap) / len(input_tokens)
        precision = len(overlap) / len(candidate_tokens)
        score = (coverage * 0.8) + (precision * 0.2)

        if coverage >= 0.75 and score > best_score:
            best_score = score
            best_key = candidate_key

    return best_key


DESTINATION_COORDS: dict = {
    key: {"lat": d["lat"], "lon": d["lon"], "label": d["label"]}
    for key, d in DESTINATIONS.items()
}
"""Maps service format: {key: {lat, lon, label}}"""

DESTINATION_UNSPLASH_KW: dict[str, str] = {
    key: d["unsplash_kw"] for key, d in DESTINATIONS.items()
}
"""Unsplash search keywords per destination."""

DESTINATION_NEWS_KW: dict[str, str] = {
    key: d["news_kw"] for key, d in DESTINATIONS.items()
}
"""News search keywords per destination."""

DESTINATION_LABELS: dict[str, str] = {
    key: d["label"] for key, d in DESTINATIONS.items()
}
"""Lowercase key → display label, e.g. {'goa': 'Goa', …}"""

# ---------------------------------------------------------------------------
# Budget: travel-class cost multipliers
# ---------------------------------------------------------------------------
TRAVEL_CLASS_MULTIPLIERS = {
    "economy": 1.0,
    "comfort": 1.6,
    "premium": 2.5,
}

# ---------------------------------------------------------------------------
# Safety: weight distribution for composite score
# ---------------------------------------------------------------------------
SAFETY_WEIGHTS = {
    "crime_score": 0.30,
    "health_score": 0.25,
    "infrastructure_score": 0.25,
    "tourist_friendliness": 0.20,
}

# ---------------------------------------------------------------------------
# Weather: temperature band labels (Celsius)
# ---------------------------------------------------------------------------
TEMP_BANDS = {
    "freezing": (-50, 0),
    "cold": (0, 10),
    "cool": (10, 20),
    "warm": (20, 30),
    "hot": (30, 40),
    "extreme_heat": (40, 60),
}

# ---------------------------------------------------------------------------
# API versioning prefix (for future use)
# ---------------------------------------------------------------------------
API_PREFIX = "/api"
API_VERSION = "v1"
