"""OCR-assisted document field extraction."""

from __future__ import annotations

import base64
from typing import Optional

from app.ai.prompts.ocr import OCR_SYSTEM_PROMPT
from app.ai.providers.openai_provider import AIProviderResult, OpenAIProvider
from app.models.organization import Organization


class OCRExtractorService:
    def __init__(self, provider: Optional[OpenAIProvider] = None) -> None:
        self.provider = provider or OpenAIProvider()

    async def extract(
        self,
        *,
        school: Organization,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> AIProviderResult:
        encoded = base64.b64encode(content).decode("ascii")
        data_url = f"data:{content_type};base64,{encoded}"
        prompt = (
            f"School: {school.name}\n"
            f"Filename: {filename}\n"
            "Extract admission/onboarding fields from this document image. "
            "Keep values editable and return confidence for every extracted field."
        )
        return await self.provider.image_json_completion(
            system_prompt=OCR_SYSTEM_PROMPT,
            text_prompt=prompt,
            image_data_url=data_url,
            feature="ocr_extraction",
            max_completion_tokens=1700,
        )
