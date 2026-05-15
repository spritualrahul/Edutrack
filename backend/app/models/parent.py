"""Parent/Guardian model."""

import uuid
from typing import List, Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class Parent(TenantModel):
    """Parent/Guardian entity linked to students."""

    __tablename__ = "parents"

    # Father details
    father_name: Mapped[Optional[str]] = mapped_column(String(100))
    father_phone: Mapped[Optional[str]] = mapped_column(String(20))
    father_email: Mapped[Optional[str]] = mapped_column(String(255))
    father_occupation: Mapped[Optional[str]] = mapped_column(String(100))

    # Mother details
    mother_name: Mapped[Optional[str]] = mapped_column(String(100))
    mother_phone: Mapped[Optional[str]] = mapped_column(String(20))
    mother_email: Mapped[Optional[str]] = mapped_column(String(255))
    mother_occupation: Mapped[Optional[str]] = mapped_column(String(100))

    # Guardian details (if different)
    guardian_name: Mapped[Optional[str]] = mapped_column(String(100))
    guardian_relation: Mapped[Optional[str]] = mapped_column(String(50))
    guardian_phone: Mapped[Optional[str]] = mapped_column(String(20))
    guardian_email: Mapped[Optional[str]] = mapped_column(String(255))

    # Primary contact
    primary_contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    primary_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    primary_email: Mapped[Optional[str]] = mapped_column(String(255))

    # Address
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))

    # Clerk link
    clerk_user_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Additional
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    children: Mapped[List["Student"]] = relationship(back_populates="parent")


from app.models.student import Student
