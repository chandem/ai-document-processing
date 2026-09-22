from __future__ import annotations

import logging
import re
from typing import Any

from app.ai.provider import AIProvider, UnconfiguredAIProvider, get_ai_provider

logger = logging.getLogger(__name__)

CATEGORY_KEYWORDS = {
    "invoice": {"invoice", "subtotal", "tax", "total due", "bill to", "amount due"},
    "contract": {"agreement", "contract", "party", "terms and conditions", "whereas"},
    "report": {"executive summary", "findings", "recommendation", "methodology"},
    "resume": {"curriculum vitae", "resume", "experience", "education", "skills"},
    "receipt": {"receipt", "amount paid", "cashier", "change", "thank you for your purchase"},
    "form": {"please fill", "signature", "date of birth", "application form"},
}


def _heuristic_classify(text: str) -> tuple[str, float]:
    normalized = text.lower()
    scores = {
        category: sum(1 for keyword in keywords if keyword in normalized)
        for category, keywords in CATEGORY_KEYWORDS.items()
    }
    category, score = max(scores.items(), key=lambda item: item[1])
    if score == 0:
        return "other", 0.35
    confidence = min(0.55 + score * 0.1, 0.92)
    return category, round(confidence, 2)


def _heuristic_summary(text: str, max_sentences: int = 5) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return "No text was available to summarize."

    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    selected = sentences[:max_sentences]
    summary = " ".join(selected)
    if len(summary) > 1200:
        summary = summary[:1197].rsplit(" ", 1)[0] + "..."
    return summary


async def classify_document(text: str, provider: AIProvider | None = None) -> dict[str, Any]:
    """Classify using LLM when available, otherwise heuristics."""
    provider = provider or get_ai_provider()

    if not isinstance(provider, UnconfiguredAIProvider):
        try:
            result = await provider.classify(text)
            result["source"] = "llm"
            return result
        except Exception as exc:
            logger.warning("LLM classification failed, falling back to heuristics: %s", exc)

    category, confidence = _heuristic_classify(text)
    return {
        "category": category,
        "confidence": confidence,
        "reasoning": "keyword heuristic",
        "source": "heuristic",
    }


async def summarize_document(
    text: str,
    style: str = "concise",
    provider: AIProvider | None = None,
) -> str:
    provider = provider or get_ai_provider()

    if not isinstance(provider, UnconfiguredAIProvider):
        try:
            return await provider.summarize(text, style=style)
        except Exception as exc:
            logger.warning("LLM summary failed, falling back to extractive: %s", exc)

    return _heuristic_summary(text)


async def analyze_document(text: str, provider: AIProvider | None = None) -> dict[str, Any]:
    """Full analysis: classification + summary (+ optional structured data)."""
    provider = provider or get_ai_provider()

    classification = await classify_document(text, provider=provider)
    summary = await summarize_document(text, provider=provider)

    result: dict[str, Any] = {
        "category": classification["category"],
        "confidence": classification["confidence"],
        "reasoning": classification.get("reasoning"),
        "source": classification.get("source", "unknown"),
        "summary": summary,
    }

    # Attempt structured extraction when LLM is available
    if not isinstance(provider, UnconfiguredAIProvider):
        try:
            structured = await provider.extract_structured(text)
            if structured and "error" not in structured:
                result["structured_data"] = structured
        except Exception as exc:
            logger.warning("Structured extraction failed: %s", exc)

    return result


async def answer_question(
    text: str,
    question: str,
    provider: AIProvider | None = None,
) -> str:
    provider = provider or get_ai_provider()

    if isinstance(provider, UnconfiguredAIProvider):
        return (
            "AI provider is not configured. Set OPENAI_API_KEY to enable "
            "question answering over documents."
        )

    try:
        return await provider.answer(text, question)
    except Exception as exc:
        logger.exception("Q&A failed")
        return f"Unable to answer the question: {exc}"
