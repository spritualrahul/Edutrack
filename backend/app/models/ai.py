"""AI feature models for usage logging and parent chat history."""

import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class AIUsageLog(TenantModel):
    """Tenant-scoped audit/usage record for AI requests."""

    __tablename__ = "ai_usage_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    feature: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(40), default="openai")
    model: Mapped[Optional[str]] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default="success", index=True)
    input_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    output_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    user: Mapped["User"] = relationship()


class AIConversation(TenantModel):
    """Parent assistant conversation scoped to a single tenant and parent."""

    __tablename__ = "ai_conversations"

    parent_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), index=True
    )
    title: Mapped[str] = mapped_column(String(160), default="Parent assistant")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    parent_user: Mapped["User"] = relationship()
    student: Mapped[Optional["Student"]] = relationship()
    messages: Mapped[list["AIConversationMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class AIConversationMessage(TenantModel):
    """Stored parent assistant message."""

    __tablename__ = "ai_conversation_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_conversations.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    conversation: Mapped["AIConversation"] = relationship(back_populates="messages")


from app.models.student import Student
from app.models.user import User
