"""Entries CRUD endpoints.

Matches the contract expected by ``api-client/entries.ts`` on the frontend.
Entries are scoped to goals that belong to the current user.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.core.dependencies import get_current_user
from src.db.models import User

router = APIRouter(prefix="/entries", tags=["entries"])


class EntryResponse(BaseModel):
    """Matches the ``RemoteEntry`` interface in ``api-client/entries.ts``."""

    id: int
    goal_id: int
    date_note: str       # ISO date string
    note: str
    productivity_score: int


class CreateEntryRequest(BaseModel):
    goal_id: int
    date_note: str
    note: str
    productivity_score: int


class UpdateEntryRequest(BaseModel):
    note: str | None = None
    productivity_score: int | None = None
    date_note: str | None = None


@router.post("", response_model=EntryResponse)
async def create_entry(
    body: CreateEntryRequest,
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    """Create a new entry for a goal owned by the current user.

    Also triggers async embedding generation for the new entry so it
    becomes available for RAG retrieval.

    Raises:
        404: Goal not found or does not belong to the current user.
        422: Validation error (e.g. productivity_score out of 1–5 range).
    """
    raise NotImplementedError


@router.patch("/{entry_id}", response_model=EntryResponse)
async def update_entry(
    entry_id: int,
    body: UpdateEntryRequest,
    current_user: User = Depends(get_current_user),
) -> EntryResponse:
    """Partially update an entry owned by the current user.

    If ``note`` is updated, re-generates the embedding asynchronously.

    Raises:
        404: Entry not found or does not belong to the current user.
    """
    raise NotImplementedError
