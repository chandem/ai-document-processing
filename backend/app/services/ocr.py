from __future__ import annotations

import io
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class OCRProvider(ABC):
    """Provider-neutral interface for image and scanned-document OCR."""

    @abstractmethod
    async def extract_text(self, data: bytes, content_type: str | None = None) -> str:
        raise NotImplementedError


class UnconfiguredOCRProvider(OCRProvider):
    async def extract_text(self, data: bytes, content_type: str | None = None) -> str:
        raise RuntimeError(
            "No OCR provider is configured. Install pytesseract + system Tesseract, "
            "or set a cloud OCR provider."
        )


class TesseractOCRProvider(OCRProvider):
    """Local OCR using Tesseract (and pdf2image for multi-page PDFs)."""

    def __init__(self, lang: str = "eng", dpi: int = 300):
        self.lang = lang
        self.dpi = dpi

    async def extract_text(self, data: bytes, content_type: str | None = None) -> str:
        # Run sync OCR in a thread to avoid blocking the event loop for large docs
        import asyncio

        return await asyncio.to_thread(self._extract_sync, data, content_type)

    def _extract_sync(self, data: bytes, content_type: str | None) -> str:
        try:
            import pytesseract
            from PIL import Image
        except ImportError as exc:
            raise RuntimeError(
                "OCR dependencies missing. Install: pip install pytesseract Pillow pdf2image"
            ) from exc

        # Image path
        if content_type and content_type.startswith("image/"):
            image = Image.open(io.BytesIO(data))
            text = pytesseract.image_to_string(image, lang=self.lang)
            return text.strip()

        # Treat as PDF (scanned)
        try:
            from pdf2image import convert_from_bytes
        except ImportError as exc:
            raise RuntimeError(
                "pdf2image is required for scanned PDF OCR. "
                "Also install system poppler-utils."
            ) from exc

        try:
            images = convert_from_bytes(data, dpi=self.dpi)
        except Exception as exc:
            logger.warning("pdf2image failed: %s", exc)
            raise RuntimeError(f"Unable to rasterize PDF for OCR: {exc}") from exc

        pages: list[str] = []
        for i, img in enumerate(images):
            page_text = pytesseract.image_to_string(img, lang=self.lang)
            if page_text.strip():
                pages.append(page_text.strip())
            logger.debug("OCR page %d/%d", i + 1, len(images))

        return "\n\n".join(pages)


def get_ocr_provider() -> OCRProvider:
    """Return a usable OCR provider when dependencies are present."""
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401

        return TesseractOCRProvider()
    except ImportError:
        logger.info("Tesseract / Pillow not available – OCR disabled")
        return UnconfiguredOCRProvider()
