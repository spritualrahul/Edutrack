"""Organization (School) and subscription models."""

import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TimestampMixin


class SubscriptionPlan(BaseModel):
    """SaaS subscription plans for schools."""

    __tablename__ = "subscription_plans"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    price_monthly: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    price_yearly: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    max_students: Mapped[int] = mapped_column(Integer, default=500)
    max_teachers: Mapped[int] = mapped_column(Integer, default=50)
    max_staff: Mapped[int] = mapped_column(Integer, default=20)
    features: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    organizations: Mapped[List["Organization"]] = relationship(
        back_populates="subscription_plan"
    )


class Organization(BaseModel):
    """School/Organization entity - the core tenant."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    unique_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    country: Mapped[str] = mapped_column(String(100), default="India")
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    website: Mapped[Optional[str]] = mapped_column(String(500))

    # Subscription
    subscription_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscription_plans.id")
    )
    subscription_status: Mapped[str] = mapped_column(
        String(20), default="trial"  # trial, active, expired, cancelled
    )
    subscription_start: Mapped[Optional[date]] = mapped_column(Date)
    subscription_end: Mapped[Optional[date]] = mapped_column(Date)

    # Settings
    academic_year_start: Mapped[Optional[int]] = mapped_column(Integer, default=4)  # April
    academic_year_end: Mapped[Optional[int]] = mapped_column(Integer, default=3)  # March
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    settings: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    onboarded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    subscription_plan: Mapped[Optional["SubscriptionPlan"]] = relationship(
        back_populates="organizations"
    )
    subscription_payments: Mapped[List["SubscriptionPayment"]] = relationship(
        back_populates="organization"
    )
    users: Mapped[List["User"]] = relationship(back_populates="organization")
    students: Mapped[List["Student"]] = relationship(back_populates="organization")
    teachers: Mapped[List["Teacher"]] = relationship(back_populates="organization")
    classes: Mapped[List["AcademicClass"]] = relationship(back_populates="organization")
    fee_structures: Mapped[List["FeeStructure"]] = relationship(
        back_populates="organization"
    )
    notices: Mapped[List["Notice"]] = relationship(back_populates="organization")


class SubscriptionPayment(BaseModel):
    """SaaS subscription payment made by a school."""

    __tablename__ = "subscription_payments"

    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False
    )
    billing_cycle: Mapped[str] = mapped_column(String(20), default="monthly")
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    status: Mapped[str] = mapped_column(String(20), default="created")
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    razorpay_signature: Mapped[Optional[str]] = mapped_column(String(255))
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    organization: Mapped["Organization"] = relationship(back_populates="subscription_payments")
    plan: Mapped["SubscriptionPlan"] = relationship()


# Import at bottom to avoid circular imports
from app.models.user import User
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.academic import AcademicClass
from app.models.fee import FeeStructure
from app.models.notice import Notice
