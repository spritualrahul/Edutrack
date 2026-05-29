"""Teacher model with professional details."""

import uuid
from datetime import date
from typing import List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class Teacher(TenantModel):
    """Teacher/Staff entity."""

    __tablename__ = "teachers"

    # Personal
    employee_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(10))
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))
    address: Mapped[Optional[str]] = mapped_column(Text)

    # Professional
    designation: Mapped[Optional[str]] = mapped_column(String(100))
    department: Mapped[Optional[str]] = mapped_column(String(100))
    qualification: Mapped[Optional[str]] = mapped_column(String(255))
    experience_years: Mapped[Optional[int]] = mapped_column()
    joining_date: Mapped[Optional[date]] = mapped_column(Date)
    specialization: Mapped[Optional[str]] = mapped_column(String(255))

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    staff_type: Mapped[Optional[str]] = mapped_column(String(20), default="teaching", server_default="teaching")  # teaching, non_teaching

    # Clerk user link
    clerk_user_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)

    # Additional
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="teachers")
    class_teacher_of: Mapped[List["Section"]] = relationship(back_populates="class_teacher")
    attendance_records: Mapped[List["Attendance"]] = relationship(
        back_populates="marked_by_teacher"
    )
    leave_applications: Mapped[List["LeaveApplication"]] = relationship(
        back_populates="teacher"
    )

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p)


from app.models.organization import Organization
from app.models.academic import Section
from app.models.attendance import Attendance
from app.models.leave import LeaveApplication
