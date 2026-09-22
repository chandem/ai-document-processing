"""FastAPI application for document processing."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .pipeline import DocumentPipeline
from .schemas import DocumentResult, InvoiceSchema, ReceiptSchema

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Document Processing API",
    description="OCR, classify, extract structured data, and summarize documents.",
    version="0.1.0",
)

pipeline = DocumentPipeline()

SCHEMA_MAP = {
    "invoice": InvoiceSchema,
    "receipt": ReceiptSchema,
}


@app.get("/")
def root():
    return {
        "service": "AI Document Processing",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/process", response_model=DocumentResult)
async def process_document(
    file: UploadFile = File(...),
    steps: Optional[str] = Form(None, description="Comma-separated: ocr,classify,extract,summarize"),
    schema: Optional[str] = Form(None, description="invoice | receipt"),
):
    """Upload a document and run the processing pipeline."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif"}:
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    step_list = [s.strip() for s in steps.split(",")] if steps else None
    chosen_schema = SCHEMA_MAP.get(schema.lower()) if schema else None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = pipeline.process(tmp_path, steps=step_list, schema=chosen_schema)
        return result
    except Exception as e:
        logger.exception("Processing failed")
        raise HTTPException(500, str(e)) from e
    finally:
        if "tmp_path" in locals() and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


@app.post("/classify")
async def classify_document(file: UploadFile = File(...)):
    """Classify document type only."""
    return await process_document(file=file, steps="ocr,classify")
