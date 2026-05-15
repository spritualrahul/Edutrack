"""Fee repository for payment and fee allocation operations."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.fee import FeeStructure, FeeComponent, StudentFeeAllocation, Payment, Receipt
from app.models.student import Student


class FeeRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_fee_structure(self, school_id: uuid.UUID, **kwargs) -> FeeStructure:
        components_data = kwargs.pop("components", [])
        structure = FeeStructure(school_id=school_id, **kwargs)
        self.db.add(structure)
        await self.db.flush()
        for comp in components_data:
            component = FeeComponent(school_id=school_id, fee_structure_id=structure.id, **comp)
            self.db.add(component)
        await self.db.flush()
        await self.db.refresh(structure)
        return structure

    async def get_student_fees(self, student_id: uuid.UUID, school_id: uuid.UUID,
                               status: Optional[str] = None) -> List[StudentFeeAllocation]:
        query = select(StudentFeeAllocation).where(
            StudentFeeAllocation.student_id == student_id, StudentFeeAllocation.school_id == school_id)
        if status:
            query = query.where(StudentFeeAllocation.status == status)
        query = query.order_by(StudentFeeAllocation.year.desc(), StudentFeeAllocation.month.desc())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def collect_fee(self, school_id: uuid.UUID, student_id: uuid.UUID, fee_allocation_id: uuid.UUID,
                          amount: Decimal, payment_mode: str, collected_by_id: Optional[uuid.UUID] = None,
                          **kwargs) -> Payment:
        student_result = await self.db.execute(
            select(Student.id).where(Student.id == student_id, Student.school_id == school_id)
        )
        if not student_result.scalar_one_or_none():
            raise ValueError("Student not found for this school")

        alloc_result = await self.db.execute(
            select(StudentFeeAllocation).where(
                StudentFeeAllocation.id == fee_allocation_id,
                StudentFeeAllocation.student_id == student_id,
                StudentFeeAllocation.school_id == school_id,
            )
        )
        alloc = alloc_result.scalar_one_or_none()
        if not alloc:
            raise ValueError("Fee allocation not found")

        balance = alloc.total_amount - alloc.discount_amount - alloc.paid_amount
        if balance <= 0:
            raise ValueError("This fee allocation is already paid")
        if amount > balance:
            raise ValueError("Payment amount cannot exceed the outstanding balance")

        transaction_id = kwargs.get("transaction_id")
        if transaction_id:
            duplicate_result = await self.db.execute(
                select(Payment.id).where(
                    Payment.school_id == school_id,
                    Payment.transaction_id == transaction_id,
                    Payment.status == "completed",
                )
            )
            if duplicate_result.scalar_one_or_none():
                raise ValueError("Duplicate transaction_id for this school")

        payment = Payment(
            school_id=school_id, student_id=student_id, fee_allocation_id=fee_allocation_id,
            amount=amount, payment_mode=payment_mode, collected_by_id=collected_by_id,
            status="completed", **{k: v for k, v in kwargs.items() if v is not None}
        )
        self.db.add(payment)
        await self.db.flush()

        # Update allocation
        alloc.paid_amount += amount
        balance = alloc.total_amount - alloc.discount_amount - alloc.paid_amount
        if balance <= 0:
            alloc.status = "paid"
        else:
            alloc.status = "partial"
        await self.db.flush()

        # Generate receipt
        receipt_number = await self._generate_receipt_number(school_id)
        receipt = Receipt(
            school_id=school_id, receipt_number=receipt_number, payment_id=payment.id,
            student_id=student_id, amount=amount, amount_in_words=self._amount_to_words(amount),
            fee_details={"month": alloc.month, "year": alloc.year, "breakdown": alloc.breakdown}
        )
        self.db.add(receipt)
        await self.db.flush()
        await self.db.refresh(payment)
        return payment

    async def create_online_payment_order(
        self,
        *,
        school_id: uuid.UUID,
        student_id: uuid.UUID,
        fee_allocation_id: uuid.UUID,
        amount: Decimal,
        razorpay_order_id: str,
        created_by_id: Optional[uuid.UUID],
    ) -> Payment:
        student_result = await self.db.execute(
            select(Student.id).where(Student.id == student_id, Student.school_id == school_id)
        )
        if not student_result.scalar_one_or_none():
            raise ValueError("Student not found for this school")

        alloc_result = await self.db.execute(
            select(StudentFeeAllocation).where(
                StudentFeeAllocation.id == fee_allocation_id,
                StudentFeeAllocation.student_id == student_id,
                StudentFeeAllocation.school_id == school_id,
            )
        )
        alloc = alloc_result.scalar_one_or_none()
        if not alloc:
            raise ValueError("Fee allocation not found")
        balance = alloc.total_amount - alloc.discount_amount - alloc.paid_amount
        if amount > balance:
            raise ValueError("Payment amount cannot exceed the outstanding balance")

        payment = Payment(
            school_id=school_id,
            student_id=student_id,
            fee_allocation_id=fee_allocation_id,
            amount=amount,
            payment_mode="online",
            status="pending",
            razorpay_order_id=razorpay_order_id,
            collected_by_id=created_by_id,
        )
        self.db.add(payment)
        await self.db.flush()
        await self.db.refresh(payment)
        return payment

    async def complete_online_payment(
        self,
        *,
        school_id: uuid.UUID,
        student_id: uuid.UUID,
        fee_allocation_id: uuid.UUID,
        amount: Decimal,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
        collected_by_id: Optional[uuid.UUID],
    ) -> Payment:
        payment_result = await self.db.execute(
            select(Payment)
            .options(selectinload(Payment.receipt))
            .where(
                Payment.school_id == school_id,
                Payment.student_id == student_id,
                Payment.fee_allocation_id == fee_allocation_id,
                Payment.razorpay_order_id == razorpay_order_id,
            )
            .order_by(Payment.created_at.desc())
        )
        payment = payment_result.scalars().first()

        if payment and payment.status == "completed":
            return payment

        alloc_result = await self.db.execute(
            select(StudentFeeAllocation).where(
                StudentFeeAllocation.id == fee_allocation_id,
                StudentFeeAllocation.student_id == student_id,
                StudentFeeAllocation.school_id == school_id,
            )
        )
        alloc = alloc_result.scalar_one_or_none()
        if not alloc:
            raise ValueError("Fee allocation not found")

        balance = alloc.total_amount - alloc.discount_amount - alloc.paid_amount
        if amount > balance:
            raise ValueError("Payment amount cannot exceed the outstanding balance")

        if not payment:
            payment = Payment(
                school_id=school_id,
                student_id=student_id,
                fee_allocation_id=fee_allocation_id,
                amount=amount,
                payment_mode="online",
                status="pending",
                razorpay_order_id=razorpay_order_id,
                collected_by_id=collected_by_id,
            )
            self.db.add(payment)
            await self.db.flush()

        payment.status = "completed"
        payment.amount = amount
        payment.payment_mode = "online"
        payment.transaction_id = razorpay_payment_id
        payment.razorpay_payment_id = razorpay_payment_id
        payment.razorpay_signature = razorpay_signature
        payment.collected_by_id = collected_by_id

        alloc.paid_amount += amount
        balance = alloc.total_amount - alloc.discount_amount - alloc.paid_amount
        alloc.status = "paid" if balance <= 0 else "partial"

        receipt_number = await self._generate_receipt_number(school_id)
        receipt = Receipt(
            school_id=school_id,
            receipt_number=receipt_number,
            payment_id=payment.id,
            student_id=student_id,
            amount=amount,
            amount_in_words=self._amount_to_words(amount),
            fee_details={"month": alloc.month, "year": alloc.year, "breakdown": alloc.breakdown},
        )
        self.db.add(receipt)
        await self.db.flush()
        await self.db.refresh(payment)
        return payment

    async def get_daily_collection(self, school_id: uuid.UUID, target_date: date) -> dict:
        query = select(Payment).options(
            selectinload(Payment.student),
            selectinload(Payment.receipt),
        ).where(
            Payment.school_id == school_id, Payment.status == "completed",
            func.date(Payment.payment_date) == target_date
        ).order_by(Payment.payment_date.desc())
        result = await self.db.execute(query)
        payments = result.scalars().all()

        by_mode = {}
        total = Decimal("0")
        for p in payments:
            total += p.amount
            by_mode[p.payment_mode] = by_mode.get(p.payment_mode, Decimal("0")) + p.amount

        return {"date": target_date, "total_collected": total, "total_transactions": len(payments),
                "by_mode": {k: float(v) for k, v in by_mode.items()}, "recent_payments": payments[:20]}

    async def list_receipts(
        self,
        school_id: uuid.UUID,
        student_ids: Optional[list[uuid.UUID]] = None,
        limit: int = 50,
    ) -> list[Receipt]:
        query = (
            select(Receipt)
            .options(selectinload(Receipt.student), selectinload(Receipt.payment))
            .where(Receipt.school_id == school_id)
            .order_by(Receipt.receipt_date.desc())
            .limit(limit)
        )
        if student_ids is not None:
            query = query.where(Receipt.student_id.in_(student_ids))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_receipt(self, school_id: uuid.UUID, receipt_id: uuid.UUID) -> Optional[Receipt]:
        result = await self.db.execute(
            select(Receipt)
            .options(
                selectinload(Receipt.student).selectinload(Student.parent),
                selectinload(Receipt.payment),
            )
            .where(Receipt.id == receipt_id, Receipt.school_id == school_id)
        )
        return result.scalar_one_or_none()

    async def get_monthly_collection(self, school_id: uuid.UUID, year: int, month: int) -> Decimal:
        result = await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.school_id == school_id, Payment.status == "completed",
                func.extract("year", Payment.payment_date) == year,
                func.extract("month", Payment.payment_date) == month))
        return result.scalar() or Decimal("0")

    async def get_pending_fees_total(self, school_id: uuid.UUID) -> Decimal:
        result = await self.db.execute(
            select(func.coalesce(func.sum(
                StudentFeeAllocation.total_amount - StudentFeeAllocation.discount_amount - StudentFeeAllocation.paid_amount
            ), 0)).where(StudentFeeAllocation.school_id == school_id,
                         StudentFeeAllocation.status.in_(["pending", "partial", "overdue"])))
        return result.scalar() or Decimal("0")

    async def _generate_receipt_number(self, school_id: uuid.UUID) -> str:
        count = await self.db.execute(
            select(func.count(Receipt.id)).where(Receipt.school_id == school_id))
        num = (count.scalar() or 0) + 1
        return f"RCP-{num:06d}"

    @staticmethod
    def _amount_to_words(amount: Decimal) -> str:
        ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
        num = int(amount)
        if num == 0:
            return "Zero Rupees"
        if num < 20:
            return f"{ones[num]} Rupees"
        if num < 100:
            return f"{tens[num // 10]} {ones[num % 10]} Rupees".strip()
        return f"Rupees {num:,}"
