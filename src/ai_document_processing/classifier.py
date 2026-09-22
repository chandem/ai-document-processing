"""Document type classification using LLMs."""

from __future__ import annotations

import json
import logging
from typing import Optional

from openai import OpenAI

from .schemas import DocumentType

logger = logging.getLogger(__name__)

CLASSIFICATION_PROMPT = """You are an expert document classifier.
Analyze the following document text and classify it into exactly one of these categories:

- invoice
- receipt
- contract
- form
- report
- id_document
- other

Respond with a JSON object only:
{
  "document_type": "<one of the categories above>",
  "confidence": <float between 0 and 1>,
  "reasoning": "<brief explanation>"
}

Document text:
---
{text}
---
"""


class DocumentClassifier:
    def __init__(self, model: str = "gpt-4o-mini", client: Optional[OpenAI] = None):
        self.client = client or OpenAI()
        self.model = model

    def classify(self, text: str, max_chars: int = 4000) -> tuple[DocumentType, float]:
        """Return (document_type, confidence)."""
        truncated = text[:max_chars]
        prompt = CLASSIFICATION_PROMPT.format(text=truncated)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        try:
            data = json.loads(content)
            doc_type_str = data.get("document_type", "other").lower()
            confidence = float(data.get("confidence", 0.5))
            try:
                doc_type = DocumentType(doc_type_str)
            except ValueError:
                doc_type = DocumentType.OTHER
            return doc_type, confidence
        except Exception as e:
            logger.warning("Failed to parse classification response: %s", e)
            return DocumentType.OTHER, 0.3
