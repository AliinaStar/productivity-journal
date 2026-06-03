"""JWT token creation and validation.

Two token types are issued on successful login:
  - ``access``  – short-lived, sent on every API request as a Bearer token.
  - ``refresh`` – long-lived, exchanged at ``/auth/refresh`` for a new access token.

The signing secret comes from ``AppSettings.jwt_secret``. In production an empty
secret is rejected at startup (see ``settings._require_secrets_in_production``);
in development a fixed, clearly-insecure fallback is used so the app boots without
configuration.
"""

from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt

from src.core.settings import get_settings

# Used only when no JWT_SECRET is configured in a non-production environment.
_DEV_FALLBACK_SECRET = "dev-insecure-secret-do-not-use-in-production"

TokenType = Literal["access", "refresh"]


def _secret() -> str:
    settings = get_settings()
    if settings.jwt_secret:
        return settings.jwt_secret
    # Defence in depth: the insecure fallback is only ever acceptable in dev.
    # (Settings validation already blocks an empty secret outside development.)
    if settings.app_env != "development":
        raise RuntimeError("JWT_SECRET is required outside development.")
    return _DEV_FALLBACK_SECRET


def _create_token(
    user_id: int,
    token_type: TokenType,
    expires_delta: timedelta,
    jti: str | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if jti is not None:
        payload["jti"] = jti
    return jwt.encode(payload, _secret(), algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    return _create_token(
        user_id, "access", timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(user_id: int, jti: str) -> str:
    """Create a refresh token carrying a unique ``jti`` for server-side revocation."""
    settings = get_settings()
    return _create_token(
        user_id, "refresh", timedelta(days=settings.refresh_token_expire_days), jti=jti
    )


def decode_token(token: str, expected_type: TokenType) -> int:
    """Decode and validate a JWT, returning the user id (``sub``).

    Raises:
        jwt.InvalidTokenError: If the signature/expiry is invalid, or the token
            is not of ``expected_type``.
    """
    return decode_token_payload(token, expected_type)["user_id"]


def decode_token_payload(token: str, expected_type: TokenType) -> dict:
    """Decode and validate a JWT, returning ``{"user_id": int, "jti": str | None}``.

    Raises:
        jwt.InvalidTokenError: If the signature/expiry is invalid, or the token
            is not of ``expected_type``.
    """
    settings = get_settings()
    payload = jwt.decode(token, _secret(), algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Expected {expected_type} token.")
    sub = payload.get("sub")
    if sub is None:
        raise jwt.InvalidTokenError("Missing subject claim.")
    return {"user_id": int(sub), "jti": payload.get("jti")}
