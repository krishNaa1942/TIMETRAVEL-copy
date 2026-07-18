#!/usr/bin/env python3
"""
SQLite → Supabase PostgreSQL Migration
========================================
Reads all data from the local SQLite database and inserts it into the
Supabase PostgreSQL database.

Usage:
    # 1. Set DATABASE_URL to point to your Supabase PostgreSQL.
    # 2. Run this script:
    python scripts/migrate_to_supabase.py

    # Dry-run (shows counts without writing):
    python scripts/migrate_to_supabase.py --dry-run

Prerequisites:
    • SUPABASE_URL & SUPABASE_KEY (or DATABASE_URL) in .env
    • The Supabase PostgreSQL database should be empty
      (or at minimum the tables should exist — ``create_all()`` runs
      automatically on app startup).
    • ``pip install psycopg2-binary`` (already in requirements.txt)

Safety:
    • Read-only on the SQLite source — the local DB is never modified.
    • Uses ``INSERT … ON CONFLICT DO NOTHING`` semantics so re-running
      is safe (duplicates are skipped, not overwritten).
"""

import os
import sys
import argparse
import sqlite3
import logging

# Add project root to path so we can import the app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("migrate")

# ---------------------------------------------------------------------------
# Ordered list of tables to migrate (respects FK dependencies)
# ---------------------------------------------------------------------------
TABLES = [
    "users",
    "destinations",
    "trip_queries",
    "chat_messages",
    "favorites",
    "travel_notes",
    "shared_trips",
    "expenses",
    "packing_items",
    "trips",
    "trip_days",
    "trip_places",
    "reservations",
    "trip_photos",
    "trip_documents",
    "companions",
    "trip_templates",
    "newsletter_subscribers",
]


def get_sqlite_path() -> str:
    """Locate the SQLite database file."""
    candidates = [
        os.path.join("instance", "timetravel.db"),
        os.path.join("timetravel.db"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return os.path.abspath(p)
    logger.error("No SQLite database found (checked %s)", candidates)
    sys.exit(1)


def read_sqlite(db_path: str) -> dict:
    """Read all rows from every table in the SQLite database.

    Returns ``{table_name: [dict, …], …}`` for tables that exist.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Discover which tables actually exist in this database
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing = {row["name"] for row in cursor.fetchall()}

    data = {}
    for table in TABLES:
        if table not in existing:
            logger.warning("  Table '%s' not found in SQLite — skipping", table)
            continue
        rows = cursor.execute(f"SELECT * FROM [{table}]").fetchall()  # noqa: S608
        data[table] = [dict(row) for row in rows]

    conn.close()
    return data


def migrate(dry_run: bool = False):
    """Run the migration."""
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url or "postgresql" not in db_url:
        logger.error(
            "DATABASE_URL is not set or does not point to PostgreSQL.\n"
            "Set it to your Supabase connection string, e.g.:\n"
            "  DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
        )
        sys.exit(1)

    # Fix Supabase postgres:// scheme
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    sqlite_path = get_sqlite_path()
    logger.info("Source:  %s", sqlite_path)
    logger.info("Target:  %s", db_url.split("@")[-1] if "@" in db_url else "(PostgreSQL)")

    # Read source data
    logger.info("Reading SQLite data …")
    data = read_sqlite(sqlite_path)

    total_rows = sum(len(rows) for rows in data.values())
    logger.info("Found %d rows across %d tables", total_rows, len(data))

    if total_rows == 0:
        logger.info("Nothing to migrate — SQLite is empty.")
        return

    for tbl, rows in data.items():
        logger.info("  %-25s %5d rows", tbl, len(rows))

    if dry_run:
        logger.info("Dry run — no data written to PostgreSQL.")
        return

    # Write to PostgreSQL via SQLAlchemy (uses the app's models so
    # auto-increment sequences, defaults, etc. are preserved).
    logger.info("Connecting to PostgreSQL …")

    from app.main import create_app
    from app.models.database import db as sa_db

    app = create_app()
    with app.app_context():
        conn = sa_db.engine.raw_connection()
        cursor = conn.cursor()

        migrated = 0
        skipped = 0

        for tbl in TABLES:
            rows = data.get(tbl, [])
            if not rows:
                continue

            cols = list(rows[0].keys())
            col_list = ", ".join(f'"{c}"' for c in cols)
            placeholders = ", ".join(["%s"] * len(cols))

            for row in rows:
                values = [row[c] for c in cols]
                try:
                    cursor.execute(
                        f'INSERT INTO "{tbl}" ({col_list}) VALUES ({placeholders}) '
                        f"ON CONFLICT DO NOTHING",
                        values,
                    )
                    if cursor.rowcount > 0:
                        migrated += 1
                    else:
                        skipped += 1
                except Exception as exc:
                    logger.warning("  Skip %s row: %s", tbl, exc)
                    conn.rollback()
                    skipped += 1
                    continue

            conn.commit()
            logger.info("  ✓ %s — %d rows inserted", tbl, len(rows))

        # Reset sequences for auto-increment columns
        for tbl in TABLES:
            rows = data.get(tbl, [])
            if not rows or "id" not in rows[0]:
                continue
            max_id = max(r["id"] for r in rows)
            try:
                cursor.execute(
                    f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), %s, true)",
                    (max_id,),
                )
                conn.commit()
            except Exception:
                conn.rollback()

        cursor.close()
        conn.close()

        logger.info("─── Migration Complete ───")
        logger.info("  Inserted: %d  |  Skipped: %d", migrated, skipped)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate local SQLite data to Supabase PostgreSQL"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show counts without writing to PostgreSQL",
    )
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
