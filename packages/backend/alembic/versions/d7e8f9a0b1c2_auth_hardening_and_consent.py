"""hash OTP codes, add refresh_token allowlist, add user consent

Revision ID: d7e8f9a0b1c2
Revises: c5d6e7f8a9b0
Create Date: 2026-06-03

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, Sequence[str], None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # auth_code: store a SHA-256 hash instead of the plaintext code.
    # Existing OTPs are ephemeral (<=10 min), so clearing them is safe.
    op.execute("DELETE FROM auth_code")
    op.drop_column('auth_code', 'code')
    op.add_column('auth_code', sa.Column('code_hash', sa.String(64), nullable=False))

    # refresh_token allowlist for revocable JWT refresh tokens.
    op.create_table(
        'refresh_token',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('jti', sa.String(64), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('ix_refresh_token_jti', 'refresh_token', ['jti'], unique=True)

    # GDPR consent timestamp.
    op.add_column('user', sa.Column('consent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'consent_at')
    op.drop_index('ix_refresh_token_jti', table_name='refresh_token')
    op.drop_table('refresh_token')
    op.drop_column('auth_code', 'code_hash')
    op.add_column('auth_code', sa.Column('code', sa.String(6), nullable=False, server_default=''))
