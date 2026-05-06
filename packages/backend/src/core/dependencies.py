"""FastAPI dependency functions.

Shared dependencies injected via ``Depends()`` across all routers.
"""

from collections.abc import AsyncGenerator

from fastapi import Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for the duration of a request."""
    async with request.app.state.async_session() as session:
        yield session


async def get_current_user(x_user_id: int = Header(...)) -> User:
    """Resolve the current user from the ``X-User-ID`` request header.

    The mobile client stores ``user_id`` locally (in ``sync_meta``) after
    a successful ``POST /auth/verify-code`` and attaches it as a header on
    every subsequent request.

    Args:
        x_user_id: Value of the ``X-User-ID`` header, automatically parsed
                   by FastAPI from the header name ``x-user-id``.

    Returns:
        The ``User`` ORM object for the given ID.

    Raises:
        401: If the header is missing (FastAPI raises this automatically
             when a required ``Header`` parameter is absent).
        404: If no user with the given ID exists in the database.
    """
    raise NotImplementedError
