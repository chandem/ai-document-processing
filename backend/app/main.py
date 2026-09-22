from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.router import api_router
from .core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="AI Document Processing API",
    version="0.1.0",
    description="API for document upload, processing, extraction, summarization and Q&A.",
)


def _cors_origins() -> list[str]:
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",  # vite preview
        "http://127.0.0.1:4173",
    ]
    configured = [settings.frontend_url] if settings.frontend_url else []
    extra: list[str] = []
    raw = getattr(settings, "frontend_urls", None)
    if raw:
        extra = [o.strip() for o in str(raw).split(",") if o.strip()]
    seen: set[str] = set()
    origins: list[str] = []
    for origin in configured + defaults + extra:
        if origin and origin not in seen:
            seen.add(origin)
            origins.append(origin)
    return origins


# In development, allow any localhost origin to avoid CORS friction.
_is_dev = (settings.app_env or "development").lower() in {"development", "dev", "local"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins() if not _is_dev else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app" if not _is_dev else None,
    # When allow_origins is ["*"], credentials must be False per the CORS spec.
    allow_credentials=not _is_dev,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Ensure unexpected errors still return JSON (helps the frontend show a real message)."""
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-document-processing",
        "env": settings.app_env,
    }


@app.get("/api/v1/health")
def api_health():
    return {
        "status": "ok",
        "service": "ai-document-processing",
        "version": "0.1.0",
        "env": settings.app_env,
    }
