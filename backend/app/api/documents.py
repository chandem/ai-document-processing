from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.core.config import get_settings
from app.core.supabase import get_admin_client
from app.schemas.documents import DocumentAnalysisResponse, DocumentProcessResponse
from app.services.document_processor import (
    DocumentProcessingError,
    document_stats,
    extract_text_async,
)
from app.services.intelligence import analyze_document, answer_question
from app.services.usage import check_and_increment, get_usage_snapshot, try_persist_usage_event

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


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


def _csv_escape(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


@router.get("")
async def list_documents(user=Depends(get_current_user)):
    try:
        response = (
            get_admin_client()
            .table("documents")
            .select(
                "id,filename,content_type,file_size,status,category,"
                "classification_confidence,summary,error_message,retry_count,"
                "processed_at,structured_data,created_at,updated_at"
            )
            .eq("user_id", str(user.id))
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise _http_or_500(exc, "Unable to load documents") from exc

    return {"documents": response.data or []}


@router.get("/usage")
async def usage_status(user=Depends(get_current_user)):
    """Current free-tier daily usage for the signed-in user."""
    return get_usage_snapshot(str(user.id))


@router.get("/export.csv")
async def export_documents_csv(user=Depends(get_current_user)):
    """Export the user's document list as CSV (opens in Excel)."""
    check_and_increment(str(user.id), "exports")
    try_persist_usage_event(str(user.id), "exports")

    try:
        response = (
            get_admin_client()
            .table("documents")
            .select(
                "id,filename,content_type,file_size,status,category,"
                "classification_confidence,summary,error_message,retry_count,"
                "processed_at,created_at,updated_at"
            )
            .eq("user_id", str(user.id))
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to export documents") from exp

    rows = response.data or []
    fieldnames = [
        "id",
        "filename",
        "content_type",
        "file_size",
        "status",
        "category",
        "classification_confidence",
        "summary",
        "error_message",
        "retry_count",
        "processed_at",
        "created_at",
        "updated_at",
    ]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({k: _csv_escape(row.get(k)) for k in fieldnames})

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="documents-export.csv"',
        },
    )


@router.get("/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    try:
        response = (
            get_admin_client()
            .table("documents")
            .select(
                "id,filename,content_type,file_size,status,category,"
                "classification_confidence,summary,error_message,retry_count,"
                "processed_at,structured_data,extracted_text,storage_path,"
                "created_at,updated_at"
            )
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to load document") from exp

    if not response.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    return {"document": response.data}


@router.get("/{document_id}/history")
async def document_processing_history(
    document_id: str, user=Depends(get_current_user)
):
    try:
        response = (
            get_admin_client()
            .table("processing_jobs")
            .select(
                "id,stage,status,attempt,error_message,created_at,updated_at,"
                "started_at,completed_at"
            )
            .eq("document_id", document_id)
            .eq("user_id", str(user.id))
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise _http_or_500(exc, "Unable to load processing history") from exc
    return {"history": response.data or []}


@router.get("/{document_id}/conversations")
async def list_conversations(document_id: str, user=Depends(get_current_user)):
    try:
        response = (
            get_admin_client()
            .table("conversations")
            .select("id,title,created_at,updated_at")
            .eq("document_id", document_id)
            .eq("user_id", str(user.id))
            .order("updated_at", desc=True)
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to load conversations") from exp
    return {"conversations": response.data or []}


@router.get("/{document_id}/conversations/{conversation_id}/messages")
async def list_messages(
    document_id: str,
    conversation_id: str,
    user=Depends(get_current_user),
):
    client = get_admin_client()
    try:
        conv = (
            client.table("conversations")
            .select("id")
            .eq("id", conversation_id)
            .eq("document_id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
        if not conv.data:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        response = (
            client.table("messages")
            .select("id,role,content,citations,created_at")
            .eq("conversation_id", conversation_id)
            .eq("user_id", str(user.id))
            .order("created_at", desc=False)
            .execute()
        )
    except HTTPException:
        raise
    except Exception as exp:
        raise _http_or_500(exp, "Unable to load messages") from exp
    return {"messages": response.data or []}


@router.post("/{document_id}/retry")
async def retry_document(document_id: str, user=Depends(get_current_user)):
    client = get_admin_client()
    try:
        response = (
            client.table("documents")
            .select("id,storage_path,status,retry_count")
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Document not found.")

        doc = response.data
        if doc.get("status") != "failed":
            raise HTTPException(
                status_code=409, detail="Only failed documents can be retried."
            )

        retry_count = int(doc.get("retry_count") or 0) + 1
        client.table("documents").update(
            {
                "status": "processing",
                "error_message": None,
                "retry_count": retry_count,
            }
        ).eq("id", document_id).eq("user_id", str(user.id)).execute()

        job_id = str(uuid4())
        client.table("processing_jobs").insert(
            {
                "id": job_id,
                "document_id": document_id,
                "user_id": str(user.id),
                "stage": "analysis",
                "status": "processing",
                "attempt": retry_count + 1,
                "started_at": _now_iso(),
            }
        ).execute()

        try:
            storage = client.storage.from_("documents").download(doc["storage_path"])
            filename = doc["storage_path"].rsplit("/", 1)[-1]
            text = await extract_text_async(filename, None, storage)
            if len(text) > get_settings().max_extracted_text_chars:
                raise ValueError(
                    "Extracted document text exceeds the processing limit."
                )
            analysis = await analyze_document(text)
            client.table("documents").update(
                {
                    "status": "completed",
                    "extracted_text": text,
                    "category": analysis["category"],
                    "classification_confidence": analysis["confidence"],
                    "summary": analysis["summary"],
                    "structured_data": analysis.get("structured_data"),
                    "error_message": None,
                    "processed_at": _now_iso(),
                }
            ).eq("id", document_id).eq("user_id", str(user.id)).execute()
            client.table("processing_jobs").update(
                {
                    "status": "completed",
                    "stage": "completed",
                    "error_message": None,
                    "completed_at": _now_iso(),
                }
            ).eq("id", job_id).execute()
            return {"status": "completed", "retry_count": retry_count}
        except Exception as exp:
            safe_error = "Retry failed. Please try again later."
            client.table("documents").update(
                {"status": "failed", "error_message": safe_error}
            ).eq("id", document_id).eq("user_id", str(user.id)).execute()
            client.table("processing_jobs").update(
                {
                    "status": "failed",
                    "stage": "failed",
                    "error_message": safe_error,
                    "completed_at": _now_iso(),
                }
            ).eq("id", job_id).execute()
            raise HTTPException(status_code=500, detail=safe_error) from exp
    except HTTPException:
        raise
    except Exception as exp:
        raise _http_or_500(exp, "Unable to retry document") from exp


@router.get("/{document_id}/export")
async def export_document(document_id: str, user=Depends(get_current_user)):
    """Download document analysis as a JSON file."""
    check_and_increment(str(user.id), "exports")
    try_persist_usage_event(str(user.id), "exports", document_id=document_id)

    try:
        response = (
            get_admin_client()
            .table("documents")
            .select(
                "id,filename,content_type,file_size,status,category,"
                "classification_confidence,summary,error_message,retry_count,"
                "processed_at,structured_data,extracted_text,"
                "created_at,updated_at"
            )
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to export document") from exp

    if not response.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    doc = response.data
    safe_name = (doc.get("filename") or "document").rsplit(".", 1)[0]
    filename = f"{safe_name}-export.json"

    return JSONResponse(
        content={
            "exported_at": _now_iso(),
            "document": doc,
        },
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/{document_id}/export.csv")
async def export_document_csv(document_id: str, user=Depends(get_current_user)):
    """Export a single document's metadata + summary as CSV."""
    check_and_increment(str(user.id), "exports")
    try_persist_usage_event(str(user.id), "exports", document_id=document_id)

    try:
        response = (
            get_admin_client()
            .table("documents")
            .select(
                "id,filename,content_type,file_size,status,category,"
                "classification_confidence,summary,error_message,retry_count,"
                "processed_at,structured_data,created_at,updated_at"
            )
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to export document") from exp

    if not response.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    doc = response.data
    fieldnames = list(doc.keys())
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerow({k: _csv_escape(doc.get(k)) for k in fieldnames})
    buffer.seek(0)

    safe_name = (doc.get("filename") or "document").rsplit(".", 1)[0]
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}-export.csv"',
        },
    )


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
    """Persist Q&A turn; create conversation if needed. Returns conversation_id."""
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
                },
                {
                    "id": str(uuid4()),
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "role": "assistant",
                    "content": answer,
                    "citations": citations or None,
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
    _, text = await _read_and_extract(file)
    characters, words = document_stats(text)

    return DocumentProcessResponse(
        filename=file.filename or "document",
        content_type=file.content_type,
        status="completed",
        text=text,
        character_count=characters,
        word_count=words,
        created_at=datetime.now(timezone.utc),
    )


@router.post("/analyze", response_model=DocumentAnalysisResponse)
async def analyze_uploaded_document(file: UploadFile = File(...)):
    _, text = await _read_and_extract(file)
    analysis = await analyze_document(text)

    return DocumentAnalysisResponse(
        filename=file.filename or "document",
        status="completed",
        category=analysis["category"],
        confidence=analysis["confidence"],
        summary=analysis["summary"],
        structured_data=analysis.get("structured_data"),
    )


@router.post("/ask", response_model=AskResponse)
async def ask_about_upload(
    file: UploadFile = File(...),
    question: str = Form(..., min_length=1, max_length=2000),
):
    """Upload a document and ask a question about it in one request."""
    _, text = await _read_and_extract(file)
    result = await answer_question(text, question)
    return AskResponse(
        question=question,
        answer=result["answer"],
        citations=[Citation(**c) for c in result.get("citations") or []],
        source=result.get("source"),
    )


@router.post("/{document_id}/ask", response_model=AskResponse)
async def ask_about_document(
    document_id: str,
    body: AskRequest,
    user=Depends(get_current_user),
):
    """Ask a question about a previously persisted document (with citations + history)."""
    check_and_increment(str(user.id), "asks")
    try_persist_usage_event(
        str(user.id), "asks", document_id=document_id, metadata={"q_len": len(body.question)}
    )

    try:
        response = (
            get_admin_client()
            .table("documents")
            .select("id,extracted_text,status")
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to load document") from exp

    if not response.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    if response.data.get("status") == "processing":
        raise HTTPException(
            status_code=409,
            detail="Document is still processing. Try again shortly.",
        )

    text = response.data.get("extracted_text") or ""
    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Document has no extracted text to answer questions against.",
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
            answer=result["answer"],
            citations=citations,
        )

    return AskResponse(
        document_id=document_id,
        question=body.question,
        answer=result["answer"],
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

    data, text = await _read_and_extract(file)

    try:
        client = get_admin_client()
    except HTTPException:
        raise

    document_id = str(uuid4())
    safe_name = (file.filename or "document").replace("/", "_").replace("\\", "_")
    storage_path = f"{user.id}/{document_id}/{safe_name}"

    try:
        client.storage.from_("documents").upload(
            storage_path,
            data,
            file_options={
                "content-type": file.content_type or "application/octet-stream",
                "upsert": "false",
            },
        )

        job_id = str(uuid4())
        client.table("documents").insert(
            {
                "id": document_id,
                "user_id": str(user.id),
                "filename": safe_name,
                "storage_path": storage_path,
                "content_type": file.content_type,
                "file_size": len(data),
                "status": "processing",
                "extracted_text": text,
                "retry_count": 0,
            }
        ).execute()
        client.table("processing_jobs").insert(
            {
                "id": job_id,
                "document_id": document_id,
                "user_id": str(user.id),
                "stage": "analysis",
                "status": "processing",
                "attempt": 1,
                "started_at": _now_iso(),
            }
        ).execute()

        try_persist_usage_event(str(user.id), "uploads", document_id=document_id)

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
                "filename": safe_name,
                "content_type": file.content_type,
                "file_size": len(data),
                "status": "processing",
                "retry_count": 0,
                "created_at": _now_iso(),
            }
        }
    except Exception as exp:
        try:
            client.storage.from_("documents").remove([storage_path])
        except Exception:
            pass
        raise _http_or_500(exp, "Unable to queue document for processing") from exp


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
