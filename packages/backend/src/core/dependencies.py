"""FastAPI dependency functions.

Shared dependencies injected via ``Depends()`` across all routers.
"""

from collections.abc import AsyncGenerator

from fastapi import Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User
from src.db.session import get_async_sessionmaker


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for the duration of a request."""
    async with request.app.state.async_session() as session:
        yield session


async def get_current_user(x_user_id: int = Header(...)) -> User:
    """Resolve the current user from the ``X-User-ID`` request header.

    Raises:
        401: If the header is missing.
        404: If no user with the given ID exists in the database.
    """
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        user = await session.get(User, x_user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return user
