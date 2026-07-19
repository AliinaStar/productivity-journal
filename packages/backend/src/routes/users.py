"""User profile, consent, data export and account deletion (GDPR)."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_user, get_db
from src.db.models import AuthCode, Entry, Goal, RefreshToken, Report, User

router = APIRouter(prefix="/users", tags=["users"])


# Field limits mirror the DB columns (user.name String(100), user.language
# String(50), user.gender enum) so bad input fails with 422, not a DB error.
class UpdateProfileRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    language: str | None = Field(default=None, max_length=50)
    gender: Literal["male", "female", "unspecified"] | None = None


class PushTokenRequest(BaseModel):
    # None unregisters the device (e.g. on logout or revoked permission).
    token: str | None = Field(default=None, max_length=100)


class ProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    language: str
    gender: str | None
    consent_at: str | None


def _profile(user: User) -> ProfileResponse:
    return ProfileResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        language=user.language,
        gender=user.gender,
        consent_at=user.consent_at.isoformat() if user.consent_at else None,
    )


@router.get("/me", response_model=ProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    return _profile(current_user)


@router.patch("/me", response_model=ProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    # current_user is attached to this request's session, so it can be
    # modified and committed directly.
    if body.name is not None:
        current_user.name = body.name
    if body.language is not None:
        current_user.language = body.language
    if body.gender is not None:
        current_user.gender = body.gender

    await session.commit()
    await session.refresh(current_user)

    return _profile(current_user)


@router.post("/me/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def set_push_token(
    body: PushTokenRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Register (or clear) the Expo push token for the user's device."""
    current_user.expo_push_token = body.token
    await session.commit()
    return None


@router.post("/me/consent", response_model=ProfileResponse)
async def accept_consent(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """Record that the user accepted the privacy policy (GDPR consent)."""
    current_user.consent_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(current_user)
    return _profile(current_user)


@router.get("/me/export")
async def export_data(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Return all of the user's data as JSON (GDPR data portability)."""
    goals = (await session.execute(
        select(Goal).where(Goal.user_id == current_user.id)
    )).scalars().all()

    entries = (await session.execute(
        select(Entry).join(Goal, Entry.goal_id == Goal.id)
        .where(Goal.user_id == current_user.id)
    )).scalars().all()

    reports = (await session.execute(
        select(Report).where(Report.user_id == current_user.id)
    )).scalars().all()

    return {
        "profile": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "language": current_user.language,
            "gender": current_user.gender,
            "consent_at": current_user.consent_at.isoformat() if current_user.consent_at else None,
        },
        "goals": [
            {
                "id": g.id,
                "title": g.title,
                "description": g.description,
                "deadline": g.deadline.isoformat() if g.deadline else None,
                "created_at": g.created_at.isoformat(),
                "status": g.status,
            }
            for g in goals
        ],
        "entries": [
            {
                "id": e.id,
                "goal_id": e.goal_id,
                "date_note": e.date_note.isoformat(),
                "note": e.note,
                "productivity_score": e.productivity_score,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
        "reports": [
            {
                "id": r.id,
                "period": r.period,
                "period_start": r.period_start.isoformat(),
                "period_end": r.period_end.isoformat(),
                "avg_productivity": r.avg_productivity,
                "active_days": r.active_days,
                "created_at": r.created_at.isoformat(),
                "final_report": r.final_report,
            }
            for r in reports
        ],
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete the user and all associated data (GDPR erasure)."""
    goal_ids = (await session.execute(
        select(Goal.id).where(Goal.user_id == current_user.id)
    )).scalars().all()

    if goal_ids:
        await session.execute(delete(Entry).where(Entry.goal_id.in_(goal_ids)))
    await session.execute(delete(Goal).where(Goal.user_id == current_user.id))
    await session.execute(delete(Report).where(Report.user_id == current_user.id))
    await session.execute(delete(RefreshToken).where(RefreshToken.user_id == current_user.id))
    await session.execute(delete(AuthCode).where(AuthCode.email == current_user.email))
    await session.execute(delete(User).where(User.id == current_user.id))
    await session.commit()
    return None
