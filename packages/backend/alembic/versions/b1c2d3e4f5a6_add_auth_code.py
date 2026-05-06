"""add auth_code table

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-05-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'auth_code',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(250), nullable=False),
        sa.Column('code', sa.String(6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('ix_auth_code_email', 'auth_code', ['email'])


def downgrade() -> None:
    op.drop_index('ix_auth_code_email', table_name='auth_code')
    op.drop_table('auth_code')
