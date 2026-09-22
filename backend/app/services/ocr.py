from __future__ import annotations

from abc import ABC, abstractmethod


class OCRProvider(ABC):
    """Provider-neutral interface for image and scanned-document OCR."""

    @abstractmethod
    async def extract_text(self, data: bytes, content_type: str | None = None) -> str:
        raise NotImplementedError


class UnconfiguredOCRProvider(OCRProvider):
    async def extract_text(self, data: bytes, content_type: str | None = None) -> str:
        raise RuntimeError("No OCR provider is configured.")
