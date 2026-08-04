"""
Destination Seeding (Phase D1)
================================
Idempotently populate the ORM `destinations` table from
`data/india_destinations.json`, enriched with:

- `safety_score`   (0-10) from `data/safety_scores.json` (mean of sub-scores)
- `avg_daily_cost` (INR)  from `data/budget_baselines.json` (sum of breakdown)

Called by the alembic data migration (`alembic upgrade head`) and by
`scripts/seed_destinations.py` for dev databases.
"""

import json
import os
from typing import List

from app.models.database import db
from app.models.entities import Destination

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "data")

_SEASON_MONTHS = {
    "Winter": [12, 1, 2],
    "Summer": [3, 4, 5],
    "Monsoon": [6, 7, 8],
    "Post-monsoon": [9, 10, 11],
}


def _load_json(name: str):
    with open(os.path.join(_DATA_DIR, name), encoding="utf-8") as fh:
        return json.load(fh)


def _season_for(months: List[int]) -> str | None:
    """Map a best_months list to the season containing the most months."""
    if not months:
        return None
    best, best_count = None, 0
    for season, season_months in _SEASON_MONTHS.items():
        count = sum(1 for m in months if m in season_months)
        if count > best_count:
            best, best_count = season, count
    return best


def _safety_score_from(scores: dict) -> float | None:
    """Mean of the destination's sub-scores, clamped to the 0-10 check range."""
    values = [v for v in scores.values() if isinstance(v, (int, float))]
    if not values:
        return None
    mean = sum(values) / len(values)
    return round(max(0.0, min(10.0, mean)), 2)


def _daily_cost_from(baseline) -> float | None:
    """Sum of the per-category budget baseline (INR per day)."""
    if not isinstance(baseline, dict):
        return None
    total = sum(v for v in baseline.values() if isinstance(v, (int, float)))
    return total or None


def seed_destinations(session=None) -> tuple[int, int]:
    """Insert/update destinations from the JSON data files.

    `session` defaults to Flask-SQLAlchemy's db.session (app context);
    alembic migrations pass their own Session bound to the migration
    engine. Returns (added, updated) counts; safe to run repeatedly.
    """
    from app.models.database import db

    sess = session or db.session

    raw = _load_json("india_destinations.json")
    safety = _load_json("safety_scores.json")
    baselines = _load_json("budget_baselines.json")

    added = updated = 0
    for dest in raw.get("destinations", []):
        name = (dest.get("name") or "").strip()
        if not name:
            continue
        key = dest.get("id") or ""
        months = [m for m in (dest.get("best_months") or []) if isinstance(m, int)]

        payload = {
            "country": "India",
            "latitude": dest.get("lat"),
            "longitude": dest.get("lng"),
            "safety_score": _safety_score_from(safety.get(key, {})),
            "avg_daily_cost": _daily_cost_from(baselines.get(key)),
            "best_season": _season_for(months),
            "region": dest.get("region"),
            "categories": dest.get("category") or [],
            "highlights": dest.get("highlights") or [],
            "description": dest.get("description"),
            "best_months": months,
        }

        existing = sess.query(Destination).filter_by(name=name).first()
        if existing:
            for field, value in payload.items():
                if value is not None:
                    setattr(existing, field, value)
            updated += 1
        else:
            sess.add(Destination(name=name, **payload))
            added += 1

    sess.commit()
    return added, updated
