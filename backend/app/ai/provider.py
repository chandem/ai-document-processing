from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Provider-neutral interface for LLM integrations."""

    @abstractmethod
    async def summarize(self, text: str, style: str = "concise") -> str:
        raise NotImplementedError

    @abstractmethod
    async def classify(self, text: str) -> dict[str, Any]:
        """Return {category, confidence, reasoning}."""
        raise NotImplementedError

    @abstractmethod
    async def answer(self, text: str, question: str) -> str:
        raise NotImplementedError

    @abstractmethod
    async def extract_structured(self, text: str, schema_hint: str | None = None) -> dict[str, Any]:
        raise NotImplementedError


class UnconfiguredAIProvider(AIProvider):
    async def summarize(self, text: str, style: str = "concise") -> str:
        raise RuntimeError("No AI provider is configured. Set OPENAI_API_KEY.")

    async def classify(self, text: str) -> dict[str, Any]:
        raise RuntimeError("No AI provider is configured. Set OPENAI_API_KEY.")

    async def answer(self, text: str, question: str) -> str:
        raise RuntimeError("No AI provider is configured. Set OPENAI_API_KEY.")

    async def extract_structured(self, text: str, schema_hint: str | None = None) -> dict[str, Any]:
        raise RuntimeError("No AI provider is configured. Set OPENAI_API_KEY.")


class OpenAIProvider(AIProvider):
    """OpenAI Chat Completions based provider."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        from openai import AsyncOpenAI

        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def _chat(
        self,
        system: str,
        user: str,
        temperature: float = 0.2,
        json_mode: bool = False,
    ) -> str:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self.client.chat.completions.create(**kwargs)
        return (response.choices[0].message.content or "").strip()

    async def summarize(self, text: str, style: str = "concise") -> str:
        truncated = text[:14000]
        system = (
            "You are an expert document analyst. Produce clear, accurate summaries. "
            "Focus on key facts, parties, amounts, dates and the main purpose of the document."
        )
        user = (
            f"Summarize the following document in a {style} style "
            f"(2-4 short paragraphs max):\n\n{truncated}"
        )
        return await self._chat(system, user, temperature=0.3)

    async def classify(self, text: str) -> dict[str, Any]:
        truncated = text[:6000]
        system = (
            "You are a precise document classifier. "
            "Choose exactly one category from: invoice, receipt, contract, report, "
            "resume, form, id_document, other. "
            "Respond with a JSON object only."
        )
        user = (
            f"Classify this document.\n\n"
            f"Return JSON:\n"
            f'{{"category": "...", "confidence": 0.0-1.0, "reasoning": "brief reason"}}\n\n'
            f"Document:\n{truncated}"
        )
        raw = await self._chat(system, user, temperature=0.0, json_mode=True)
        try:
            data = json.loads(raw)
            category = str(data.get("category", "other")).lower().strip()
            allowed = {
                "invoice", "receipt", "contract", "report", "resume",
                "form", "id_document", "other",
            }
            if category not in allowed:
                category = "other"
            confidence = float(data.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))
            return {
                "category": category,
                "confidence": round(confidence, 3),
                "reasoning": data.get("reasoning", ""),
            }
        except Exception as exc:
            logger.warning("Failed to parse classification JSON: %s", exc)
            return {"category": "other", "confidence": 0.4, "reasoning": "parse_error"}

    async def answer(self, text: str, question: str) -> str:
        truncated = text[:14000]
        system = (
            "You answer questions about a document. "
            "Use only information present in the document. "
            "If the answer is not present, say you cannot find it."
        )
        user = f"Document:\n{truncated}\n\nQuestion: {question}"
        return await self._chat(system, user, temperature=0.2)

    async def extract_structured(
        self, text: str, schema_hint: str | None = None
    ) -> dict[str, Any]:
        truncated = text[:12000]
        hint = schema_hint or (
            "Extract the most important structured fields you can find. "
            "Common fields: parties, dates, amounts, invoice/receipt numbers, "
            "addresses, line items, payment terms, total."
        )
        system = (
            "You extract structured data from documents. "
            "Return a single valid JSON object. Use null for missing values. "
            "Do not invent data that is not present."
        )
        user = f"{hint}\n\nDocument:\n{truncated}"
        raw = await self._chat(system, user, temperature=0.0, json_mode=True)
        try:
            return json.loads(raw)
        except Exception as exc:
            logger.warning("Failed to parse structured extraction: %s", exc)
            return {"error": "parse_failed", "raw": raw[:500]}


def get_ai_provider() -> AIProvider:
    """Factory that returns a configured provider or a safe stub."""
    settings = get_settings()
    if settings.openai_api_key:
        try:
            return OpenAIProvider(api_key=settings.openai_api_key)
        except Exception as exc:
            logger.error("Failed to initialize OpenAI provider: %s", exc)
            return UnconfiguredAIProvider()
    return UnconfiguredAIProvider()
