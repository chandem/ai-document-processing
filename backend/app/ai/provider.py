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
    """OpenAI provider with bounded chunking for long documents."""

    CHUNK_CHARS = 12000
    MAX_SUMMARY_CHUNKS = 8
    MAX_QA_CHUNKS = 6

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

    @classmethod
    def _chunks(cls, text: str, max_chars: int | None = None) -> list[str]:
        size = max_chars or cls.CHUNK_CHARS
        clean = text.strip()
        if len(clean) <= size:
            return [clean] if clean else []
        return [clean[i:i + size] for i in range(0, len(clean), size)]

    @staticmethod
    def _relevant_chunks(text: str, question: str, limit: int) -> list[str]:
        chunks = OpenAIProvider._chunks(text)
        if len(chunks) <= limit:
            return chunks
        terms = {
            term.lower()
            for term in question.split()
            if len(term.strip(".,?!:;()[]{}\"'")) >= 3
        }
        scored = []
        for index, chunk in enumerate(chunks):
            haystack = chunk.lower()
            score = sum(haystack.count(term) for term in terms)
            scored.append((score, -index, chunk))
        scored.sort(reverse=True)
        return [item[2] for item in scored[:limit]]

    async def summarize(self, text: str, style: str = "concise") -> str:
        chunks = self._chunks(text)
        if not chunks:
            return ""
        if len(chunks) == 1:
            return await self._chat(
                "You are an expert document analyst. Produce clear, accurate summaries. "
                "Focus on key facts, parties, amounts, dates and the main purpose.",
                f"Summarize this document in a {style} style (2-4 short paragraphs max):\n\n{chunks[0]}",
                temperature=0.3,
            )

        partials = []
        for index, chunk in enumerate(chunks[: self.MAX_SUMMARY_CHUNKS], 1):
            partials.append(
                await self._chat(
                    "Summarize this document section accurately. Preserve important facts, "
                    "names, dates, amounts and obligations. Do not invent information.",
                    f"Section {index}:\n{chunk}\n\nReturn a compact factual summary.",
                    temperature=0.2,
                )
            )
        combined = "\n\n".join(partials)
        return await self._chat(
            "You are an expert document analyst. Combine section summaries into one accurate "
            "document summary. Remove repetition and do not invent facts.",
            f"Create a {style} final summary (2-5 short paragraphs):\n\n{combined}",
            temperature=0.2,
        )

    async def classify(self, text: str) -> dict[str, Any]:
        truncated = text[:6000]
        system = (
            "You are a precise document classifier. "
            "Choose exactly one category from: invoice, receipt, contract, report, "
            "resume, form, id_document, other. Respond with a JSON object only."
        )
        user = (
            "Classify this document.\n\n"
            'Return JSON: {"category": "...", "confidence": 0.0-1.0, "reasoning": "brief reason"}\n\n'
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
            confidence = max(0.0, min(1.0, float(data.get("confidence", 0.5))))
            return {
                "category": category,
                "confidence": round(confidence, 3),
                "reasoning": data.get("reasoning", ""),
            }
        except Exception as exc:
            logger.warning("Failed to parse classification JSON: %s", exc)
            return {"category": "other", "confidence": 0.4, "reasoning": "parse_error"}

    async def answer(self, text: str, question: str) -> str:
        chunks = self._relevant_chunks(text, question, self.MAX_QA_CHUNKS)
        if not chunks:
            return "I cannot find enough document content to answer that question."
        context = "\n\n--- DOCUMENT SECTION ---\n\n".join(chunks)
        system = (
            "You answer questions about a document. Use only information present in the supplied "
            "document sections. If the answer is not present, say you cannot find it. "
            "Do not infer unsupported facts."
        )
        return await self._chat(system, f"Document sections:\n{context}\n\nQuestion: {question}", temperature=0.2)

    async def extract_structured(
        self, text: str, schema_hint: str | None = None
    ) -> dict[str, Any]:
        chunks = self._chunks(text)
        hint = schema_hint or (
            "Extract the most important structured fields you can find. Common fields: parties, "
            "dates, amounts, invoice/receipt numbers, addresses, line items, payment terms, total."
        )
        if len(chunks) <= 1:
            context = chunks[0] if chunks else ""
            raw = await self._chat(
                "You extract structured data from documents. Return a single valid JSON object. "
                "Use null for missing values. Do not invent data.",
                f"{hint}\n\nDocument:\n{context}",
                temperature=0.0,
                json_mode=True,
            )
        else:
            partials = []
            for index, chunk in enumerate(chunks[: self.MAX_SUMMARY_CHUNKS], 1):
                partials.append(
                    await self._chat(
                        "Extract only structured facts explicitly present in this document section. "
                        "Return valid JSON and use null for missing values. Do not invent data.",
                        f"{hint}\n\nSection {index}:\n{chunk}",
                        temperature=0.0,
                        json_mode=True,
                    )
                )
            raw = await self._chat(
                "Merge structured JSON objects from document sections. Preserve all non-conflicting "
                "facts, combine line items when present, and never invent missing values. Return JSON only.",
                f"{hint}\n\nSection extraction results:\n" + "\n".join(partials),
                temperature=0.0,
                json_mode=True,
            )
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
