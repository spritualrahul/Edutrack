"""AI usage logging and rate limiting."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticatedUser
from app.core.config import get_settings
from app.models.ai import AIUsageLog


async def enforce_ai_limit(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    user: AuthenticatedUser,
    feature: str,
    limit: Optional[int] = None,
) -> None:
    settings = get_settings()
    daily_limit = limit or settings.AI_DAILY_REQUEST_LIMIT
    since = datetime.now(timezone.utc) - timedelta(days=1)
    count = (
        await db.execute(
            select(func.count(AIUsageLog.id)).where(
                AIUsageLog.school_id == school_id,
                AIUsageLog.user_id == user.user_id,
                AIUsageLog.feature == feature,
                AIUsageLog.created_at >= since,
            )
        )
    ).scalar() or 0
    if count >= daily_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily AI limit reached for {feature}.",
        )


async def log_ai_usage(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    user: AuthenticatedUser,
    feature: str,
    model: Optional[str],
    status_: str,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    error_message: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    db.add(
        AIUsageLog(
            school_id=school_id,
            user_id=user.user_id,
            feature=feature,
            provider="openai",
            model=model,
            status=status_,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            error_message=error_message[:1000] if error_message else None,
            metadata_=metadata or {},
        )
    )
    await db.flush()
