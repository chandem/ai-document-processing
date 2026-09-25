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


@router.get("/{document_id}/file-url")
async def get_document_file_url(document_id: str, user=Depends(get_current_user)):
    """Return a short-lived signed URL to download/preview the original file."""
    try:
        client = get_admin_client()
        response = (
            client.table("documents")
            .select("id,filename,content_type,storage_path")
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to resolve document file") from exp

    if not response.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    storage_path = response.data.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="No stored file for this document.")

    try:
        signed = client.storage.from_("documents").create_signed_url(storage_path, 3600)
    except Exception as exp:
        raise _http_or_500(exp, "Unable to create download URL") from exp

    url = None
    if isinstance(signed, dict):
        url = (
            signed.get("signedURL")
            or signed.get("signedUrl")
            or signed.get("signed_url")
        )
    elif isinstance(signed, str):
        url = signed
    if not url:
        raise HTTPException(status_code=500, detail="Storage did not return a signed URL.")

    return {
        "url": url,
        "filename": response.data.get("filename"),
        "content_type": response.data.get("content_type"),
        "expires_in": 3600,
    }


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
