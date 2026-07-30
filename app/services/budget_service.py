"""
Budget Estimation Service
==========================
Calculates a trip budget breakdown based on destination, duration,
family size, and travel class.  Uses baseline data from data/budget_baselines.json
and applies multipliers per travel class.

Designed to be extended with ML-based price prediction in future versions.
"""

import json
import logging
import threading

from app.models.schemas import BudgetRequest, BudgetEstimate
from app.utils.constants import TRAVEL_CLASS_MULTIPLIERS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load baseline data once at module level
# ---------------------------------------------------------------------------
_BASELINE_CACHE: dict = {}
_BASELINE_LOCK = threading.Lock()


def _load_baselines(path: str) -> dict:
    """Load and cache budget baselines from JSON file."""
    global _BASELINE_CACHE
    if not _BASELINE_CACHE:
        with _BASELINE_LOCK:
            if _BASELINE_CACHE:
                return _BASELINE_CACHE
            try:
                with open(path, "r") as fh:
                    _BASELINE_CACHE = json.load(fh)
                logger.info(
                    "Budget baselines loaded (%d destinations)", len(_BASELINE_CACHE)
                )
            except FileNotFoundError:
                logger.warning(
                    "Budget baselines file not found at %s – using defaults", path
                )
                _BASELINE_CACHE = {}
    return _BASELINE_CACHE


# ---------------------------------------------------------------------------
# Default per-day costs (INR) if destination is not in baselines
# ---------------------------------------------------------------------------
_DEFAULT_COSTS = {
    "accommodation": 1500.0,
    "food": 800.0,
    "transport": 500.0,
    "activities": 400.0,
    "miscellaneous": 300.0,
}


def estimate_budget(req: BudgetRequest, baselines_path: str) -> BudgetEstimate:
    """
    Compute a detailed budget estimate for a family trip.

    Args:
        req: Validated BudgetRequest with destination, days, family size, class.
        baselines_path: Filesystem path to budget_baselines.json.

    Returns:
        BudgetEstimate with per-category and total costs.
    """
    baselines = _load_baselines(baselines_path)
    dest_key = req.destination.strip().lower()

    # Fetch per-day costs for this destination (or fallback to defaults)
    costs = baselines.get(dest_key, _DEFAULT_COSTS)

    # Apply travel-class multiplier
    multiplier = TRAVEL_CLASS_MULTIPLIERS.get(req.travel_class, 1.0)

    # Calculate per-category totals
    accommodation = costs["accommodation"] * req.num_days * multiplier
    food = costs["food"] * req.num_days * req.family_size * multiplier
    transport = costs["transport"] * req.num_days * multiplier
    activities = costs["activities"] * req.num_days * req.family_size * multiplier
    miscellaneous = costs["miscellaneous"] * req.num_days * multiplier

    total = accommodation + food + transport + activities + miscellaneous

    return BudgetEstimate(
        destination=req.destination,
        num_days=req.num_days,
        family_size=req.family_size,
        travel_class=req.travel_class,
        accommodation=round(accommodation, 2),
        food=round(food, 2),
        transport=round(transport, 2),
        activities=round(activities, 2),
        miscellaneous=round(miscellaneous, 2),
        total=round(total, 2),
    )
