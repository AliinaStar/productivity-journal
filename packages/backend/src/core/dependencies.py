"""FastAPI dependency functions.

Shared dependencies injected via ``Depends()`` across all routers.
"""

from collections.abc import AsyncGenerator

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import decode_token
from src.db.models import User
from src.db.session import get_async_sessionmaker

_bearer_scheme = HTTPBearer(auto_error=True)


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for the duration of a request."""
    async with request.app.state.async_session() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> User:
    """Resolve the current user from the ``Authorization: Bearer <token>`` header.

    The access token is cryptographically verified (signature + expiry + type)
    before the user id is trusted, so it cannot be forged or impersonated.

    Raises:
        401: If the token is missing, malformed, expired, or not an access token.
        404: If the user encoded in a valid token no longer exists.
    """
    try:
        user_id = decode_token(credentials.credentials, expected_type="access")
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        user = await session.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return user
