"""Tenant-scoped timetable models."""

import uuid
from datetime import date, time
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Index, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class TimetableSlot(TenantModel):
    """Class/teacher timetable slot for a school."""

    __tablename__ = "timetable_slots"
    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="ck_timetable_day_of_week"),
        CheckConstraint("end_time > start_time", name="ck_timetable_time_range"),
        Index("ix_timetable_school_day_section", "school_id", "day_of_week", "section_id"),
        Index("ix_timetable_school_day_teacher", "school_id", "day_of_week", "teacher_id"),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False
    )
    subject_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False
    )
    substitute_teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id")
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    room: Mapped[Optional[str]] = mapped_column(String(80))
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column(Date)
    is_substitute: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    academic_class: Mapped["AcademicClass"] = relationship()
    section: Mapped["Section"] = relationship()
    subject: Mapped[Optional["Subject"]] = relationship()
    teacher: Mapped["Teacher"] = relationship(foreign_keys=[teacher_id])
    substitute_teacher: Mapped[Optional["Teacher"]] = relationship(foreign_keys=[substitute_teacher_id])


from app.models.academic import AcademicClass, Section, Subject
from app.models.teacher import Teacher
