"""Entries CRUD endpoints.

Matches the contract expected by ``api-client/entries.ts`` on the frontend.
Entries are scoped to goals that belong to the current user.
"""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import Pagination, get_current_user, get_db, get_pagination
from src.core.periods import bounds_containing, is_period_open, resolve_tz
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


def _parse_client_created_at(value: str | None) -> datetime | None:
    """Parse the client's local creation timestamp.

    For entries written offline, the client's clock is the only honest record
    of *when the note was actually written* — the server otherwise stamps
    created_at at sync time, which for a backfilled week can be days late.
    Returns None on missing/invalid input so a bad clock never blocks a sync;
    the server default then takes over.
    """
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class EntryResponse(BaseModel):
    """Matches the ``RemoteEntry`` interface in ``api-client/entries.ts``."""

    id: int
    goal_id: int
    date_note: str
    note: str
    productivity_score: int
    created_at: str | None = None
    # Last time the note or score was changed.
    updated_at: str | None = None
    # Last day this entry can still be changed — the Sunday of its own week,
    # in the owner's timezone.
    editable_until: str


class CreateEntryRequest(BaseModel):
    goal_id: int
    date_note: str
    note: str = Field(min_length=1, max_length=NOTE_MAX_LENGTH)
    productivity_score: int = Field(ge=1, le=5)
    # The client's local time when the note was written. ISO 8601 datetime.
    created_at: str | None = None

    _check_date = field_validator("date_note")(_validate_iso_date)


class UpdateEntryRequest(BaseModel):
    note: str | None = Field(default=None, min_length=1, max_length=NOTE_MAX_LENGTH)
    productivity_score: int | None = Field(default=None, ge=1, le=5)
    date_note: str | None = None

    _check_date = field_validator("date_note")(_validate_iso_date)


def _to_response(entry: Entry) -> EntryResponse:
    _, week_end = bounds_containing("week", entry.date_note)
    return EntryResponse(
        id=entry.id,
        goal_id=entry.goal_id,
        date_note=entry.date_note.isoformat(),
        note=entry.note,
        productivity_score=entry.productivity_score,
        created_at=entry.created_at.isoformat() if entry.created_at else None,
        updated_at=entry.updated_at.isoformat() if entry.updated_at else None,
        editable_until=week_end.isoformat(),
    )


async def _embed(text: str) -> list[float]:
    return await embed_text(text)


async def _get_owned_entry(entry_id: int, user: User, session: AsyncSession) -> Entry:
    """Load an entry, 404-ing unless it belongs to *user* via one of their goals."""
    result = await session.execute(
        select(Entry)
        .join(Goal, Entry.goal_id == Goal.id)
        .where(Entry.id == entry_id, Goal.user_id == user.id)
    )
    entry = result.scalars().first()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found.")
    return entry


def _require_open_window(entry: Entry, user: User) -> None:
    """Reject changes to an entry whose week has already closed.

    An entry can be rewritten or deleted only until the end of the week it
    belongs to. After that the weekly report has quoted it, and the report is
    a record of what the week actually looked like — not of what the user
    later wished it had.

    The boundary comes from ``src.core.periods``, the same module the
    scheduler uses to decide a period is finished, so the window provably
    closes no later than the report that depends on it.
    """
    if is_period_open("week", entry.date_note, resolve_tz(user.timezone)):
        return
    _, week_end = bounds_containing("week", entry.date_note)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "This entry can no longer be changed: its week ended on "
            f"{week_end.isoformat()} and has already been reported on."
        ),
    )


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
    client_created_at = _parse_client_created_at(body.created_at)
    entry = Entry(
        goal_id=body.goal_id,
        date_note=date.fromisoformat(body.date_note),
        note=body.note,
        productivity_score=body.productivity_score,
        embedding=embedding,
        # Only set when the client sent a usable value; leaving it unset lets
        # the column's server_default (now()) apply as before. updated_at is
        # pinned to the same instant so "created_at != updated_at" means
        # exactly "edited" — otherwise a backfilled entry would arrive already
        # looking edited, its creation time days behind its sync time.
        **(
            {"created_at": client_created_at, "updated_at": client_created_at}
            if client_created_at
            else {}
        ),
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
        403: The entry's week has ended; it is now part of a report.
        404: Entry not found or does not belong to the current user.
        422: date_note would move the entry into a different week.
    """
    entry = await _get_owned_entry(entry_id, current_user, session)
    _require_open_window(entry, current_user)

    if body.date_note is not None:
        new_date = date.fromisoformat(body.date_note)
        # Moving an entry across a week boundary would drop it into a week
        # whose report is already written — the exact thing the edit window
        # exists to prevent, reached the long way round.
        if bounds_containing("week", new_date) != bounds_containing("week", entry.date_note):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="date_note cannot be moved to a different week.",
            )
        entry.date_note = new_date

    if body.note is not None:
        entry.note = body.note
        entry.embedding = await _embed(body.note)
    if body.productivity_score is not None:
        entry.productivity_score = body.productivity_score

    # entry.updated_at is refreshed by the column's onupdate=now().
    await session.commit()
    await session.refresh(entry)
    return _to_response(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete an entry, while its week is still open.

    Hard delete, deliberately: the window closes before any report can quote
    the entry, so there is never a report left pointing at something that no
    longer exists, and nothing to keep a tombstone for.

    Raises:
        403: The entry's week has ended; it is now part of a report.
        404: Entry not found or does not belong to the current user.
    """
    entry = await _get_owned_entry(entry_id, current_user, session)
    _require_open_window(entry, current_user)

    await session.delete(entry)
    await session.commit()
    return None
