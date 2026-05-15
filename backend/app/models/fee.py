"""Fee management models: structures, allocations, payments, receipts."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantModel


class FeeStructure(TenantModel):
    """Fee structure template for a class."""

    __tablename__ = "fee_structures"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    academic_year: Mapped[str] = mapped_column(String(9), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="fee_structures")
    fee_components: Mapped[List["FeeComponent"]] = relationship(
        back_populates="fee_structure", cascade="all, delete-orphan"
    )
    allocations: Mapped[List["StudentFeeAllocation"]] = relationship(
        back_populates="fee_structure"
    )


class FeeComponent(TenantModel):
    """Individual fee components within a structure (tuition, transport, etc.)."""

    __tablename__ = "fee_components"

    fee_structure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fee_structures.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Tuition Fee"
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    frequency: Mapped[str] = mapped_column(
        String(20), default="monthly"  # monthly, quarterly, half_yearly, yearly, one_time
    )
    due_day: Mapped[int] = mapped_column(Integer, default=10)  # Day of month
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    fee_structure: Mapped["FeeStructure"] = relationship(back_populates="fee_components")


class StudentFeeAllocation(TenantModel):
    """Fee allocation for a specific student (what they owe)."""

    __tablename__ = "student_fee_allocations"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "fee_structure_id", "month", "year",
            name="uq_student_fee_month"
        ),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    fee_structure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fee_structures.id"), nullable=False
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-12
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="pending"  # pending, partial, paid, overdue, waived
    )
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    breakdown: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    # Relationships
    student: Mapped["Student"] = relationship(back_populates="fee_allocations")
    fee_structure: Mapped["FeeStructure"] = relationship(back_populates="allocations")
    payments: Mapped[List["Payment"]] = relationship(back_populates="fee_allocation")


class Payment(TenantModel):
    """Payment transaction record."""

    __tablename__ = "payments"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    fee_allocation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_fee_allocations.id")
    )

    # Payment details
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[str] = mapped_column(
        String(20), nullable=False  # cash, upi, card, cheque, online, bank_transfer
    )
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    transaction_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100))

    # Cheque details
    cheque_number: Mapped[Optional[str]] = mapped_column(String(20))
    cheque_date: Mapped[Optional[date]] = mapped_column(Date)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100))

    # Razorpay
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(100))
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(100))
    razorpay_signature: Mapped[Optional[str]] = mapped_column(String(255))

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default="completed"  # pending, completed, failed, refunded
    )

    # Collected by
    collected_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    remarks: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    # Relationships
    student: Mapped["Student"] = relationship(back_populates="payments")
    fee_allocation: Mapped[Optional["StudentFeeAllocation"]] = relationship(
        back_populates="payments"
    )
    receipt: Mapped[Optional["Receipt"]] = relationship(
        back_populates="payment", uselist=False
    )
    collected_by: Mapped[Optional["User"]] = relationship()


class Receipt(TenantModel):
    """Fee receipt generated after payment."""

    __tablename__ = "receipts"

    receipt_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id"), unique=True, nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )

    # Receipt data
    receipt_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_in_words: Mapped[Optional[str]] = mapped_column(String(500))
    fee_details: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    pdf_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Relationships
    payment: Mapped["Payment"] = relationship(back_populates="receipt")
    student: Mapped["Student"] = relationship()


from app.models.organization import Organization
from app.models.student import Student
from app.models.user import User
