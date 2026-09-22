from __future__ import annotations

from fastapi import Header, HTTPException

from app.core.supabase import get_auth_client


async def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer access token.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing Bearer access token.")

    try:
        response = get_auth_client().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc

    user = getattr(response, "user", None)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.")

    return user
