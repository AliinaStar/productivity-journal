"""Passwordless email authentication.

Flow:
    1. Client calls POST /auth/send-code with an email address.
       Backend generates a 6-digit OTP, stores it in ``auth_code`` table
       (TTL = 10 minutes), and sends it via Resend.

    2. Client calls POST /auth/verify-code with the email + code.
       Backend validates the code (not expired, not used).
       - First time: creates a new ``User`` row.
       - Returns ``{ user_id }`` which the client persists locally.
"""

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])


class SendCodeRequest(BaseModel):
    email: EmailStr


class SendCodeResponse(BaseModel):
    detail: str  # e.g. "Code sent to your email"


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class VerifyCodeResponse(BaseModel):
    user_id: int


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(body: SendCodeRequest) -> SendCodeResponse:
    """Generate a 6-digit OTP and email it to the user.

    - Invalidates any previously unused codes for the same email.
    - Stores the new code in ``auth_code`` with a 10-minute expiry.
    - Always returns 200 even if the email is not registered (security:
      do not reveal whether an account exists).

    Raises:
        503: If the Resend API call fails.
    """
    raise NotImplementedError


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(body: VerifyCodeRequest) -> VerifyCodeResponse:
    """Verify a 6-digit OTP and return the user's ID.

    - Marks the code as ``used`` on success.
    - Creates a new ``User`` row if the email is not yet registered.

    Raises:
        400: If the code is invalid, expired, or already used.
    """
    raise NotImplementedError
