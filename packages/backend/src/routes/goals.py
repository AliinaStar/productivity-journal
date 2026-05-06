"""Goals CRUD endpoints.

Matches the contract expected by ``api-client/goals.ts`` on the frontend.
Goals belong to the current user — ``get_current_user`` dependency ensures
all operations are scoped to the authenticated user.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.core.dependencies import get_current_user
from src.db.models import User

router = APIRouter(prefix="/goals", tags=["goals"])


class GoalResponse(BaseModel):
    """Matches the ``RemoteGoal`` interface in ``api-client/goals.ts``."""

    id: int
    title: str
    description: str | None
    deadline: str | None  # ISO date string
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


@router.post("", response_model=GoalResponse)
async def create_goal(
    body: CreateGoalRequest,
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    """Create a new goal for the current user.

    Raises:
        422: Validation error (e.g. invalid status value).
    """
    raise NotImplementedError


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
    raise NotImplementedError
