"""Student model with full profile and academic details."""

import uuid
from datetime import date
from typing import List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class Student(TenantModel):
    """Student entity with complete profile."""

    __tablename__ = "students"

    # Personal Info
    admission_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(10))  # male, female, other
    blood_group: Mapped[Optional[str]] = mapped_column(String(5))
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))
    aadhaar_number: Mapped[Optional[str]] = mapped_column(String(12))

    # Academic
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    section_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id")
    )
    roll_number: Mapped[Optional[int]] = mapped_column(Integer)
    admission_date: Mapped[Optional[date]] = mapped_column(Date)
    academic_year: Mapped[Optional[str]] = mapped_column(String(9))  # e.g., "2025-2026"

    # Contact
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))

    # Parent/Guardian link
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parents.id")
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, graduated, withdrawn, suspended

    # Clerk user link (for student portal)
    clerk_user_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)

    # Additional data
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="students")
    academic_class: Mapped["AcademicClass"] = relationship()
    section: Mapped[Optional["Section"]] = relationship(back_populates="students")
    parent: Mapped[Optional["Parent"]] = relationship(back_populates="children")
    attendance_records: Mapped[List["Attendance"]] = relationship(back_populates="student")
    payments: Mapped[List["Payment"]] = relationship(back_populates="student")
    fee_allocations: Mapped[List["StudentFeeAllocation"]] = relationship(
        back_populates="student"
    )

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p)


from app.models.organization import Organization
from app.models.academic import AcademicClass, Section
from app.models.parent import Parent
from app.models.attendance import Attendance
from app.models.fee import Payment, StudentFeeAllocation
