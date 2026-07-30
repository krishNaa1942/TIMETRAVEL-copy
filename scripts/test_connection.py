"""Quick connectivity test for Supabase PostgreSQL. Requires env vars."""
import os
import sys

import psycopg2

HOST_POOLER = os.environ.get("SUPABASE_HOST_POOLER", "aws-1-ap-southeast-1.pooler.supabase.com")
HOST_DIRECT = os.environ.get("SUPABASE_HOST_DIRECT", "db.eylcswantcgqvcytcaqy.supabase.co")
PASSWORD = os.environ.get("SUPABASE_PASSWORD", "")

if not PASSWORD:
    print("FATAL: Set SUPABASE_PASSWORD environment variable to run this script.")
    sys.exit(1)

tests = [
    ("Pooler (6543)", HOST_POOLER, 6543, "postgres.eylcswantcgqvcytcaqy"),
    ("Direct pooler (5432)", HOST_POOLER, 5432, "postgres.eylcswantcgqvcytcaqy"),
    ("Direct DB (5432)", HOST_DIRECT, 5432, "postgres"),
]

for label, host, port, user in tests:
    try:
        conn = psycopg2.connect(
            host=host, port=port, user=user,
            password=PASSWORD, dbname="postgres",
            connect_timeout=10,
        )
        cur = conn.cursor()
        cur.execute("SELECT version()")
        ver = cur.fetchone()[0]
        print(f"{label}: SUCCESS — {ver[:40]}")
        conn.close()
    except Exception as e:
        msg = str(e).strip().split("\n")[0]
        print(f"{label}: FAILED — {msg}")
