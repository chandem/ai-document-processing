"""Write-side document routes (upload, analyze, ask, persist, delete)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.core.config import get_settings
from app.core.supabase import get_admin_client
from app.schemas.documents import DocumentAnalysisResponse, DocumentProcessResponse
from app.services.document_processor import DocumentProcessingError, document_stats, extract_text_async
from app.services.intelligence import analyze_document, answer_question
from app.services.usage import check_and_increment, try_persist_usage_event


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    conversation_id: str | None = None
    save_history: bool = True


class Citation(BaseModel):
    index: int
    snippet: str
    score: float = 0.0


class AskResponse(BaseModel):
    document_id: str | None = None
    question: str
    answer: str
    citations: list[Citation] = []
    conversation_id: str | None = None
    source: str | None = None


def _http_or_500(exc: Exception, fallback: str) -> HTTPException:
    if isinstance(exc, HTTPException):
        return exc
    return HTTPException(
        status_code=500,
        detail=f"{fallback} ({type(exc).__name__}: {exc})",
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


async def _process_persisted_document(
    document_id: str,
    job_id: str,
    user_id: str,
    text: str,
) -> None:
    client = get_admin_client()
    try:
        client.table("processing_jobs").update(
            {
                "stage": "analyzing",
                "status": "processing",
                "started_at": _now_iso(),
            }
        ).eq("id", job_id).eq("document_id", document_id).execute()

        analysis = await analyze_document(text)

        client.table("documents").update(
            {
                "status": "completed",
                "category": analysis["category"],
                "classification_confidence": analysis["confidence"],
                "summary": analysis["summary"],
                "structured_data": analysis.get("structured_data"),
                "error_message": None,
                "processed_at": _now_iso(),
            }
        ).eq("id", document_id).eq("user_id", user_id).execute()

        client.table("processing_jobs").update(
            {
                "stage": "completed",
                "status": "completed",
                "error_message": None,
                "completed_at": _now_iso(),
            }
        ).eq("id", job_id).eq("document_id", document_id).execute()
    except Exception:
        safe_error = "Processing failed. You can retry this document."
        try:
            client.table("documents").update(
                {
                    "status": "failed",
                    "error_message": safe_error,
                }
            ).eq("id", document_id).eq("user_id", user_id).execute()
            client.table("processing_jobs").update(
                {
                    "stage": "failed",
                    "status": "failed",
                    "error_message": safe_error,
                    "completed_at": _now_iso(),
                }
            ).eq("id", job_id).eq("document_id", document_id).execute()
        except Exception:
            pass


async def _read_and_extract(file: UploadFile) -> tuple[bytes, str]:
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
        text = await extract_text_async(file.filename, file.content_type, data)
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    max_text = settings.max_extracted_text_chars
    if len(text) > max_text:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Extracted document text exceeds the {max_text:,} character "
                "processing limit."
            ),
        )

    return data, text


async def _save_qa_messages(
    *,
    user_id: str,
    document_id: str,
    conversation_id: str | None,
    question: str,
    answer: str,
    citations: list[dict[str, Any]],
) -> str | None:
    try:
        client = get_admin_client()
    except Exception:
        return conversation_id

    try:
        if conversation_id:
            existing = (
                client.table("conversations")
                .select("id")
                .eq("id", conversation_id)
                .eq("document_id", document_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            if not existing.data:
                conversation_id = None

        if not conversation_id:
            conversation_id = str(uuid4())
            title = question.strip()[:80] or "Conversation"
            client.table("conversations").insert(
                {
                    "id": conversation_id,
                    "document_id": document_id,
                    "user_id": user_id,
                    "title": title,
                }
            ).execute()

        client.table("messages").insert(
            [
                {
                    "id": str(uuid4()),
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "role": "user",
                    "content": question,
                    "citations": None,
                },
                {
                    "id": str(uuid4()),
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "role": "assistant",
                    "content": answer,
                    "citations": citations or [],
                },
            ]
        ).execute()
        client.table("conversations").update({"updated_at": _now_iso()}).eq(
            "id", conversation_id
        ).execute()
        return conversation_id
    except Exception:
        return conversation_id


@router.post("/upload", response_model=DocumentProcessResponse)
async def upload_document(file: UploadFile = File(...)):
    data, text = await _read_and_extract(file)
    characters, words = document_stats(text)
    return DocumentProcessResponse(
        filename=file.filename or "document",
        content_type=file.content_type,
        size_bytes=len(data),
        status="completed",
        text=text,
        character_count=characters,
        word_count=words,
        created_at=datetime.now(timezone.utc),
    )


@router.post("/analyze", response_model=DocumentAnalysisResponse)
async def analyze_uploaded_document(file: UploadFile = File(...)):
    data, text = await _read_and_extract(file)
    analysis = await analyze_document(text)
    return DocumentAnalysisResponse(
        filename=file.filename or "document",
        content_type=file.content_type,
        size_bytes=len(data),
        status="completed",
        **analysis,
    )


@router.post("/ask", response_model=AskResponse)
async def ask_about_upload(
    file: UploadFile = File(...),
    question: str = Form(..., min_length=1, max_length=2000),
):
    _, text = await _read_and_extract(file)
    result = await answer_question(text, question)
    return AskResponse(
        question=question,
        answer=result.get("answer") or "",
        citations=[Citation(**c) for c in (result.get("citations") or [])],
        source=result.get("source"),
    )


@router.post("/{document_id}/ask", response_model=AskResponse)
async def ask_about_document(
    document_id: str,
    body: AskRequest,
    user=Depends(get_current_user),
):
    check_and_increment(str(user.id), "asks")
    try_persist_usage_event(str(user.id), "asks", document_id=document_id)

    try:
        response = (
            get_admin_client()
            .table("documents")
            .select("id,status,extracted_text")
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to load document") from exp

    if not response.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    doc = response.data
    if doc.get("status") == "processing":
        raise HTTPException(
            status_code=409,
            detail="Document is still processing. Try again shortly.",
        )

    text = doc.get("extracted_text") or ""
    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No extracted text available for this document.",
        )

    result = await answer_question(text, body.question)
    citations = result.get("citations") or []
    conversation_id = body.conversation_id
    if body.save_history:
        conversation_id = await _save_qa_messages(
            user_id=str(user.id),
            document_id=document_id,
            conversation_id=conversation_id,
            question=body.question,
            answer=result.get("answer") or "",
            citations=citations,
        )

    return AskResponse(
        document_id=document_id,
        question=body.question,
        answer=result.get("answer") or "",
        citations=[Citation(**c) for c in citations],
        conversation_id=conversation_id,
        source=result.get("source"),
    )


@router.post("/persist")
async def persist_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    check_and_increment(str(user.id), "uploads")
    try_persist_usage_event(str(user.id), "uploads")

    data, text = await _read_and_extract(file)
    document_id = str(uuid4())
    job_id = str(uuid4())
    filename = file.filename or "document"
    storage_path = f"{user.id}/{document_id}/{filename}"

    client = get_admin_client()
    try:
        client.storage.from_("documents").upload(
            storage_path,
            data,
            {"content-type": file.content_type or "application/octet-stream"},
        )
        client.table("documents").insert(
            {
                "id": document_id,
                "user_id": str(user.id),
                "filename": filename,
                "storage_path": storage_path,
                "content_type": file.content_type,
                "file_size": len(data),
                "status": "processing",
                "extracted_text": text,
            }
        ).execute()
        client.table("processing_jobs").insert(
            {
                "id": job_id,
                "document_id": document_id,
                "user_id": str(user.id),
                "stage": "queued",
                "status": "processing",
                "attempt": 1,
            }
        ).execute()
    except Exception as exp:
        try:
            client.storage.from_("documents").remove([storage_path])
        except Exception:
            pass
        raise _http_or_500(exp, "Unable to queue document for processing") from exp

    background_tasks.add_task(
        _process_persisted_document,
        document_id,
        job_id,
        str(user.id),
        text,
    )

    return {
        "document": {
            "id": document_id,
            "filename": filename,
            "status": "processing",
            "file_size": len(data),
        }
    }


@router.delete("/{document_id}")
async def delete_document(document_id: str, user=Depends(get_current_user)):
    try:
        client = get_admin_client()
    except HTTPException:
        raise

    try:
        response = (
            client.table("documents")
            .select("id,storage_path")
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Document not found.")

        storage_path = response.data.get("storage_path")
        if storage_path:
            try:
                client.storage.from_("documents").remove([storage_path])
            except Exception:
                pass

        client.table("documents").delete().eq("id", document_id).eq(
            "user_id", str(user.id)
        ).execute()

        return {"deleted": True, "id": document_id}
    except HTTPException:
        raise
    except Exception as exp:
        raise _http_or_500(exp, "Unable to delete document") from exp
