from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
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

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)


class AskResponse(BaseModel):
    document_id: str | None = None
    question: str
    answer: str


def _http_or_500(exc: Exception, fallback: str) -> HTTPException:
    if isinstance(exc, HTTPException):
        return exp if False else exc  # keep type checkers happy
    return HTTPException(status_code=500, detail=f"{fallback} ({type(exc).__name__}: {exc})")


@router.get("")
async def list_documents(user=Depends(get_current_user)):
    try:
        response = (
            get_admin_client()
            .table("documents")
            .select(
                "id,filename,content_type,file_size,status,category,"
                "classification_confidence,summary,created_at,updated_at"
            )
            .eq("user_id", str(user.id))
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise _http_or_500(exc, "Unable to load documents") from exc

    return {"documents": response.data or []}


@router.get("/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    try:
        response = (
            get_admin_client()
            .table("documents")
            .select(
                "id,filename,content_type,file_size,status,category,"
                "classification_confidence,summary,extracted_text,storage_path,"
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


@router.get("/{document_id}/export")
async def export_document(document_id: str, user=Depends(get_current_user)):
    """Download document analysis as a JSON file."""
    try:
        response = (
            get_admin_client()
            .table("documents")
            .select(
                "id,filename,content_type,file_size,status,category,"
                "classification_confidence,summary,extracted_text,"
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
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "document": doc,
        },
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


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

    return data, text


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
    )


@router.post("/ask", response_model=AskResponse)
async def ask_about_upload(
    file: UploadFile = File(...),
    question: str = Form(..., min_length=1, max_length=2000),
):
    """Upload a document and ask a question about it in one request."""
    _, text = await _read_and_extract(file)
    answer = await answer_question(text, question)
    return AskResponse(question=question, answer=answer)


@router.post("/{document_id}/ask", response_model=AskResponse)
async def ask_about_document(
    document_id: str,
    body: AskRequest,
    user=Depends(get_current_user),
):
    """Ask a question about a previously persisted document."""
    try:
        response = (
            get_admin_client()
            .table("documents")
            .select("id,extracted_text")
            .eq("id", document_id)
            .eq("user_id", str(user.id))
            .maybe_single()
            .execute()
        )
    except Exception as exp:
        raise _http_or_500(exp, "Unable to load document") from exp

    if not response.data:
        raise HTTPException(status_code=404, detail="Document not found.")

    text = response.data.get("extracted_text") or ""
    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Document has no extracted text to answer questions against.",
        )

    answer = await answer_question(text, body.question)
    return AskResponse(document_id=document_id, question=body.question, answer=answer)


@router.post("/persist")
async def persist_document(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
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

        characters, words = document_stats(text)
        analysis = await analyze_document(text)

        response = (
            client.table("documents")
            .insert(
                {
                    "id": document_id,
                    "user_id": str(user.id),
                    "filename": safe_name,
                    "storage_path": storage_path,
                    "content_type": file.content_type,
                    "file_size": len(data),
                    "status": "completed",
                    "extracted_text": text,
                    "category": analysis["category"],
                    "classification_confidence": analysis["confidence"],
                    "summary": analysis["summary"],
                }
            )
            .execute()
        )

        doc = (
            response.data[0]
            if response.data
            else {
                "id": document_id,
                "filename": safe_name,
                "status": "completed",
                "word_count": words,
                "character_count": characters,
                "category": analysis.get("category"),
                "summary": analysis.get("summary"),
            }
        )
        if analysis.get("structured_data"):
            doc["structured_data"] = analysis["structured_data"]
        if analysis.get("source"):
            doc["analysis_source"] = analysis["source"]

        return {"document": doc}
    except HTTPException:
        raise
    except Exception as exp:
        try:
            client.storage.from_("documents").remove([storage_path])
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Document could not be stored and processed. ({type(exp).__name__}: {exp})",
        ) from exp


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
            client.storage.from_("documents").remove([storage_path])

        client.table("documents").delete().eq("id", document_id).eq(
            "user_id", str(user.id)
        ).execute()

        return {"deleted": True, "id": document_id}
    except HTTPException:
        raise
    except Exception as exp:
        raise _http_or_500(exp, "Unable to delete document") from exp
