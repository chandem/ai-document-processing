from __future__ import annotations

import re


CATEGORY_KEYWORDS = {
    "invoice": {"invoice", "subtotal", "tax", "total due", "bill to"},
    "contract": {"agreement", "contract", "party", "terms and conditions", "whereas"},
    "report": {"executive summary", "findings", "recommendation", "methodology"},
    "resume": {"curriculum vitae", "resume", "experience", "education", "skills"},
    "receipt": {"receipt", "amount paid", "cashier", "change"},
}


def classify_document(text: str) -> tuple[str, float]:
    normalized = text.lower()
    scores = {
        category: sum(1 for keyword in keywords if keyword in normalized)
        for category, keywords in CATEGORY_KEYWORDS.items()
    }
    category, score = max(scores.items(), key=lambda item: item[1])
    if score == 0:
        return "other", 0.35
    confidence = min(0.55 + score * 0.1, 0.95)
    return category, round(confidence, 2)


def simple_summary(text: str, max_sentences: int = 5) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return "No text was available to summarize."

    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    selected = sentences[:max_sentences]
    summary = " ".join(selected)
    if len(summary) > 1200:
        summary = summary[:1197].rsplit(" ", 1)[0] + "..."
    return summary


def analyze_document(text: str) -> dict:
    category, confidence = classify_document(text)
    return {
        "category": category,
        "confidence": confidence,
        "summary": simple_summary(text),
    }
