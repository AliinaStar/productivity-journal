"""add hnsw index on entry.embedding for cosine similarity search

Revision ID: a1b2c3d4e5f6
Revises: f3e2d1c0b9a8
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f3e2d1c0b9a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX ix_entry_embedding_hnsw
        ON entry
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_entry_embedding_hnsw")
