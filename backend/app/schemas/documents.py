from datetime import datetime
from pydantic import BaseModel


class ExtractedDocument(BaseModel):
    filename: str
    content_type: str | None = None
    text: str
    character_count: int
    word_count: int


class DocumentProcessResponse(BaseModel):
    filename: str
    content_type: str | None = None
    status: str
    text: str
    character_count: int
    word_count: int
    created_at: datetime


class DocumentAnalysisResponse(BaseModel):
    filename: str
    status: str
    category: str
    confidence: float
    summary: str
