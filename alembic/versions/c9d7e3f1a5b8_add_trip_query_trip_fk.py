"""add trip_queries.trip_id FK linking analytics rows to workspace trips

Revision ID: c9d7e3f1a5b8
Revises: 8a4b2d9c1f6e
Create Date: 2026-08-04 12:10:00.000000

Unifies TripQuery (budget-estimate analytics rows) with Trip (workspace
entity): the FK gives an explicit migration path for linking a planning
query to the trip it eventually becomes.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c9d7e3f1a5b8"
down_revision: Union[str, Sequence[str], None] = "8a4b2d9c1f6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = {col["name"] for col in inspector.get_columns("trip_queries")}
    if "trip_id" not in existing:
        op.add_column(
            "trip_queries",
            sa.Column("trip_id", sa.Integer(), nullable=True),
        )
    op.create_index(
        "ix_trip_queries_trip_id", "trip_queries", ["trip_id"], if_not_exists=True
    )

    # Re-point legacy child FKs from trip_queries.id -> trips.id (D2 unify).
    # SQLite (dev) does not enforce FKs, so only PostgreSQL needs the swap.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table, old_fk in (
            ("shared_trips", "shared_trips_trip_id_fkey"),
            ("expenses", "expenses_trip_id_fkey"),
        ):
            constraints = {
                c["name"] for c in sa.inspect(bind).get_foreign_keys(table)
            }
            if old_fk in constraints:
                op.drop_constraint(old_fk, table, type_="foreignkey")
                op.create_foreign_key(
                    f"{old_fk}",
                    table,
                    "trips",
                    ["trip_id"],
                    ["id"],
                    ondelete="CASCADE",
                )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table, old_fk in (
            ("shared_trips", "shared_trips_trip_id_fkey"),
            ("expenses", "expenses_trip_id_fkey"),
        ):
            constraints = {
                c["name"] for c in sa.inspect(bind).get_foreign_keys(table)
            }
            if old_fk in constraints:
                op.drop_constraint(old_fk, table, type_="foreignkey")
                op.create_foreign_key(
                    old_fk, table, "trip_queries", ["trip_id"], ["id"]
                )
    op.drop_index("ix_trip_queries_trip_id", table_name="trip_queries")
    op.drop_column("trip_queries", "trip_id")
