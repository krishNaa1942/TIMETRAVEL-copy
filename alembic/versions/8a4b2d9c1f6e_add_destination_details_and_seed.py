"""add destination detail columns + seed destinations table

Revision ID: 8a4b2d9c1f6e
Revises: f7c9b2a1d4e6
Create Date: 2026-08-04 12:00:00.000000

Adds the rich destination metadata columns and seeds the table from
data/india_destinations.json (+ safety/budget baselines) so the
recommendation engines score real candidates instead of fallbacks.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "8a4b2d9c1f6e"
down_revision: Union[str, Sequence[str], None] = "f7c9b2a1d4e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_COLUMNS = [
    sa.Column("region", sa.String(64), nullable=True),
    sa.Column("categories", sa.JSON, nullable=True),
    sa.Column("highlights", sa.JSON, nullable=True),
    sa.Column("description", sa.Text, nullable=True),
    sa.Column("best_months", sa.JSON, nullable=True),
]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {col["name"] for col in inspector.get_columns("destinations")}
    for column in _NEW_COLUMNS:
        if column.name not in existing:
            op.add_column("destinations", column)

    # Seed data (idempotent; skips rows that already exist). Use the
    # migration's own engine so the correct database is seeded.
    from sqlalchemy.orm import Session

    from app.services.seed_destinations import seed_destinations

    with Session(op.get_bind()) as session:
        added, updated = seed_destinations(session)
    print(f"  [seed] destinations: {added} added, {updated} updated")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {col["name"] for col in inspector.get_columns("destinations")}
    for column in reversed(_NEW_COLUMNS):
        if column.name in existing:
            op.drop_column("destinations", column.name)
