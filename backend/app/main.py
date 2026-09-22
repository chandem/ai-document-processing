from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.router import api_router

app = FastAPI(
    title="AI Document Processing API",
    version="0.1.0",
    description="API for document upload, processing, extraction, summarization and Q&A.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
