"""Goals CRUD endpoints.

Matches the contract expected by ``api-client/goals.ts`` on the frontend.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from src.core.dependencies import get_current_user
from src.db.models import Goal, User
from src.db.session import get_async_sessionmaker

router = APIRouter(prefix="/goals", tags=["goals"])


class GoalResponse(BaseModel):
    """Matches the ``RemoteGoal`` interface in ``api-client/goals.ts``."""

    id: int
    title: str
    description: str | None
    deadline: str | None
    created_at: str
    status: str


class CreateGoalRequest(BaseModel):
    title: str
    description: str | None = None
    deadline: str | None = None
    status: str = "active"
    created_at: str


class UpdateGoalRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    deadline: str | None = None
    status: str | None = None


def _to_response(goal: Goal) -> GoalResponse:
    return GoalResponse(
        id=goal.id,
        title=goal.title,
        description=goal.description,
        deadline=goal.deadline.isoformat() if goal.deadline else None,
        created_at=goal.created_at.isoformat(),
        status=goal.status,
    )


@router.post("", response_model=GoalResponse)
async def create_goal(
    body: CreateGoalRequest,
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    """Create a new goal for the current user."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
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
) -> GoalResponse:
    """Partially update a goal owned by the current user.

    Raises:
        404: Goal not found or does not belong to the current user.
    """
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
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
