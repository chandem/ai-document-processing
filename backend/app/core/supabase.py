from __future__ import annotations

from functools import lru_cache

from fastapi import HTTPException
from supabase import Client, create_client

from app.core.config import get_settings


def _require_supabase_url() -> str:
    settings = get_settings()
    if not settings.supabase_url:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured. Set SUPABASE_URL on the backend.",
        )
    return settings.supabase_url


@lru_cache
def get_admin_client() -> Client:
    settings = get_settings()
    url = _require_supabase_url()
    if not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the backend.",
        )
    return create_client(url, settings.supabase_service_role_key)


@lru_cache
def get_auth_client() -> Client:
    settings = get_settings()
    url = _require_supabase_url()
    if not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase auth is not configured. Set SUPABASE_PUBLISHABLE_KEY on the backend.",
        )
    return create_client(url, settings.supabase_publishable_key)
