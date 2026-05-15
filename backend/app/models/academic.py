"""Academic models: Classes, Sections, Subjects."""

import uuid
from typing import List, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class AcademicClass(TenantModel):
    """Academic class/grade (e.g., Class 1, Class 10)."""

    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_class_school_name"),
    )

    name: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "Class 10"
    numeric_grade: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g., 10
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="classes")
    sections: Mapped[List["Section"]] = relationship(
        back_populates="academic_class", cascade="all, delete-orphan"
    )
    subjects: Mapped[List["Subject"]] = relationship(
        back_populates="academic_class", cascade="all, delete-orphan"
    )


class Section(TenantModel):
    """Section within a class (e.g., Section A, Section B)."""

    __tablename__ = "sections"
    __table_args__ = (
        UniqueConstraint("class_id", "name", name="uq_section_class_name"),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g., "A"
    capacity: Mapped[int] = mapped_column(Integer, default=40)
    class_teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    academic_class: Mapped["AcademicClass"] = relationship(back_populates="sections")
    class_teacher: Mapped[Optional["Teacher"]] = relationship(
        back_populates="class_teacher_of"
    )
    students: Mapped[List["Student"]] = relationship(back_populates="section")


class Subject(TenantModel):
    """Subject taught in a class."""

    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("class_id", "name", name="uq_subject_class_name"),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    academic_class: Mapped["AcademicClass"] = relationship(back_populates="subjects")


from app.models.organization import Organization
from app.models.teacher import Teacher
from app.models.student import Student
