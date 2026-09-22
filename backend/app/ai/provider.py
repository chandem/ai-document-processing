from __future__ import annotations

from abc import ABC, abstractmethod


class AIProvider(ABC):
    """Provider-neutral interface for future LLM integrations."""

    @abstractmethod
    async def summarize(self, text: str) -> str:
        raise NotImplementedError

    @abstractmethod
    async def answer(self, text: str, question: str) -> str:
        raise NotImplementedError


class UnconfiguredAIProvider(AIProvider):
    async def summarize(self, text: str) -> str:
        raise RuntimeError("No AI provider is configured.")

    async def answer(self, text: str, question: str) -> str:
        raise RuntimeError("No AI provider is configured.")
