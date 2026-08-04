"""initial_schema

Revision ID: 5b48fcd422ba
Revises:
Create Date: 2026-07-28 20:43:12.374777

Brings the database fully in sync with the ORM models by creating every
table from ``db.metadata`` (a real ``create_all()`` equivalent).

"""
from typing import Sequence, Union

from alembic import op

from app.models.database import db
import app.models.entities  # noqa: F401 — ensures every model is registered


revision: str = '5b48fcd422ba'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    db.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    db.metadata.drop_all(bind=op.get_bind())