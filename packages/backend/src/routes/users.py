"""User profile, consent, data export and account deletion (GDPR)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import delete, select

from src.core.dependencies import get_current_user
from src.db.models import AuthCode, Entry, Goal, RefreshToken, Report, User
from src.db.session import get_async_sessionmaker

router = APIRouter(prefix="/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    language: str | None = None
    gender: str | None = None


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
) -> ProfileResponse:
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        user = await session.get(User, current_user.id)

        if body.name is not None:
            user.name = body.name
        if body.language is not None:
            user.language = body.language
        if body.gender is not None:
            user.gender = body.gender

        await session.commit()
        await session.refresh(user)

    return _profile(user)


@router.post("/me/consent", response_model=ProfileResponse)
async def accept_consent(
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    """Record that the user accepted the privacy policy (GDPR consent)."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        user = await session.get(User, current_user.id)
        user.consent_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(user)
    return _profile(user)


@router.get("/me/export")
async def export_data(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return all of the user's data as JSON (GDPR data portability)."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
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
) -> None:
    """Permanently delete the user and all associated data (GDPR erasure)."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
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
