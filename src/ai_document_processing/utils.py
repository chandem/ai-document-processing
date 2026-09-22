"""Utility helpers for file loading, text chunking, and common operations."""

from __future__ import annotations

import base64
import mimetypes
from pathlib import Path
from typing import Iterator, Optional

from pypdf import PdfReader


def load_text_from_pdf(path: str | Path) -> str:
    """Extract text from a digital (non-scanned) PDF using pypdf."""
    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages).strip()


def get_mime_type(path: str | Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    return mime or "application/octet-stream"


def file_to_base64(path: str | Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def chunk_text(
    text: str,
    chunk_size: int = 3000,
    overlap: int = 200,
) -> Iterator[str]:
    """Simple character-based chunking with overlap."""
    if len(text) <= chunk_size:
        yield text
        return

    start = 0
    while start < len(text):
        end = start + chunk_size
        yield text[start:end]
        start = end - overlap


def ensure_dir(path: str | Path) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def is_image(path: str | Path) -> bool:
    mime = get_mime_type(path)
    return mime.startswith("image/")


def is_pdf(path: str | Path) -> bool:
    return Path(path).suffix.lower() == ".pdf"
