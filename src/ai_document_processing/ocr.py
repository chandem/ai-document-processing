"""OCR engines for scanned documents and images."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from pdf2image import convert_from_path
from PIL import Image
import pytesseract

from .utils import is_pdf, is_image, load_text_from_pdf

logger = logging.getLogger(__name__)


class OCREngine:
    """Simple OCR facade. Defaults to Tesseract; can be extended for cloud OCR."""

    def __init__(self, lang: str = "eng", dpi: int = 300):
        self.lang = lang
        self.dpi = dpi

    def extract_text(self, path: str | Path) -> str:
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        # Prefer digital text extraction when possible
        if is_pdf(path):
            digital = load_text_from_pdf(path)
            if digital and len(digital.strip()) > 50:
                logger.info("Using digital text extraction from PDF")
                return digital
            logger.info("PDF appears scanned – falling back to OCR")
            return self._ocr_pdf(path)

        if is_image(path):
            return self._ocr_image(path)

        raise ValueError(f"Unsupported file type for OCR: {path.suffix}")

    def _ocr_image(self, path: Path) -> str:
        image = Image.open(path)
        text = pytesseract.image_to_string(image, lang=self.lang)
        return text.strip()

    def _ocr_pdf(self, path: Path) -> str:
        images = convert_from_path(str(path), dpi=self.dpi)
        texts = []
        for i, img in enumerate(images):
            logger.debug("OCR page %d/%d", i + 1, len(images))
            page_text = pytesseract.image_to_string(img, lang=self.lang)
            if page_text.strip():
                texts.append(page_text.strip())
        return "\n\n".join(texts)


def extract_text(path: str | Path, lang: str = "eng") -> str:
    """Convenience function."""
    return OCREngine(lang=lang).extract_text(path)
