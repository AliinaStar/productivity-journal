"""Goals CRUD endpoints.

Matches the contract expected by ``api-client/goals.ts`` on the frontend.
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import Pagination, get_current_user, get_db, get_pagination
from src.db.models import Entry, Goal, User

router = APIRouter(prefix="/goals", tags=["goals"])

GoalStatus = Literal["active", "postpone", "finished"]


def _validate_iso_date(value: str | None) -> str | None:
    if value is None:
        return value
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("date must be in ISO format (YYYY-MM-DD).") from exc
    return value


class GoalResponse(BaseModel):
    """Matches the ``RemoteGoal`` interface in ``api-client/goals.ts``."""

    id: int
    title: str
    description: str | None
    deadline: str | None
    created_at: str
    status: str


class CreateGoalRequest(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    description: str | None = Field(default=None, max_length=500)
    deadline: str | None = None
    status: GoalStatus = "active"
    created_at: str

    _check_deadline = field_validator("deadline")(_validate_iso_date)
    _check_created_at = field_validator("created_at")(_validate_iso_date)


class UpdateGoalRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = Field(default=None, max_length=500)
    deadline: str | None = None
    status: GoalStatus | None = None

    _check_deadline = field_validator("deadline")(_validate_iso_date)


def _to_response(goal: Goal) -> GoalResponse:
    return GoalResponse(
        id=goal.id,
        title=goal.title,
        description=goal.description,
        deadline=goal.deadline.isoformat() if goal.deadline else None,
        created_at=goal.created_at.isoformat(),
        status=goal.status,
    )


@router.get("", response_model=list[GoalResponse])
async def list_goals(
    page: Pagination = Depends(get_pagination),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[GoalResponse]:
    result = await session.execute(
        select(Goal)
        .where(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc(), Goal.id.desc())
        .limit(page.limit)
        .offset(page.offset)
    )
    goals = result.scalars().all()
    return [_to_response(g) for g in goals]


@router.post("", response_model=GoalResponse)
async def create_goal(
    body: CreateGoalRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> GoalResponse:
    """Create a new goal for the current user."""
    goal = Goal(
        user_id=current_user.id,
        title=body.title,
        description=body.description,
        deadline=date.fromisoformat(body.deadline) if body.deadline else None,
        created_at=date.fromisoformat(body.created_at),
        status=body.status,
    )
    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    return _to_response(goal)


@router.patch("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    body: UpdateGoalRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> GoalResponse:
    """Partially update a goal owned by the current user.

    Raises:
        404: Goal not found or does not belong to the current user.
    """
    result = await session.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id)
    )
    goal = result.scalars().first()
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")

    if body.title is not None:
        goal.title = body.title
    if body.description is not None:
        goal.description = body.description
    if body.deadline is not None:
        goal.deadline = date.fromisoformat(body.deadline)
    if body.status is not None:
        goal.status = body.status

    await session.commit()
    await session.refresh(goal)
    return _to_response(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a goal owned by the current user, along with its entries.

    The ``entry.goal_id`` foreign key has no ON DELETE CASCADE, so child
    entries are removed explicitly before the goal itself.

    Raises:
        404: Goal not found or does not belong to the current user.
    """
    result = await session.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id)
    )
    goal = result.scalars().first()
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")

    await session.execute(delete(Entry).where(Entry.goal_id == goal_id))
    await session.delete(goal)
    await session.commit()
