"""Attendance tracking model."""

import uuid
from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class Attendance(TenantModel):
    """Daily attendance record for students."""

    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("student_id", "date", name="uq_student_attendance_date"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    section_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id")
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(10), nullable=False  # present, absent, late, half_day, holiday
    )
    remarks: Mapped[Optional[str]] = mapped_column(Text)

    # Who marked the attendance
    marked_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id")
    )

    # Relationships
    student: Mapped["Student"] = relationship(back_populates="attendance_records")
    marked_by_teacher: Mapped[Optional["Teacher"]] = relationship(
        back_populates="attendance_records"
    )


from app.models.student import Student
from app.models.teacher import Teacher
