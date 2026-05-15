"""Models package - import all models for Alembic discovery."""

from app.models.base import Base, BaseModel, TenantModel, TimestampMixin
from app.models.organization import Organization, SubscriptionPayment, SubscriptionPlan
from app.models.user import Role, User
from app.models.academic import AcademicClass, Section, Subject
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.parent import Parent
from app.models.attendance import Attendance
from app.models.fee import (
    FeeComponent,
    FeeStructure,
    Payment,
    Receipt,
    StudentFeeAllocation,
)
from app.models.notice import Notice
from app.models.leave import LeaveApplication
from app.models.audit import AuditLog
from app.models.ai import AIConversation, AIConversationMessage, AIUsageLog
from app.models.timetable import TimetableSlot

__all__ = [
    "Base",
    "BaseModel",
    "TenantModel",
    "TimestampMixin",
    "Organization",
    "SubscriptionPayment",
    "SubscriptionPlan",
    "Role",
    "User",
    "AcademicClass",
    "Section",
    "Subject",
    "Student",
    "Teacher",
    "Parent",
    "Attendance",
    "FeeComponent",
    "FeeStructure",
    "Payment",
    "Receipt",
    "StudentFeeAllocation",
    "Notice",
    "LeaveApplication",
    "AuditLog",
    "AIConversation",
    "AIConversationMessage",
    "AIUsageLog",
    "TimetableSlot",
]
