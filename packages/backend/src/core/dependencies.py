"""FastAPI dependency functions.

Shared dependencies injected via ``Depends()`` across all routers.
"""

from collections.abc import AsyncGenerator
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import decode_token
from src.db.models import User

_bearer_scheme = HTTPBearer(auto_error=True)

MAX_PAGE_LIMIT = 100


@dataclass
class Pagination:
    limit: int
    offset: int


def get_pagination(
    limit: int = Query(50, ge=1, le=MAX_PAGE_LIMIT),
    offset: int = Query(0, ge=0),
) -> Pagination:
    """Standard list pagination: ``?limit=&offset=`` with a hard cap of 100."""
    return Pagination(limit=limit, offset=offset)


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for the duration of a request."""
    async with request.app.state.async_session() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the current user from the ``Authorization: Bearer <token>`` header.

    The access token is cryptographically verified (signature + expiry + type)
    before the user id is trusted, so it cannot be forged or impersonated.

    Uses the shared per-request session from ``get_db`` — FastAPI caches
    dependencies within a request, so routes that also depend on ``get_db``
    get the same session (one DB session per request).

    Raises:
        401: If the token is missing, malformed, expired, not an access token,
             or the user encoded in it no longer exists (e.g. account deleted) —
             from the client's perspective the session is simply no longer valid.
    """
    try:
        user_id = decode_token(credentials.credentials, expected_type="access")
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await session.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
