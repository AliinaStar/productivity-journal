"""replace birth_year with age_group

The exact ``birth_year`` was never read by report generation, so it was pure
data we did not need. It is replaced by a coarse ``age_group`` enum whose
lowest bucket starts at 13 — the UI offers no under-13 option, which is how the
app screens out children (privacy policy §7). Old birth_year values are dropped
rather than bucketed: they were unused, and mapping them would just re-collect
data we are trying to minimise.

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-07-24

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e9f0a1b2c3d4"
down_revision: Union[str, Sequence[str], None] = "d8e9f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old column (its CHECK constraint goes with it). IF EXISTS mirrors
    # the repo's tolerance for dev DBs whose alembic_version lags the schema.
    op.execute('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS check_birth_year')
    op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS birth_year')

    age_group_enum = sa.Enum(
        "13-17", "18-24", "25-34", "35-44", "45-54", "55+", name="age_group"
    )
    age_group_enum.create(op.get_bind(), checkfirst=True)
    op.execute('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS age_group age_group')


def downgrade() -> None:
    op.execute('ALTER TABLE "user" DROP COLUMN IF EXISTS age_group')
    sa.Enum(name="age_group").drop(op.get_bind(), checkfirst=True)

    op.execute(
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS birth_year INTEGER'
    )
    op.create_check_constraint(
        "check_birth_year", "user", "birth_year BETWEEN 1900 AND 2100"
    )
