"""AI notice draft generation."""

from __future__ import annotations

import json
from typing import Optional

from app.ai.prompts.notice import NOTICE_GENERATOR_SYSTEM_PROMPT
from app.ai.providers.openai_provider import AIProviderResult, OpenAIProvider
from app.models.organization import Organization


class NoticeGeneratorService:
    def __init__(self, provider: Optional[OpenAIProvider] = None) -> None:
        self.provider = provider or OpenAIProvider()

    async def generate(
        self,
        *,
        school: Organization,
        prompt: str,
        audience: list[str],
        tone: str,
        language: str,
        category: Optional[str],
    ) -> AIProviderResult:
        user_prompt = {
            "school_name": school.name,
            "topic_or_instruction": prompt,
            "audience_roles": audience,
            "tone": tone,
            "language": language,
            "preferred_category": category,
        }
        return await self.provider.json_completion(
            system_prompt=NOTICE_GENERATOR_SYSTEM_PROMPT,
            user_prompt=json.dumps(user_prompt, ensure_ascii=False),
            feature="notice_generator",
            max_completion_tokens=900,
        )
