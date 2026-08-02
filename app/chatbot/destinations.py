"""
Destination Entity Extraction
=============================
Recognizes destination names from the app's curated destination list
(`data/india_destinations.json`) inside free-text user messages, so chat
responses can acknowledge the named place.

The lexicon is loaded lazily and cached; a missing or malformed dataset
degrades to no extraction rather than an error.
"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_DESTINATIONS_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "india_destinations.json"
)

_lexicon: Optional[Dict[str, str]] = None


def _load_lexicon() -> Dict[str, str]:
    """Return {lowercased name: canonical display name}, longest first."""
    global _lexicon
    if _lexicon is not None:
        return _lexicon

    names = []
    try:
        data = json.loads(_DESTINATIONS_PATH.read_text())
        names = [str(d["name"]) for d in data.get("destinations", [])]
    except (OSError, ValueError):
        logger.warning("Destination lexicon unavailable (%s)", _DESTINATIONS_PATH)

    _lexicon = {name.lower(): name for name in sorted(names, key=len, reverse=True)}
    return _lexicon


def extract_destination(message: str) -> Optional[str]:
    """
    Find the longest destination name mentioned in a message.

    Args:
        message: Raw user text.

    Returns:
        Canonical destination name, or None if none is mentioned.
    """
    text = message.strip().lower()
    if not text:
        return None
    for name in _load_lexicon():
        if re.search(rf"\b{re.escape(name)}\b", text):
            return _lexicon[name]
    return None
