from __future__ import annotations

from supabase import Client, create_client

from app.core.config import get_settings


def get_admin_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_auth_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise RuntimeError(
            "Supabase authentication is not configured. Set SUPABASE_URL and "
            "SUPABASE_PUBLISHABLE_KEY."
        )
    return create_client(settings.supabase_url, settings.supabase_publishable_key)
