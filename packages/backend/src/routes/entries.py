"""Entries CRUD endpoints.

Matches the contract expected by ``api-client/entries.ts`` on the frontend.
Entries are scoped to goals that belong to the current user.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import Pagination, get_current_user, get_db, get_pagination
from src.db.models import Entry, Goal, User
from src.rag.embeddings import embed_text

router = APIRouter(prefix="/entries", tags=["entries"])

NOTE_MAX_LENGTH = 5000


def _validate_iso_date(value: str | None) -> str | None:
    if value is None:
        return value
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("date_note must be an ISO date (YYYY-MM-DD).") from exc
    return value


class EntryResponse(BaseModel):
    """Matches the ``RemoteEntry`` interface in ``api-client/entries.ts``."""

    id: int
    goal_id: int
    date_note: str
    note: str
    productivity_score: int


class CreateEntryRequest(BaseModel):
    goal_id: int
    date_note: str
    note: str = Field(min_length=1, max_length=NOTE_MAX_LENGTH)
    productivity_score: int = Field(ge=1, le=5)

    _check_date = field_validator("date_note")(_validate_iso_date)


class UpdateEntryRequest(BaseModel):
    note: str | None = Field(default=None, min_length=1, max_length=NOTE_MAX_LENGTH)
    productivity_score: int | None = Field(default=None, ge=1, le=5)
    date_note: str | None = None

    _check_date = field_validator("date_note")(_validate_iso_date)


def _to_response(entry: Entry) -> EntryResponse:
    return EntryResponse(
        id=entry.id,
        goal_id=entry.goal_id,
        date_note=entry.date_note.isoformat(),
        note=entry.note,
        productivity_score=entry.productivity_score,
    )


async def _embed(text: str) -> list[float]:
    return await embed_text(text)


@router.get("", response_model=list[EntryResponse])
async def list_entries(
    page: Pagination = Depends(get_pagination),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[EntryResponse]:
    result = await session.execute(
        select(Entry)
        .join(Goal, Entry.goal_id == Goal.id)
        .where(Goal.user_id == current_user.id)
        .order_by(Entry.date_note.desc(), Entry.id.desc())
        .limit(page.limit)
        .offset(page.offset)
    )
    entries = result.scalars().all()
    return [_to_response(e) for e in entries]


@router.post("", response_model=EntryResponse)
async def create_entry(
    body: CreateEntryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> EntryResponse:
    """Create a new entry and generate its embedding asynchronously.

    Raises:
        404: Goal not found or does not belong to the current user.
        422: productivity_score out of 1–5 range.
    """
    goal_result = await session.execute(
        select(Goal).where(Goal.id == body.goal_id, Goal.user_id == current_user.id)
    )
    if goal_result.scalars().first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")

    embedding = await _embed(body.note)
    entry = Entry(
        goal_id=body.goal_id,
        date_note=date.fromisoformat(body.date_note),
        note=body.note,
        productivity_score=body.productivity_score,
        embedding=embedding,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return _to_response(entry)


@router.patch("/{entry_id}", response_model=EntryResponse)
async def update_entry(
    entry_id: int,
    body: UpdateEntryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> EntryResponse:
    """Partially update an entry. Re-embeds if note changes.

    Raises:
        404: Entry not found or does not belong to the current user.
    """
    result = await session.execute(
        select(Entry)
        .join(Goal, Entry.goal_id == Goal.id)
        .where(Entry.id == entry_id, Goal.user_id == current_user.id)
    )
    entry = result.scalars().first()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found.")

    if body.note is not None:
        entry.note = body.note
        entry.embedding = await _embed(body.note)
    if body.productivity_score is not None:
        entry.productivity_score = body.productivity_score
    if body.date_note is not None:
        entry.date_note = date.fromisoformat(body.date_note)

    await session.commit()
    await session.refresh(entry)
    return _to_response(entry)
