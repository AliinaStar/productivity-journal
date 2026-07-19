"""add entry timestamps and report generation metrics

Revision ID: c6d7e8f9a0b1
Revises: b2c3d4e5f6a7
Create Date: 2026-07-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    All four columns are nullable, which also makes this migration safe to
    run against a live table: no rewrite, no default backfill, no lock held
    while ~1500 existing entry rows are touched.
    """
    # Two steps on purpose. `ADD COLUMN ... DEFAULT now()` would also stamp
    # every *existing* row with the migration time, inventing a spike of
    # ~1500 entries "written" at deploy — corrupting the very analysis these
    # columns exist for. Adding the column bare leaves old rows NULL
    # ("unknown"), and SET DEFAULT afterwards only affects new inserts.
    op.add_column(
        "entry",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("ALTER TABLE entry ALTER COLUMN created_at SET DEFAULT now()")

    op.add_column(
        "entry",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("ALTER TABLE entry ALTER COLUMN updated_at SET DEFAULT now()")

    op.add_column("report", sa.Column("tokens_used", sa.Integer(), nullable=True))
    op.add_column("report", sa.Column("generation_time", sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("report", "generation_time")
    op.drop_column("report", "tokens_used")
    op.drop_column("entry", "updated_at")
    op.drop_column("entry", "created_at")
