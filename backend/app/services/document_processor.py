from __future__ import annotations

import asyncio
import io
import logging
from pathlib import Path

from app.services.ocr import UnconfiguredOCRProvider, get_ocr_provider

logger = logging.getLogger(__name__)


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


async def _ocr_fallback(data: bytes, content_type: str | None) -> str:
    provider = get_ocr_provider()
    if isinstance(provider, UnconfiguredOCRProvider):
        raise DocumentProcessingError(
            "Document appears to be scanned or is an image, but OCR is not available. "
            "Install pytesseract, Pillow, pdf2image and system packages "
            "(tesseract-ocr, poppler-utils)."
        )
    try:
        return await provider.extract_text(data, content_type)
    except Exception as exc:
        logger.exception("OCR failed")
        raise DocumentProcessingError(f"OCR failed: {exc}") from exc


def extract_text(filename: str, content_type: str | None, data: bytes) -> str:
    """Synchronous extraction (digital text only). Prefer extract_text_async for full OCR support."""
    extension = Path(filename).suffix.lower()

    if extension == ".pdf" or content_type == "application/pdf":
        text = _extract_pdf(data)
        if len(text.strip()) >= 40:
            return text
        # Likely scanned – caller should use async path
        raise DocumentProcessingError(
            "PDF contains little or no digital text. Use the async extract_text_async "
            "endpoint/path so OCR can be applied."
        )

    if extension == ".docx" or content_type == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return _extract_docx(data)

    if extension in {".txt", ".md", ".csv", ".json"} or (
        content_type and content_type.startswith("text/")
    ):
        return _extract_text(data)

    if extension in {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".webp", ".bmp"} or (
        content_type and content_type.startswith("image/")
    ):
        raise DocumentProcessingError(
            "Image OCR requires the async path. Use extract_text_async."
        )

    raise DocumentProcessingError(
        "Unsupported file type. Supported types: PDF, DOCX, TXT, MD, CSV, JSON, "
        "and common image formats (with OCR)."
    )


async def extract_text_async(filename: str, content_type: str | None, data: bytes) -> str:
    """Full extraction including OCR fallback for scanned PDFs and images."""
    extension = Path(filename).suffix.lower()

    if extension == ".pdf" or content_type == "application/pdf":
        text = _extract_pdf(data)
        if len(text.strip()) >= 40:
            return text
        logger.info("PDF has little digital text – falling back to OCR")
        return await _ocr_fallback(data, content_type or "application/pdf")

    if extension == ".docx" or content_type == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return _extract_docx(data)

    if extension in {".txt", ".md", ".csv", ".json"} or (
        content_type and content_type.startswith("text/")
    ):
        return _extract_text(data)

    if extension in {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".webp", ".bmp"} or (
        content_type and content_type.startswith("image/")
    ):
        return await _ocr_fallback(data, content_type or f"image/{extension.lstrip('.')}")

    raise DocumentProcessingError(
        "Unsupported file type. Supported types: PDF, DOCX, TXT, MD, CSV, JSON, "
        "and common image formats (with OCR)."
    )


def document_stats(text: str) -> tuple[int, int]:
    return len(text), len(text.split())
