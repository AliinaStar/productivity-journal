"""Email delivery via Resend.

Single responsibility: send a one-time login code to the user's email.
"""

import resend

from src.core.settings import get_settings


async def send_login_code(email: str, code: str) -> None:
    """Send a 6-digit login code to *email* via Resend.

    Args:
        email: Recipient address.
        code:  6-digit one-time code.

    Raises:
        RuntimeError: If the Resend API returns an error.
    """
    settings = get_settings()
    resend.api_key = settings.resend_api_key

    params: resend.Emails.SendParams = {
        "from": settings.email_from,
        "to": [email],
        "subject": "Your login code",
        "html": (
            f"<p>Your login code is: <strong>{code}</strong></p>"
            f"<p>It expires in 10 minutes.</p>"
        ),
    }

    response = resend.Emails.send(params)
    if not response.get("id"):
        raise RuntimeError(f"Resend failed: {response}")
