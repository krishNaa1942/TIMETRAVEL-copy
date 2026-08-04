#!/usr/bin/env python3
"""Seed the destinations table from data/india_destinations.json (Phase D1).

Idempotent: safe to run repeatedly; existing rows are refreshed from the
data files, never duplicated.

Usage:
    python scripts/seed_destinations.py
    DATABASE_URL=postgresql://... python scripts/seed_destinations.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("FLASK_ENV", "development")
os.environ.setdefault("TESTING", "0")

from app.main import create_app  # noqa: E402
from app.models.database import db  # noqa: E402


def main() -> int:
    app = create_app()
    with app.app_context():
        from app.services.seed_destinations import seed_destinations

        added, updated = seed_destinations()
    print(f"[seed] destinations: {added} added, {updated} updated")
    return 0 if added or updated else 0


if __name__ == "__main__":
    sys.exit(main())
