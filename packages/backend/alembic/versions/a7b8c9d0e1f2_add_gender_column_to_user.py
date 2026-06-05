"""add gender column to user

The earlier '849b057d03a4_add_gender_to_user' revision was mis-generated and
never actually added the column (it only changed report.final_report to JSONB).
The User model declares a `gender` enum column, so a fresh database ends up
missing it and user lookups fail. This revision creates the enum type and the
column for real.

Revision ID: a7b8c9d0e1f2
Revises: d7e8f9a0b1c2
Create Date: 2026-06-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    gender_enum = sa.Enum("male", "female", "unspecified", name="gender")
    gender_enum.create(op.get_bind(), checkfirst=True)
    op.add_column("user", sa.Column("gender", gender_enum, nullable=True))


def downgrade() -> None:
    op.drop_column("user", "gender")
    sa.Enum(name="gender").drop(op.get_bind(), checkfirst=True)
