"""Passwordless email authentication.

Flow:
    1. POST /auth/send-code  → generates OTP, stores in DB, sends email.
    2. POST /auth/verify-code → validates OTP, creates user if new, returns user_id.

Dev-only:
    POST /auth/dev-login → skips OTP, returns user_id directly (only in development).
"""

import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from src.core.email import send_login_code
from src.core.settings import get_settings
from src.db.models import AuthCode, User
from src.db.session import get_async_sessionmaker

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


class SendCodeRequest(BaseModel):
    email: EmailStr


class SendCodeResponse(BaseModel):
    detail: str


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class VerifyCodeResponse(BaseModel):
    user_id: int
    is_new: bool


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(body: SendCodeRequest) -> SendCodeResponse:
    """Generate a 6-digit OTP and email it to the user.

    Invalidates any previously unused codes for the same email before
    creating a new one. Always returns 200 regardless of whether the
    email is registered (security: do not reveal account existence).
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
            code=code,
            expires_at=expires_at,
            used=False,
        ))
        await session.commit()

    await send_login_code(email=body.email, code=code)
    return SendCodeResponse(detail="Code sent to your email.")


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(body: VerifyCodeRequest) -> VerifyCodeResponse:
    """Verify OTP and return user_id. Creates user on first login.

    Raises:
        400: Invalid, expired, or already used code.
    """
    session_factory = get_async_sessionmaker()
    now = datetime.now(timezone.utc)

    async with session_factory() as session:
        result = await session.execute(
            select(AuthCode)
            .where(AuthCode.email == body.email)
            .where(AuthCode.code == body.code)
            .where(AuthCode.used.is_(False))
            .order_by(AuthCode.expires_at.desc())
        )
        auth_code = result.scalars().first()

        if auth_code is None or auth_code.expires_at.replace(tzinfo=timezone.utc) < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired code.",
            )

        auth_code.used = True

        # Find or create user
        user_result = await session.execute(
            select(User).where(User.email == body.email)
        )
        user = user_result.scalars().first()

        is_new = user is None
        if is_new:
            user = User(
                name=body.email.split("@")[0],
                email=body.email,
                language="English",
            )
            session.add(user)

        await session.commit()
        await session.refresh(user)

    return VerifyCodeResponse(user_id=user.id, is_new=is_new)


@router.post("/dev-login", response_model=VerifyCodeResponse)
async def dev_login(body: SendCodeRequest) -> VerifyCodeResponse:
    """Skip OTP and return user_id directly. Only available in development.

    Raises:
        403: When APP_ENV is not 'development'.
    """
    if get_settings().app_env != "development":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not available in production.")

    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(select(User).where(User.email == body.email))
        user = result.scalars().first()

        is_new = user is None
        if is_new:
            user = User(
                name=body.email.split("@")[0],
                email=body.email,
                language="English",
            )
            session.add(user)

        await session.commit()
        await session.refresh(user)

    return VerifyCodeResponse(user_id=user.id, is_new=is_new)
