"""initial_schema

Revision ID: 5b48fcd422ba
Revises: 
Create Date: 2026-07-28 20:43:12.374777

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5b48fcd422ba'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
