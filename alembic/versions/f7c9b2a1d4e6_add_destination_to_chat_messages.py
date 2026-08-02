"""add destination column to chat_messages

Revision ID: f7c9b2a1d4e6
Revises: a1b2c3d4e5f6
Create Date: 2026-08-02 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f7c9b2a1d4e6"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_messages", sa.Column("destination", sa.String(64), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "destination")
