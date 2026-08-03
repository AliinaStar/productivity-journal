"""add timezone to user

Stores the device's IANA zone so period boundaries can be resolved per user
instead of globally in UTC. Both the entry edit window and report generation
read it (see ``src/core/periods.py``).

Revision ID: f1a2b3c4d5e6
Revises: e9f0a1b2c3d4
Create Date: 2026-08-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Nullable with no default, so the migration is a metadata-only change on a
    live table. NULL is meaningful: "this user's zone is unknown", which the
    application reads as UTC — exactly how every user behaved before this
    column existed. Backfilling a guess would silently move people's week
    boundaries.
    """
    op.add_column("user", sa.Column("timezone", sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("user", "timezone")
