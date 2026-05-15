"""Audit helpers for sensitive tenant-scoped actions."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthenticatedUser
from app.models.audit import AuditLog


async def log_audit_event(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    actor: Optional[AuthenticatedUser],
    action: str,
    resource_type: str,
    resource_id: Optional[uuid.UUID] = None,
    metadata: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Persist an audit log entry without committing the active transaction."""

    event = AuditLog(
        school_id=school_id,
        actor_user_id=actor.user_id if actor else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_=metadata or {},
        ip_address=ip_address,
    )
    db.add(event)
    await db.flush()
    return event
