from datetime import datetime, timezone

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.documents import DocumentProcessResponse
from app.services.document_processor import (
    DocumentProcessingError,
    document_stats,
    extract_text,
)

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


@router.get("")
async def list_documents():
    return {"documents": []}


@router.post("/upload", response_model=DocumentProcessResponse)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="A filename is required.")

    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    data = await file.read()

    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_size_mb} MB upload limit.",
        )

    try:
        text = extract_text(file.filename, file.content_type, data)
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    characters, words = document_stats(text)

    return DocumentProcessResponse(
        filename=file.filename,
        content_type=file.content_type,
        status="completed",
        text=text,
        character_count=characters,
        word_count=words,
        created_at=datetime.now(timezone.utc),
    )
