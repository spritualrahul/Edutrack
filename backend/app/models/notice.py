"""Notice/Announcement model."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class Notice(TenantModel):
    """School notices and announcements."""

    __tablename__ = "notices"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), default="general"  # general, academic, fee, event, holiday, exam
    )
    priority: Mapped[str] = mapped_column(
        String(20), default="normal"  # low, normal, high, urgent
    )

    # Targeting
    target_roles: Mapped[Optional[list]] = mapped_column(
        ARRAY(String), default=list  # e.g., ["org:parent", "org:student", "org:teacher"]
    )
    target_classes: Mapped[Optional[list]] = mapped_column(
        ARRAY(String), default=list  # class IDs
    )

    # Publishing
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)

    # Author
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Attachments
    attachments: Mapped[Optional[list]] = mapped_column(JSONB, default=list)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="notices")
    author: Mapped["User"] = relationship()


from app.models.organization import Organization
from app.models.user import User
