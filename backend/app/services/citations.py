"""Extract short source snippets from document text for Q&A citations."""

from __future__ import annotations

import re
from typing import Any


def _tokenize(question: str) -> set[str]:
    return {
        term.lower()
        for term in re.findall(r"[A-Za-z0-9][A-Za-z0-9'%-]{2,}", question)
        if term.lower() not in {
            "the",
            "and",
            "for",
            "with",
            "from",
            "that",
            "this",
            "what",
            "when",
            "where",
            "which",
            "who",
            "how",
            "are",
            "was",
            "were",
            "does",
            "did",
            "can",
            "could",
            "would",
            "should",
            "about",
            "into",
            "your",
            "their",
        }
    }


def extract_citations(
    text: str,
    question: str,
    *,
    max_citations: int = 3,
    window_chars: int = 280,
) -> list[dict[str, Any]]:
    """Return ranked text snippets likely relevant to the question."""
    cleaned = re.sub(r"\s+", " ", (text or "")).strip()
    if not cleaned:
        return []

    terms = _tokenize(question)
    # Prefer sentence-ish splits; fall back to fixed windows
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]
    if len(sentences) < 2:
        sentences = [
            cleaned[i : i + window_chars]
            for i in range(0, len(cleaned), window_chars)
        ]

    scored: list[tuple[float, int, str]] = []
    for index, sentence in enumerate(sentences):
        haystack = sentence.lower()
        score = float(sum(haystack.count(term) for term in terms))
        if score <= 0 and terms:
            continue
        if not terms:
            score = 1.0 / (index + 1)
        snippet = sentence if len(sentence) <= window_chars else sentence[: window_chars - 3] + "..."
        scored.append((score, index, snippet))

    scored.sort(key=lambda item: (-item[0], item[1]))
    citations: list[dict[str, Any]] = []
    seen: set[str] = set()
    for score, index, snippet in scored:
        key = snippet[:80].lower()
        if key in seen:
            continue
        seen.add(key)
        citations.append(
            {
                "index": index,
                "snippet": snippet,
                "score": round(score, 3),
            }
        )
        if len(citations) >= max_citations:
            break

    # If nothing matched terms, still return the first few sentences
    if not citations and sentences:
        for index, sentence in enumerate(sentences[:max_citations]):
            snippet = (
                sentence
                if len(sentence) <= window_chars
                else sentence[: window_chars - 3] + "..."
            )
            citations.append({"index": index, "snippet": snippet, "score": 0.0})

    return citations
