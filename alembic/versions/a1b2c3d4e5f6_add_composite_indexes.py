"""add composite indexes on (user_id, created_at)

Revision ID: a1b2c3d4e5f6
Revises: 5b48fcd422ba
Create Date: 2026-07-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '5b48fcd422ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_trip_queries_user_created", "trip_queries", ["user_id", "created_at"])
    op.create_index("ix_chat_messages_user_created", "chat_messages", ["user_id", "created_at"])
    op.create_index("ix_favorites_user_created", "favorites", ["user_id", "created_at"])
    op.create_index("ix_travel_notes_user_created", "travel_notes", ["user_id", "created_at"])
    op.create_index("ix_shared_trips_user_created", "shared_trips", ["user_id", "created_at"])
    op.create_index("ix_expenses_user_created", "expenses", ["user_id", "created_at"])
    op.create_index("ix_packing_items_user_created", "packing_items", ["user_id", "created_at"])
    op.create_index("ix_trips_user_created", "trips", ["user_id", "created_at"])
    op.create_index("ix_reservations_user_created", "reservations", ["user_id", "created_at"])
    op.create_index("ix_trip_photos_user_created", "trip_photos", ["user_id", "created_at"])
    op.create_index("ix_trip_documents_user_created", "trip_documents", ["user_id", "created_at"])
    op.create_index("ix_companions_user_created", "companions", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_trip_queries_user_created")
    op.drop_index("ix_chat_messages_user_created")
    op.drop_index("ix_favorites_user_created")
    op.drop_index("ix_travel_notes_user_created")
    op.drop_index("ix_shared_trips_user_created")
    op.drop_index("ix_expenses_user_created")
    op.drop_index("ix_packing_items_user_created")
    op.drop_index("ix_trips_user_created")
    op.drop_index("ix_reservations_user_created")
    op.drop_index("ix_trip_photos_user_created")
    op.drop_index("ix_trip_documents_user_created")
    op.drop_index("ix_companions_user_created")
