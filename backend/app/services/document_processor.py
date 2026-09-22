from __future__ import annotations

import io
from pathlib import Path


class DocumentProcessingError(Exception):
    """Raised when a supported document cannot be processed."""


def _extract_pdf(data: bytes) -> str:
    try:
        import fitz
    except ImportError as exc:
        raise DocumentProcessingError(
            "PDF support is not installed. Install PyMuPDF."
        ) from exc

    try:
        with fitz.open(stream=data, filetype="pdf") as pdf:
            return "\n".join(page.get_text("text") for page in pdf).strip()
    except Exception as exc:
        raise DocumentProcessingError(f"Unable to read PDF: {exc}") from exc


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
    except ImportError as exc:
        raise DocumentProcessingError(
            "DOCX support is not installed. Install python-docx."
        ) from exc

    try:
        document = Document(io.BytesIO(data))
        paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except Exception as exc:
        raise DocumentProcessingError(f"Unable to read DOCX: {exc}") from exc


def _extract_text(data: bytes) -> str:
    return data.decode("utf-8", errors="replace").strip()


def extract_text(filename: str, content_type: str | None, data: bytes) -> str:
    extension = Path(filename).suffix.lower()

    if extension == ".pdf" or content_type == "application/pdf":
        return _extract_pdf(data)

    if extension == ".docx" or content_type == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return _extract_docx(data)

    if extension in {".txt", ".md", ".csv", ".json"} or (
        content_type and content_type.startswith("text/")
    ):
        return _extract_text(data)

    if extension in {".png", ".jpg", ".jpeg"}:
        raise DocumentProcessingError(
            "Image OCR is not enabled yet. The processing interface is ready for an OCR provider."
        )

    raise DocumentProcessingError(
        "Unsupported file type. Supported types: PDF, DOCX, TXT, MD, CSV and JSON."
    )


def document_stats(text: str) -> tuple[int, int]:
    return len(text), len(text.split())
