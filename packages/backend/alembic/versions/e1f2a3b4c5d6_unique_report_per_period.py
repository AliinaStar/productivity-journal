"""Unique report per (user, period, period_start).

Deduplicates existing rows (keeping the newest) and adds a unique
constraint so retried scheduler runs can never create duplicates.

Revision ID: e1f2a3b4c5d6
Revises: a7b8c9d0e1f2
Create Date: 2026-06-12
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "e1f2a3b4c5d6"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove duplicates first, keeping the most recently created row (highest id).
    op.execute(
        """
        DELETE FROM report r
        USING report newer
        WHERE r.user_id = newer.user_id
          AND r.period = newer.period
          AND r.period_start = newer.period_start
          AND r.id < newer.id
        """
    )
    op.create_unique_constraint(
        "uq_report_user_period_start",
        "report",
        ["user_id", "period", "period_start"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_report_user_period_start", "report", type_="unique")
