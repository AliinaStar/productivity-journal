"""Sending push notifications through the Expo Push API.

The mobile app registers its ``ExponentPushToken[...]`` via
``PUT /users/me/push-token``; this module delivers messages to that token.

Expo handles the actual delivery to FCM/APNs, so no Firebase/Apple
credentials are needed here — just an HTTPS call to the Expo endpoint.
"""

import logging

import httpx
from sqlalchemy import update

from src.db.models import User
from src.db.session import get_async_sessionmaker

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push(
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Send a single push notification via Expo. Best-effort: never raises.

    If Expo reports the device is no longer registered (app uninstalled,
    permissions revoked), the stale token is cleared from the DB so we stop
    sending to it.
    """
    message = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
    }
    if data:
        message["data"] = data

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(EXPO_PUSH_URL, json=message)
            response.raise_for_status()
            result = response.json().get("data", {})
    except Exception:
        logger.exception("Failed to send push notification")
        return

    if result.get("status") == "error":
        error_code = (result.get("details") or {}).get("error")
        logger.warning("Expo push error: %s (%s)", result.get("message"), error_code)
        if error_code == "DeviceNotRegistered":
            await _clear_token(token)


async def _clear_token(token: str) -> None:
    """Remove a dead push token from every user that still holds it."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        await session.execute(
            update(User)
            .where(User.expo_push_token == token)
            .values(expo_push_token=None)
        )
        await session.commit()
