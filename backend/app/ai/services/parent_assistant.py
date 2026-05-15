"""Secure parent assistant context builder and AI responder."""

from __future__ import annotations

import json
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.prompts.parent_assistant import PARENT_ASSISTANT_SYSTEM_PROMPT
from app.ai.providers.openai_provider import AIProviderResult, OpenAIProvider
from app.models.ai import AIConversation, AIConversationMessage
from app.models.attendance import Attendance
from app.models.fee import Payment, StudentFeeAllocation
from app.models.notice import Notice
from app.models.organization import Organization
from app.models.parent import Parent
from app.models.student import Student


class ParentAssistantService:
    def __init__(self, provider: Optional[OpenAIProvider] = None) -> None:
        self.provider = provider or OpenAIProvider()

    async def answer(
        self,
        *,
        db: AsyncSession,
        school: Organization,
        parent_user_id: uuid.UUID,
        parent_clerk_id: str,
        message: str,
        student_id: Optional[uuid.UUID],
        conversation_id: Optional[uuid.UUID],
    ) -> tuple[AIProviderResult, AIConversation]:
        students = await self._authorized_students(db, school.id, parent_clerk_id)
        if not students:
            raise ValueError("No linked children were found for this parent account.")

        if student_id and all(student.id != student_id for student in students):
            raise PermissionError("Parents can only ask about their own children.")

        selected_students = [s for s in students if not student_id or s.id == student_id]
        conversation = await self._conversation(
            db,
            school_id=school.id,
            parent_user_id=parent_user_id,
            student_id=student_id,
            conversation_id=conversation_id,
            first_message=message,
        )
        context = await self._context(db, school, selected_students)
        previous = await self._recent_messages(db, school.id, conversation.id)
        payload = {
            "school": {"name": school.name, "email": school.email},
            "authorized_students": context,
            "recent_conversation": previous,
            "parent_question": message,
        }
        result = await self.provider.json_completion(
            system_prompt=PARENT_ASSISTANT_SYSTEM_PROMPT,
            user_prompt=json.dumps(payload, ensure_ascii=False, default=str),
            feature="parent_assistant",
            max_completion_tokens=1100,
        )

        db.add(AIConversationMessage(school_id=school.id, conversation_id=conversation.id, role="user", content=message))
        db.add(
            AIConversationMessage(
                school_id=school.id,
                conversation_id=conversation.id,
                role="assistant",
                content=result.data.get("answer", ""),
                metadata_={
                    "suggested_actions": result.data.get("suggested_actions", []),
                    "referenced_students": result.data.get("referenced_students", []),
                },
            )
        )
        await db.flush()
        return result, conversation

    @staticmethod
    async def _authorized_students(db: AsyncSession, school_id: uuid.UUID, parent_clerk_id: str) -> list[Student]:
        result = await db.execute(
            select(Student)
            .options(
                selectinload(Student.parent),
                selectinload(Student.academic_class),
                selectinload(Student.section),
            )
            .join(Parent, Student.parent_id == Parent.id)
            .where(
                Student.school_id == school_id,
                Parent.school_id == school_id,
                Parent.clerk_user_id == parent_clerk_id,
                Parent.is_active == True,
                Student.is_active == True,
            )
            .order_by(Student.first_name)
        )
        return list(result.scalars().all())

    @staticmethod
    async def _conversation(
        db: AsyncSession,
        *,
        school_id: uuid.UUID,
        parent_user_id: uuid.UUID,
        student_id: Optional[uuid.UUID],
        conversation_id: Optional[uuid.UUID],
        first_message: str,
    ) -> AIConversation:
        if conversation_id:
            result = await db.execute(
                select(AIConversation).where(
                    AIConversation.id == conversation_id,
                    AIConversation.school_id == school_id,
                    AIConversation.parent_user_id == parent_user_id,
                    AIConversation.is_active == True,
                )
            )
            conversation = result.scalar_one_or_none()
            if not conversation:
                raise PermissionError("Conversation not found for this parent.")
            return conversation

        title = first_message.strip()[:120] or "Parent assistant"
        conversation = AIConversation(
            school_id=school_id,
            parent_user_id=parent_user_id,
            student_id=student_id,
            title=title,
            is_active=True,
        )
        db.add(conversation)
        await db.flush()
        return conversation

    @staticmethod
    async def _recent_messages(db: AsyncSession, school_id: uuid.UUID, conversation_id: uuid.UUID) -> list[dict]:
        result = await db.execute(
            select(AIConversationMessage)
            .where(
                AIConversationMessage.school_id == school_id,
                AIConversationMessage.conversation_id == conversation_id,
            )
            .order_by(AIConversationMessage.created_at.desc())
            .limit(8)
        )
        rows = list(reversed(result.scalars().all()))
        return [{"role": row.role, "content": row.content} for row in rows]

    @staticmethod
    async def _context(db: AsyncSession, school: Organization, students: list[Student]) -> list[dict]:
        today = date.today()
        start = today - timedelta(days=30)
        student_ids = [student.id for student in students]
        class_keys = ParentAssistantService._class_keys(students)

        fee_result = await db.execute(
            select(StudentFeeAllocation).where(
                StudentFeeAllocation.school_id == school.id,
                StudentFeeAllocation.student_id.in_(student_ids),
                StudentFeeAllocation.status.in_(["pending", "partial", "overdue"]),
            )
        )
        fee_rows = fee_result.scalars().all()

        attendance_result = await db.execute(
            select(Attendance.student_id, Attendance.status, func.count(Attendance.id))
            .where(
                Attendance.school_id == school.id,
                Attendance.student_id.in_(student_ids),
                Attendance.date >= start,
                Attendance.date <= today,
            )
            .group_by(Attendance.student_id, Attendance.status)
        )
        attendance_rows = attendance_result.all()

        payment_result = await db.execute(
            select(Payment)
            .where(Payment.school_id == school.id, Payment.student_id.in_(student_ids), Payment.status == "completed")
            .order_by(Payment.payment_date.desc())
            .limit(10)
        )
        payment_rows = payment_result.scalars().all()

        notice_result = await db.execute(
            select(Notice)
            .where(
                Notice.school_id == school.id,
                Notice.is_published == True,
                or_(Notice.target_roles.is_(None), Notice.target_roles == [], Notice.target_roles.any("org:parent")),
                or_(Notice.target_classes.is_(None), Notice.target_classes == [], Notice.target_classes.overlap(class_keys)),
            )
            .order_by(Notice.is_pinned.desc(), Notice.created_at.desc())
            .limit(6)
        )
        notices = notice_result.scalars().all()

        fees_by_student: dict[uuid.UUID, list[dict]] = {student.id: [] for student in students}
        for fee in fee_rows:
            balance = fee.total_amount - fee.discount_amount - fee.paid_amount
            fees_by_student[fee.student_id].append(
                {
                    "month": fee.month,
                    "year": fee.year,
                    "status": fee.status,
                    "total_amount": str(fee.total_amount),
                    "paid_amount": str(fee.paid_amount),
                    "balance": str(balance),
                    "due_date": fee.due_date.isoformat(),
                }
            )

        attendance_by_student: dict[uuid.UUID, dict[str, int]] = {student.id: {} for student in students}
        for student_id, status, count in attendance_rows:
            attendance_by_student[student_id][status] = int(count)

        payments_by_student: dict[uuid.UUID, list[dict]] = {student.id: [] for student in students}
        for payment in payment_rows:
            payments_by_student[payment.student_id].append(
                {
                    "amount": str(payment.amount),
                    "payment_mode": payment.payment_mode,
                    "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
                    "transaction_id": payment.transaction_id,
                }
            )

        shared_notices = [
            {
                "title": notice.title,
                "category": notice.category,
                "priority": notice.priority,
                "content": notice.content[:500],
                "published_at": notice.published_at.isoformat() if notice.published_at else None,
            }
            for notice in notices
        ]

        return [
            {
                "student_name": student.full_name,
                "admission_number": student.admission_number,
                "class": student.academic_class.name if student.academic_class else None,
                "section": student.section.name if student.section else None,
                "roll_number": student.roll_number,
                "pending_fees": fees_by_student.get(student.id, []),
                "attendance_last_30_days": attendance_by_student.get(student.id, {}),
                "recent_payments": payments_by_student.get(student.id, []),
                "recent_notices": shared_notices,
            }
            for student in students
        ]

    @staticmethod
    def _class_keys(students: list[Student]) -> list[str]:
        keys = set()
        for student in students:
            keys.add(str(student.class_id))
            if student.section_id:
                keys.add(str(student.section_id))
            class_name = student.academic_class.name if student.academic_class else ""
            section_name = student.section.name if student.section else ""
            if class_name:
                keys.add(class_name)
            if class_name and section_name:
                keys.update({f"{class_name}-{section_name}", f"{class_name} {section_name}", f"{class_name} Section {section_name}"})
        return sorted(keys)

    @staticmethod
    def total_pending_amount(context: list[dict]) -> Decimal:
        total = Decimal("0")
        for student in context:
            for fee in student.get("pending_fees", []):
                total += Decimal(str(fee.get("balance") or "0"))
        return total
