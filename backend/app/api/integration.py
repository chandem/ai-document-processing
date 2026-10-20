"""Authenticated service-to-service integration health endpoint."""

import hmac

from fastapi import APIRouter, Header, HTTPException

from app.core.config import get_settings

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


@router.get("/health")
def integration_health(x_integration_token: str | None = Header(default=None)):
    """Expose minimal service health only to a trusted integration caller."""
    expected = get_settings().integration_service_token
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Server-to-server integration is not configured.",
        )
    if not x_integration_token or not hmac.compare_digest(
        x_integration_token, expected
    ):
        raise HTTPException(status_code=401, detail="Invalid integration credentials.")

    return {
        "status": "ok",
        "service": "ai-document-processing",
        "integration": "authenticated",
        "capabilities": ["document_metadata", "document_analysis"],
    }
