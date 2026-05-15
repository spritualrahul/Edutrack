"""Pydantic schemas for request/response validation."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ──────────────────────────────────────────────
# Common / Pagination
# ──────────────────────────────────────────────

class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int


class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ──────────────────────────────────────────────
# Organization Schemas
# ──────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: Optional[str] = Field(None, min_length=2, max_length=255)
    unique_code: Optional[str] = Field(None, min_length=3, max_length=32)
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    subscription_plan_id: Optional[uuid.UUID] = None
    subscription_status: Optional[str] = "trial"


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    unique_code: Optional[str] = Field(None, min_length=3, max_length=32)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    academic_year_start: Optional[int] = Field(None, ge=1, le=12)
    academic_year_end: Optional[int] = Field(None, ge=1, le=12)
    settings: Optional[dict] = None
    is_active: Optional[bool] = None
    subscription_plan_id: Optional[uuid.UUID] = None
    subscription_status: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    unique_code: str
    email: str
    phone: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    pincode: Optional[str]
    logo_url: Optional[str]
    website: Optional[str] = None
    academic_year_start: Optional[int] = None
    academic_year_end: Optional[int] = None
    subscription_plan_id: Optional[uuid.UUID] = None
    subscription_plan_name: Optional[str] = None
    subscription_plan_features: Optional[dict] = None
    subscription_status: str
    is_active: bool
    created_at: datetime
    student_count: Optional[int] = 0
    teacher_count: Optional[int] = 0

    model_config = {"from_attributes": True}


class SubscriptionPlanResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    price_monthly: Decimal
    price_yearly: Decimal
    max_students: int
    max_teachers: int
    max_staff: int
    features: dict = Field(default_factory=dict)
    is_active: bool

    model_config = {"from_attributes": True}


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_monthly: Optional[Decimal] = Field(None, gt=0)
    price_yearly: Optional[Decimal] = Field(None, gt=0)
    max_students: Optional[int] = Field(None, ge=1)
    max_teachers: Optional[int] = Field(None, ge=1)
    max_staff: Optional[int] = Field(None, ge=1)
    features: Optional[dict] = None
    is_active: Optional[bool] = None


class SubscriptionCheckoutRequest(BaseModel):
    plan_id: uuid.UUID
    billing_cycle: str = Field("monthly", pattern="^(monthly|yearly)$")


class SubscriptionVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ──────────────────────────────────────────────
# Student Schemas
# ──────────────────────────────────────────────

class StudentCreate(BaseModel):
    admission_number: str = Field(..., min_length=1, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    photo_url: Optional[str] = None
    class_id: uuid.UUID
    section_id: Optional[uuid.UUID] = None
    roll_number: Optional[int] = None
    admission_date: Optional[date] = None
    academic_year: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    photo_url: Optional[str] = None
    class_id: Optional[uuid.UUID] = None
    section_id: Optional[uuid.UUID] = None
    roll_number: Optional[int] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None


class StudentResponse(BaseModel):
    id: uuid.UUID
    admission_number: str
    first_name: str
    last_name: Optional[str]
    full_name: str
    date_of_birth: Optional[date]
    gender: Optional[str]
    blood_group: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    class_name: Optional[str] = None
    section_name: Optional[str] = None
    class_id: Optional[uuid.UUID] = None
    section_id: Optional[uuid.UUID] = None
    roll_number: Optional[int]
    admission_date: Optional[date]
    academic_year: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    photo_url: Optional[str]
    status: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentSearchResult(BaseModel):
    """Lightweight student result for fee counter quick search."""
    id: uuid.UUID
    admission_number: str
    full_name: str
    class_name: str
    section_name: Optional[str]
    parent_phone: Optional[str]
    photo_url: Optional[str]
    pending_fees: Decimal = Decimal("0")


# ──────────────────────────────────────────────
# Teacher Schemas
# ──────────────────────────────────────────────

class TeacherCreate(BaseModel):
    employee_id: str = Field(..., min_length=1)
    first_name: str = Field(..., min_length=1)
    last_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    qualification: Optional[str] = None
    joining_date: Optional[date] = None


class TeacherUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None


class TeacherResponse(BaseModel):
    id: uuid.UUID
    employee_id: str
    first_name: str
    last_name: Optional[str]
    full_name: str
    email: str
    phone: Optional[str]
    designation: Optional[str]
    department: Optional[str]
    qualification: Optional[str]
    joining_date: Optional[date]
    status: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Fee Schemas
# ──────────────────────────────────────────────

class FeeComponentCreate(BaseModel):
    name: str
    amount: Decimal = Field(..., gt=0)
    frequency: str = "monthly"
    due_day: int = Field(10, ge=1, le=31)
    is_optional: bool = False


class FeeStructureCreate(BaseModel):
    name: str
    class_id: uuid.UUID
    academic_year: str
    description: Optional[str] = None
    components: List[FeeComponentCreate]


class FeeStructureResponse(BaseModel):
    id: uuid.UUID
    name: str
    class_id: uuid.UUID
    academic_year: str
    description: Optional[str]
    is_active: bool
    components: List[dict] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class CollectFeeRequest(BaseModel):
    """Request payload for fee collection at counter."""
    student_id: uuid.UUID
    fee_allocation_id: uuid.UUID
    amount: Decimal = Field(..., gt=0)
    payment_mode: str = Field(..., pattern="^(cash|upi|card|cheque|online|bank_transfer)$")
    transaction_id: Optional[str] = None
    reference_number: Optional[str] = None
    cheque_number: Optional[str] = None
    cheque_date: Optional[date] = None
    bank_name: Optional[str] = None
    remarks: Optional[str] = None


class OnlineFeeOrderRequest(BaseModel):
    student_id: uuid.UUID
    fee_allocation_id: uuid.UUID
    amount: Decimal = Field(..., gt=0)


class OnlineFeeVerifyRequest(BaseModel):
    student_id: uuid.UUID
    fee_allocation_id: uuid.UUID
    amount: Decimal = Field(..., gt=0)
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    amount: Decimal
    payment_mode: str
    payment_date: datetime
    transaction_id: Optional[str]
    status: str
    receipt_number: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeeAllocationResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    month: int
    year: int
    total_amount: Decimal
    discount_amount: Decimal
    paid_amount: Decimal
    balance: Decimal = Decimal("0")
    due_date: date
    status: str
    breakdown: Optional[dict] = None

    model_config = {"from_attributes": True}


class DailyCollectionSummary(BaseModel):
    """Daily fee collection summary for the counter dashboard."""
    date: date
    total_collected: Decimal
    total_transactions: int
    by_mode: dict  # {"cash": 5000, "upi": 3000, ...}
    recent_payments: List[PaymentResponse]


# ──────────────────────────────────────────────
# Attendance Schemas
# ──────────────────────────────────────────────

class AttendanceMarkRequest(BaseModel):
    student_id: uuid.UUID
    date: date
    status: str = Field(..., pattern="^(present|absent|late|half_day)$")
    remarks: Optional[str] = None


class BulkAttendanceRequest(BaseModel):
    class_id: uuid.UUID
    section_id: Optional[uuid.UUID] = None
    date: date
    records: List[AttendanceMarkRequest]


class AttendanceResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    date: date
    status: str
    remarks: Optional[str]
    marked_by: Optional[str] = None

    model_config = {"from_attributes": True}


class AttendanceSummary(BaseModel):
    total_students: int
    present: int
    absent: int
    late: int
    half_day: int
    attendance_percentage: float


# ──────────────────────────────────────────────
# Notice Schemas
# ──────────────────────────────────────────────

class NoticeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    category: str = "general"
    priority: str = "normal"
    target_roles: List[str] = Field(default_factory=list)
    target_classes: List[str] = Field(default_factory=list)
    is_published: bool = False
    is_pinned: bool = False
    attachments: List[dict] = Field(default_factory=list)


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    target_roles: Optional[List[str]] = None
    target_classes: Optional[List[str]] = None
    is_published: Optional[bool] = None
    is_pinned: Optional[bool] = None
    attachments: Optional[List[dict]] = None


class NoticeResponse(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    category: str
    priority: str
    is_published: bool
    is_pinned: bool
    target_roles: List[str] = Field(default_factory=list)
    target_classes: List[str] = Field(default_factory=list)
    attachments: List[dict] = Field(default_factory=list)
    published_at: Optional[datetime]
    author_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Leave Schemas
# ──────────────────────────────────────────────

class LeaveApplicationCreate(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: str

    @field_validator("end_date")
    @classmethod
    def end_date_after_start(cls, v, info):
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("End date must be after start date")
        return v


class LeaveApplicationResponse(BaseModel):
    id: uuid.UUID
    teacher_name: Optional[str] = None
    leave_type: str
    start_date: date
    end_date: date
    total_days: int
    reason: str
    status: str
    rejection_reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class LeaveDecisionRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: Optional[str] = None

    @model_validator(mode="after")
    def rejection_reason_required(self):
        if self.status == "rejected" and not self.rejection_reason:
            raise ValueError("Rejection reason is required when rejecting leave")
        return self


# ──────────────────────────────────────────────
# Dashboard Analytics Schemas
# ──────────────────────────────────────────────

class SuperAdminDashboard(BaseModel):
    total_schools: int
    active_schools: int
    total_students: int
    total_teachers: int
    total_revenue: Decimal
    monthly_revenue: Decimal
    schools_by_plan: dict
    recent_schools: List[OrganizationResponse]
    revenue_trend: List[dict]


class SchoolAdminDashboard(BaseModel):
    total_students: int
    total_teachers: int
    total_staff: int
    attendance_today: AttendanceSummary
    fee_collection_this_month: Decimal
    pending_fees: Decimal
    recent_notices: List[NoticeResponse]
    recent_payments: List[PaymentResponse]
    student_growth: List[dict]
    fee_collection_trend: List[dict]


class ReceiptResponse(BaseModel):
    id: uuid.UUID
    receipt_number: str
    student_name: Optional[str] = None
    amount: Decimal
    amount_in_words: Optional[str]
    fee_details: Optional[dict]
    receipt_date: datetime
    pdf_url: Optional[str]

    model_config = {"from_attributes": True}
