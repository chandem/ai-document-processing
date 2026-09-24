"""Simple per-user usage tracking and rate limiting (free-tier quotas)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from threading import Lock
from typing import Any

from fastapi import HTTPException

from app.core.config import get_settings

# In-memory counters: {user_id: {"day": "YYYY-MM-DD", "uploads": n, "asks": n}}
_usage_lock = Lock()
_usage: dict[str, dict[str, Any]] = {}


def _today() -> str:
    return date.today().isoformat()


def _bucket(user_id: str) -> dict[str, Any]:
    today = _today()
    with _usage_lock:
        entry = _usage.get(user_id)
        if not entry or entry.get("day") != today:
            entry = {"day": today, "uploads": 0, "asks": 0, "exports": 0}
            _usage[user_id] = entry
        return entry


def get_usage_snapshot(user_id: str) -> dict[str, Any]:
    settings = get_settings()
    entry = _bucket(user_id)
    return {
        "day": entry["day"],
        "uploads": entry["uploads"],
        "asks": entry["asks"],
        "exports": entry["exports"],
        "limits": {
            "uploads_per_day": settings.free_uploads_per_day,
            "asks_per_day": settings.free_asks_per_day,
            "exports_per_day": settings.free_exports_per_day,
        },
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


def check_and_increment(user_id: str, action: str) -> dict[str, Any]:
    """Raise HTTP 429 when free-tier daily quota is exceeded."""
    settings = get_settings()
    limits = {
        "uploads": settings.free_uploads_per_day,
        "asks": settings.free_asks_per_day,
        "exports": settings.free_exports_per_day,
    }
    if action not in limits:
        raise ValueError(f"Unknown usage action: {action}")

    limit = limits[action]
    entry = _bucket(user_id)
    current = int(entry.get(action, 0))

    if current >= limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily {action} limit reached ({limit}/day on the free tier). "
                "Try again tomorrow or raise FREE_*_PER_DAY on the backend."
            ),
        )

    with _usage_lock:
        entry[action] = current + 1

    return get_usage_snapshot(user_id)


def try_persist_usage_event(
    user_id: str,
    action: str,
    *,
    document_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Best-effort write to usage_events when Supabase is configured."""
    try:
        from app.core.supabase import get_admin_client

        client = get_admin_client()
        payload: dict[str, Any] = {
            "user_id": user_id,
            "action": action,
            "metadata": metadata or {},
        }
        if document_id:
            payload["document_id"] = document_id
        client.table("usage_events").insert(payload).execute()
    except Exception:
        # Quotas still work in-memory even if the table is missing
        pass
