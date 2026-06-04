"""Passwordless email authentication.

Flow:
    1. POST /auth/send-code   → generates OTP, stores its hash, sends email.
    2. POST /auth/verify-code → validates OTP, creates user if new, returns JWT tokens.
    3. POST /auth/refresh     → exchanges a valid (allow-listed) refresh token for a new access token.
    4. POST /auth/logout      → revokes a refresh token server-side.

Dev-only:
    POST /auth/dev-login → skips OTP, returns tokens directly (only in development).
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update

from src.core.email import send_login_code
from src.core.logging import get_logger
from src.core.ratelimit import limiter
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token_payload,
)
from src.core.settings import get_settings
from src.db.models import AuthCode, RefreshToken, User
from src.db.session import get_async_sessionmaker

router = APIRouter(prefix="/auth", tags=["auth"])
log = get_logger(__name__)


def _generate_code() -> str:
    # secrets.choice is cryptographically secure (unlike random.choices).
    return "".join(secrets.choice("0123456789") for _ in range(6))


def _hash_code(code: str) -> str:
    """SHA-256 hex digest of an OTP. Plaintext codes are never persisted."""
    return hashlib.sha256(code.encode()).hexdigest()


class SendCodeRequest(BaseModel):
    email: EmailStr


class SendCodeResponse(BaseModel):
    detail: str


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    is_new: bool


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: str


def _new_refresh_token(session, user_id: int) -> str:
    """Allow-list a fresh refresh-token ``jti`` and return the signed JWT."""
    jti = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=get_settings().refresh_token_expire_days
    )
    session.add(RefreshToken(jti=jti, user_id=user_id, expires_at=expires_at))
    return create_refresh_token(user_id, jti)


async def _issue_tokens(session, user: User, is_new: bool) -> TokenResponse:
    """Create access + refresh tokens and allow-list the refresh token's jti."""
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=_new_refresh_token(session, user.id),
        user_id=user.id,
        is_new=is_new,
    )


async def _get_or_create_user(session, email: str) -> tuple[User, bool]:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    is_new = user is None
    if is_new:
        user = User(name=email.split("@")[0], email=email, language="English")
        session.add(user)
        await session.flush()  # populate user.id before issuing tokens
    return user, is_new


@router.post("/send-code", response_model=SendCodeResponse)
@limiter.limit("5/hour")
async def send_code(request: Request, body: SendCodeRequest) -> SendCodeResponse:
    """Generate a 6-digit OTP and email it to the user.

    Only the SHA-256 hash of the code is stored. Invalidates any previously
    unused codes for the same email. Always returns 200 regardless of whether
    the email is registered (security: do not reveal account existence).
    """
    session_factory = get_async_sessionmaker()
    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    async with session_factory() as session:
        # Invalidate previous unused codes for this email
        old_codes = await session.execute(
            select(AuthCode)
            .where(AuthCode.email == body.email)
            .where(AuthCode.used.is_(False))
        )
        for old in old_codes.scalars().all():
            old.used = True

        session.add(AuthCode(
            email=body.email,
            code_hash=_hash_code(code),
            expires_at=expires_at,
            used=False,
        ))
        await session.commit()

    await send_login_code(email=body.email, code=code)
    return SendCodeResponse(detail="Code sent to your email.")


@router.post("/verify-code", response_model=TokenResponse)
@limiter.limit("10/hour")
async def verify_code(request: Request, body: VerifyCodeRequest) -> TokenResponse:
    """Verify OTP and return JWT tokens. Creates user on first login.

    Each unused code tracks a failed-attempt counter; once it exceeds
    ``OTP_MAX_ATTEMPTS`` the code is burned to thwart brute-force guessing.

    Raises:
        400: Invalid, expired, already used, or too-many-attempts code.
    """
    session_factory = get_async_sessionmaker()
    now = datetime.now(timezone.utc)
    max_attempts = get_settings().otp_max_attempts

    async with session_factory() as session:
        # Latest unused code for this email (regardless of the submitted value),
        # so a wrong guess increments that code's attempt counter.
        result = await session.execute(
            select(AuthCode)
            .where(AuthCode.email == body.email)
            .where(AuthCode.used.is_(False))
            .order_by(AuthCode.expires_at.desc())
        )
        auth_code = result.scalars().first()

        invalid = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code.",
        )

        if auth_code is None or auth_code.expires_at.replace(tzinfo=timezone.utc) < now:
            raise invalid

        if auth_code.attempts >= max_attempts:
            auth_code.used = True
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many attempts. Request a new code.",
            )

        if not secrets.compare_digest(auth_code.code_hash, _hash_code(body.code)):
            auth_code.attempts += 1
            await session.commit()
            raise invalid

        auth_code.used = True
        user, is_new = await _get_or_create_user(session, body.email)
        tokens = await _issue_tokens(session, user, is_new)
        await session.commit()

    return tokens


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("60/hour")
async def refresh(request: Request, body: RefreshRequest) -> RefreshResponse:
    """Exchange a refresh token for a fresh access + refresh token pair.

    The presented refresh token is rotated: it is revoked and replaced with a
    brand-new one. This gives active users a sliding session — they stay logged
    in indefinitely while they keep using the app, instead of being forced to
    re-authenticate a fixed number of days after their last login.

    Reuse detection: presenting an already-rotated (revoked) token is treated as
    a sign of theft — every refresh token for that user is revoked, forcing a
    fresh login on all devices.

    Raises:
        401: If the refresh token is missing, malformed, expired, wrong type,
             or has been revoked / is not in the server allowlist.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
    )
    try:
        payload = decode_token_payload(body.refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError:
        raise unauthorized

    jti = payload["jti"]
    if jti is None:
        raise unauthorized

    session_factory = get_async_sessionmaker()
    now = datetime.now(timezone.utc)
    async with session_factory() as session:
        row = (await session.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )).scalars().first()

        if row is None or row.expires_at.replace(tzinfo=timezone.utc) < now:
            raise unauthorized

        if row.revoked:
            # This token was already rotated away or logged out. A second use
            # means the stored token leaked — burn the whole family.
            await session.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == row.user_id)
                .values(revoked=True)
            )
            await session.commit()
            raise unauthorized

        # Rotate: burn the presented token and mint a fresh pair.
        row.revoked = True
        new_access = create_access_token(row.user_id)
        new_refresh = _new_refresh_token(session, row.user_id)
        await session.commit()

    return RefreshResponse(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: LogoutRequest) -> None:
    """Revoke a refresh token so it can no longer be used.

    Idempotent: an unknown or already-revoked token is treated as success
    (we never reveal whether a token existed).
    """
    try:
        payload = decode_token_payload(body.refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError:
        return None

    jti = payload["jti"]
    if jti is None:
        return None

    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        await session.execute(
            update(RefreshToken).where(RefreshToken.jti == jti).values(revoked=True)
        )
        await session.commit()
    return None


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(body: SendCodeRequest) -> TokenResponse:
    """Skip OTP and return tokens directly. Only available in development.

    Raises:
        403: When APP_ENV is not 'development'.
    """
    if get_settings().app_env != "development":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not available in production.")

    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        user, is_new = await _get_or_create_user(session, body.email)
        tokens = await _issue_tokens(session, user, is_new)
        await session.commit()

    return tokens
