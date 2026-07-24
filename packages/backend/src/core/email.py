"""Email delivery via Resend.

Sends transactional email: one-time login codes, and in-app user feedback
forwarded to the support inbox.
"""

import asyncio
import html

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

    # The resend SDK is synchronous — run it in a worker thread so the
    # HTTP round-trip doesn't block the event loop for other requests.
    response = await asyncio.to_thread(resend.Emails.send, params)
    if not response.get("id"):
        raise RuntimeError(f"Resend failed: {response}")


async def send_feedback(
    *, message: str, user_name: str, user_email: str, user_id: int
) -> None:
    """Forward in-app user feedback to the support inbox via Resend.

    Args:
        message:    Free-text feedback the user typed in the app.
        user_name:  Display name of the sender.
        user_email: Sender's email — also set as reply-to so a reply lands
                    back in their inbox.
        user_id:    Sender's user id, for support lookups.

    Raises:
        RuntimeError: If the Resend API returns an error.
    """
    settings = get_settings()
    resend.api_key = settings.resend_api_key
    recipient = settings.feedback_to or settings.email_from

    # User-supplied text goes into HTML — escape it so it can't inject markup,
    # then turn newlines into <br> to preserve the paragraph layout.
    safe_message = html.escape(message).replace("\n", "<br>")

    params: resend.Emails.SendParams = {
        "from": settings.email_from,
        "to": [recipient],
        "reply_to": user_email,
        "subject": f"App feedback from {user_name}",
        "html": (
            f"<p><strong>From:</strong> {html.escape(user_name)} "
            f"(&lt;{html.escape(user_email)}&gt;, user #{user_id})</p>"
            f"<p>{safe_message}</p>"
        ),
    }

    response = await asyncio.to_thread(resend.Emails.send, params)
    if not response.get("id"):
        raise RuntimeError(f"Resend failed: {response}")
