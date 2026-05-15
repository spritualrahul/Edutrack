"""Leave application model for teachers."""

import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class LeaveApplication(TenantModel):
    """Teacher leave application."""

    __tablename__ = "leave_applications"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False
    )
    leave_type: Mapped[str] = mapped_column(
        String(30), nullable=False  # casual, sick, earned, maternity, other
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_days: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"  # pending, approved, rejected, cancelled
    )
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    teacher: Mapped["Teacher"] = relationship(back_populates="leave_applications")
    approved_by: Mapped[Optional["User"]] = relationship()


from app.models.teacher import Teacher
from app.models.user import User
