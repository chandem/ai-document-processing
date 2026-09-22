"""End-to-end document processing pipeline."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Optional, Sequence, Type

from pydantic import BaseModel

from .classifier import DocumentClassifier
from .extractor import StructuredExtractor
from .ocr import OCREngine
from .schemas import DocumentResult, DocumentType, InvoiceSchema, ReceiptSchema
from .summarizer import Summarizer

logger = logging.getLogger(__name__)

# Default schema mapping based on classification
DEFAULT_SCHEMAS: dict[DocumentType, Type[BaseModel]] = {
    DocumentType.INVOICE: InvoiceSchema,
    DocumentType.RECEIPT: ReceiptSchema,
}


class DocumentPipeline:
    """Orchestrates OCR → Classification → Extraction → Summarization."""

    def __init__(
        self,
        llm_provider: str = "openai",
        ocr_lang: str = "eng",
        classify_model: str = "gpt-4o-mini",
        extract_model: str = "gpt-4o",
        summarize_model: str = "gpt-4o-mini",
    ):
        # Currently only OpenAI is fully wired; can be extended for Anthropic etc.
        self.ocr = OCREngine(lang=ocr_lang)
        self.classifier = DocumentClassifier(model=classify_model)
        self.extractor = StructuredExtractor(model=extract_model)
        self.summarizer = Summarizer(model=summarize_model)

    def process(
        self,
        path: str | Path,
        steps: Optional[Sequence[str]] = None,
        schema: Optional[Type[BaseModel]] = None,
        summarize_style: str = "2-3 paragraphs",
    ) -> DocumentResult:
        """
        Process a document through the selected steps.

        Available steps: "ocr", "classify", "extract", "summarize"
        Default: all steps.
        """
        start = time.perf_counter()
        path = Path(path)
        steps = list(steps) if steps else ["ocr", "classify", "extract", "summarize"]

        result = DocumentResult(file_path=str(path))

        # 1. OCR / text extraction
        if "ocr" in steps:
            logger.info("Running OCR / text extraction...")
            result.raw_text = self.ocr.extract_text(path)
            result.metadata["text_length"] = len(result.raw_text)

        text = result.raw_text or ""

        # 2. Classification
        if "classify" in steps and text:
            logger.info("Classifying document...")
            doc_type, confidence = self.classifier.classify(text)
            result.document_type = doc_type
            result.confidence = confidence

        # 3. Structured extraction
        if "extract" in steps and text:
            chosen_schema = schema
            if chosen_schema is None:
                chosen_schema = DEFAULT_SCHEMAS.get(result.document_type)

            if chosen_schema:
                logger.info("Extracting structured data with schema %s...", chosen_schema.__name__)
                result.extracted_data = self.extractor.extract(text, chosen_schema)
            else:
                logger.info("No schema selected – skipping structured extraction")

        # 4. Summarization
        if "summarize" in steps and text:
            logger.info("Generating summary...")
            result.summary = self.summarizer.summarize(text, style=summarize_style)

        result.processing_time_seconds = round(time.perf_counter() - start, 3)
        logger.info("Pipeline finished in %.2fs", result.processing_time_seconds)
        return result
