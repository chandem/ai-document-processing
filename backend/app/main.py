from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router
from .core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="AI Document Processing API",
    version="0.1.0",
    description="API for document upload, processing, extraction, summarization and Q&A.",
)

# Allow local dev origins + the configured frontend URL (Vercel, etc.)
# Extra origins can be passed as a comma-separated FRONTEND_URLS env var.
def _cors_origins() -> list[str]:
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    configured = [settings.frontend_url] if settings.frontend_url else []
    extra: list[str] = []
    # Optional: FRONTEND_URLS=https://app.vercel.app,https://preview.vercel.app
    raw = getattr(settings, "frontend_urls", None)
    if raw:
        extra = [o.strip() for o in str(raw).split(",") if o.strip()]
    # Deduplicate while preserving order
    seen: set[str] = set()
    origins: list[str] = []
    for origin in configured + defaults + extra:
        if origin and origin not in seen:
            seen.add(origin)
            origins.append(origin)
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-document-processing"}


@app.get("/api/v1/health")
def api_health():
    return {"status": "ok", "service": "ai-document-processing", "version": "0.1.0"}
