"""Structured data extraction from documents using LLMs + Pydantic schemas."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional, Type

from openai import OpenAI
from pydantic import BaseModel

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are an expert at extracting structured data from documents.
Extract the information according to the provided JSON schema.
Only include fields that are present in the document. Use null for missing values.
Return a valid JSON object that matches the schema.

JSON Schema:
{schema}

Document text:
---
{text}
---
"""


class StructuredExtractor:
    def __init__(self, model: str = "gpt-4o", client: Optional[OpenAI] = None):
        self.client = client or OpenAI()
        self.model = model

    def extract(
        self,
        text: str,
        schema: Type[BaseModel],
        max_chars: int = 12000,
    ) -> dict[str, Any]:
        """Extract data matching the given Pydantic schema."""
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        truncated = text[:max_chars]
        prompt = EXTRACTION_PROMPT.format(schema=schema_json, text=truncated)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        try:
            raw = json.loads(content)
            # Validate & coerce with Pydantic
            validated = schema.model_validate(raw)
            return validated.model_dump(mode="json")
        except Exception as e:
            logger.warning("Extraction validation failed: %s. Returning raw.", e)
            try:
                return json.loads(content)
            except Exception:
                return {"error": str(e), "raw": content}
