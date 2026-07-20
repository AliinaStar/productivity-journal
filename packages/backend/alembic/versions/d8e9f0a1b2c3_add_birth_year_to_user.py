"""add birth_year to user

Optional demographic field on User. A birth year (not an age) so the value
never goes stale. Nullable: existing users have no known birth year, and it
stays optional for new ones. A static CHECK guards against garbage; the tight
"not from the future" bound is enforced in the API layer.

Revision ID: d8e9f0a1b2c3
Revises: c6d7e8f9a0b1
Create Date: 2026-07-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d8e9f0a1b2c3"
down_revision: Union[str, Sequence[str], None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF NOT EXISTS: dev databases may already have the column via
    # metadata.create_all while alembic_version lags behind (same pattern as
    # the gender migration).
    op.execute('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS birth_year INTEGER')
    op.create_check_constraint(
        "check_birth_year", "user", "birth_year BETWEEN 1900 AND 2100"
    )


def downgrade() -> None:
    op.drop_constraint("check_birth_year", "user", type_="check")
    op.drop_column("user", "birth_year")
