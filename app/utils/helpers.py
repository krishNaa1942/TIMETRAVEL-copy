"""
Helper Utilities
=================
Small, reusable utility functions used across the application.
"""

import re


def sanitise_destination(name: str) -> str:
    """
    Normalise a destination name for consistent lookups.

    - Strips whitespace
    - Title-cases the name
    - Removes non-alphanumeric characters (except spaces and hyphens)

    >>> sanitise_destination("  goa  ")
    'Goa'
    >>> sanitise_destination("new-delhi")
    'New-Delhi'
    """
    name = name.strip()
    name = re.sub(r"[^a-zA-Z0-9\s\-]", "", name)
    return name.title()


def clamp(value: float, low: float, high: float) -> float:
    """Clamp a value between low and high bounds (inclusive)."""
    return max(low, min(high, value))


def safe_float(value, default: float = 0.0) -> float:
    """Convert to float safely, returning default on failure."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default: int = 0) -> int:
    """Convert to int safely, returning default on failure."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def truncate(text: str, max_length: int = 200) -> str:
    """Truncate text to max_length, adding ellipsis if needed."""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."
