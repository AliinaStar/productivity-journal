"""add status bookkeeping to report

Gives every closed period a row whose status records what became of it, so
that a missing report can be told apart from a period with nothing to report
and from one whose generation failed. Previously all three looked identical —
no row — and the scheduler had no way to know which it was looking at.

Existing rows are backfilled to 'ready': every report written before this
migration exists precisely because its generation succeeded.

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-08-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_STATUS = sa.Enum(
    "pending", "running", "ready", "empty", "failed", name="report_status"
)


def upgrade() -> None:
    """Upgrade schema.

    ``status`` arrives with a server_default of 'pending' so the ALTER is
    valid against a live table, and is then corrected to 'ready' for the rows
    already there. The default stays on the column afterwards: a row inserted
    without an explicit status is by definition one nothing has happened to
    yet.

    ``active_days`` gains a default for the same reason — bookkeeping rows are
    written before any counting has been done, and the column is NOT NULL.
    """
    _STATUS.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "report",
        sa.Column("status", _STATUS, server_default="pending", nullable=False),
    )
    op.add_column(
        "report",
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "report",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("report", sa.Column("last_error", sa.String(length=500), nullable=True))

    op.execute("UPDATE report SET status = 'ready'")
    op.alter_column("report", "active_days", server_default="0")

    # The scheduler's hot query is "which of these periods are unresolved for
    # these users", which reads status alongside the uniqueness key.
    op.create_index(
        "ix_report_status_lookup",
        "report",
        ["status", "period", "period_start"],
    )


def downgrade() -> None:
    """Downgrade schema.

    Rows that never produced a report ('pending', 'running', 'empty',
    'failed') carry a NULL ``final_report`` and would read as broken reports
    once the status telling them apart is gone, so they are deleted rather
    than left behind.
    """
    op.drop_index("ix_report_status_lookup", table_name="report")
    op.execute("DELETE FROM report WHERE status <> 'ready'")
    op.alter_column("report", "active_days", server_default=None)
    op.drop_column("report", "last_error")
    op.drop_column("report", "started_at")
    op.drop_column("report", "attempts")
    op.drop_column("report", "status")
    _STATUS.drop(op.get_bind(), checkfirst=True)
