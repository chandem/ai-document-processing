"""Document summarization."""

from __future__ import annotations

import logging
from typing import Optional

from openai import OpenAI

logger = logging.getLogger(__name__)

SUMMARIZE_PROMPT = """Summarize the following document.
Focus on the key facts, figures, parties involved, and main purpose.
Keep the summary clear and concise ({style}).

Document:
---
{text}
---
"""


class Summarizer:
    def __init__(self, model: str = "gpt-4o-mini", client: Optional[OpenAI] = None):
        self.client = client or OpenAI()
        self.model = model

    def summarize(
        self,
        text: str,
        style: str = "2-3 paragraphs",
        max_chars: int = 12000,
    ) -> str:
        truncated = text[:max_chars]
        prompt = SUMMARIZE_PROMPT.format(text=truncated, style=style)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )

        return (response.choices[0].message.content or "").strip()
