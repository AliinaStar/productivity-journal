"""In-app user feedback → forwarded to the support inbox by email."""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from src.core.dependencies import get_current_user
from src.core.email import send_feedback
from src.core.logging import get_logger
from src.core.ratelimit import limiter
from src.db.models import User

router = APIRouter(prefix="/feedback", tags=["feedback"])
log = get_logger(__name__)


class FeedbackRequest(BaseModel):
    # Capped so a single request can't be used to send an unbounded email.
    message: str = Field(min_length=1, max_length=2000)


class FeedbackResponse(BaseModel):
    detail: str


@router.post("", response_model=FeedbackResponse)
@limiter.limit("10/hour")
async def submit_feedback(
    request: Request,
    body: FeedbackRequest,
    current_user: User = Depends(get_current_user),
) -> FeedbackResponse:
    """Email the user's feedback to the support inbox.

    Authenticated so we know who sent it (name/email/id are attached to the
    email); rate-limited per IP to prevent abuse of the mail relay.
    """
    await send_feedback(
        message=body.message,
        user_name=current_user.name,
        user_email=current_user.email,
        user_id=current_user.id,
    )
    log.info("feedback_submitted", user_id=current_user.id)
    return FeedbackResponse(detail="Feedback sent.")
