"""OpenAI provider wrapper used by all backend AI features."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AIConfigurationError(RuntimeError):
    """Raised when AI provider credentials are not configured."""


@dataclass(slots=True)
class AIProviderResult:
    data: dict[str, Any]
    model: str
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None


class OpenAIProvider:
    """Small async OpenAI adapter with JSON output handling."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.model = self.settings.OPENAI_MODEL
        self.ocr_model = self.settings.OPENAI_OCR_MODEL or self.settings.OPENAI_MODEL

    def _client(self):
        if not self.settings.OPENAI_API_KEY:
            raise AIConfigurationError("OPENAI_API_KEY is not configured")

        from openai import AsyncOpenAI

        return AsyncOpenAI(api_key=self.settings.OPENAI_API_KEY)

    async def json_completion(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        feature: str,
        model: Optional[str] = None,
        max_completion_tokens: int = 1400,
    ) -> AIProviderResult:
        selected_model = model or self.model
        client = self._client()
        response = await client.chat.completions.create(
            model=selected_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=max_completion_tokens,
        )
        content = response.choices[0].message.content or "{}"
        return AIProviderResult(
            data=self._loads_json(content, feature),
            model=selected_model,
            input_tokens=getattr(response.usage, "prompt_tokens", None),
            output_tokens=getattr(response.usage, "completion_tokens", None),
        )

    async def image_json_completion(
        self,
        *,
        system_prompt: str,
        text_prompt: str,
        image_data_url: str,
        feature: str,
        max_completion_tokens: int = 1600,
    ) -> AIProviderResult:
        selected_model = self.ocr_model
        client = self._client()
        response = await client.chat.completions.create(
            model=selected_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text_prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                },
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=max_completion_tokens,
        )
        content = response.choices[0].message.content or "{}"
        return AIProviderResult(
            data=self._loads_json(content, feature),
            model=selected_model,
            input_tokens=getattr(response.usage, "prompt_tokens", None),
            output_tokens=getattr(response.usage, "completion_tokens", None),
        )

    @staticmethod
    def _loads_json(content: str, feature: str) -> dict[str, Any]:
        try:
            loaded = json.loads(content)
        except json.JSONDecodeError as exc:
            logger.warning("OpenAI returned invalid JSON for %s: %s", feature, content[:400])
            raise ValueError("AI response was not valid JSON") from exc
        if not isinstance(loaded, dict):
            raise ValueError("AI response JSON must be an object")
        return loaded
