"""add client_id to entry for idempotent creates

POST /entries was at-least-once: the client sent a note, and if the response
never arrived — or if two syncs ran at the same time — it sent it again and
the server made a second row. Those duplicates reach the report prompts, where
the model reads one note written twice as the user emphasising something.

client_id is the device's own row id, stable across retries, so a repeat POST
can be recognised and answered with the existing row.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-08-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Nullable and unbackfilled: existing rows have no knowable client id, and
    inventing one would be a lie that the unique constraint then enforces.
    NULLs do not collide in Postgres, so those rows simply sit outside the
    constraint — they keep the old behaviour, while every entry written by an
    updated client is protected.
    """
    op.add_column("entry", sa.Column("client_id", sa.String(length=64), nullable=True))
    op.create_unique_constraint(
        "uq_entry_goal_client_id", "entry", ["goal_id", "client_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_entry_goal_client_id", "entry", type_="unique")
    op.drop_column("entry", "client_id")
