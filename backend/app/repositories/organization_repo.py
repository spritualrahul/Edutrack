"""Organization repository for database operations."""

import re
import uuid
from datetime import date
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.organization import Organization, SubscriptionPlan, SubscriptionPayment
from app.models.student import Student
from app.models.teacher import Teacher


class OrganizationRepository:
    """Data access layer for organizations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> Organization:
        if not kwargs.get("slug"):
            kwargs["slug"] = await self.generate_slug(kwargs["name"])
        if not kwargs.get("unique_code"):
            kwargs["unique_code"] = await self.generate_unique_code(kwargs["name"])

        org = Organization(**kwargs)
        self.db.add(org)
        await self.db.flush()
        await self.db.refresh(org)
        return org

    async def generate_slug(self, name: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "school"
        slug = base
        counter = 2
        while await self.get_by_slug(slug):
            slug = f"{base}-{counter}"
            counter += 1
        return slug

    async def generate_unique_code(self, name: str) -> str:
        letters = re.sub(r"[^A-Z0-9]", "", name.upper())[:4] or "SCH"
        while True:
            code = f"{letters}-{uuid.uuid4().hex[:6].upper()}"
            result = await self.db.execute(
                select(Organization.id).where(Organization.unique_code == code)
            )
            if not result.scalar_one_or_none():
                return code

    async def get_by_id(self, org_id: uuid.UUID) -> Optional[Organization]:
        result = await self.db.execute(
            select(Organization)
            .options(selectinload(Organization.subscription_plan))
            .where(Organization.id == org_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Organization]:
        result = await self.db.execute(
            select(Organization).where(Organization.slug == slug)
        )
        return result.scalar_one_or_none()

    async def list_all(
        self,
        offset: int = 0,
        limit: int = 20,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Organization], int]:
        query = select(Organization).options(selectinload(Organization.subscription_plan))

        if is_active is not None:
            query = query.where(Organization.is_active == is_active)
        if search:
            query = query.where(
                Organization.name.ilike(f"%{search}%")
                | Organization.email.ilike(f"%{search}%")
            )

        # Count
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar()

        # Paginate
        query = query.order_by(Organization.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def update(self, org_id: uuid.UUID, **kwargs) -> Optional[Organization]:
        org = await self.get_by_id(org_id)
        if not org:
            return None
        if kwargs.get("slug"):
            duplicate = await self.get_by_slug(kwargs["slug"])
            if duplicate and duplicate.id != org_id:
                raise ValueError("Organization with this slug already exists")
        if kwargs.get("unique_code"):
            result = await self.db.execute(
                select(Organization.id).where(Organization.unique_code == kwargs["unique_code"])
            )
            duplicate_id = result.scalar_one_or_none()
            if duplicate_id and duplicate_id != org_id:
                raise ValueError("Organization with this unique code already exists")
        for key, value in kwargs.items():
            if hasattr(org, key):
                setattr(org, key, value)
        await self.db.flush()
        await self.db.refresh(org)
        return org

    async def get_stats(self, org_id: uuid.UUID) -> dict:
        """Get organization statistics."""
        student_count = (
            await self.db.execute(
                select(func.count()).where(
                    Student.school_id == org_id, Student.is_active == True
                )
            )
        ).scalar()

        teacher_count = (
            await self.db.execute(
                select(func.count()).where(
                    Teacher.school_id == org_id, Teacher.is_active == True
                )
            )
        ).scalar()

        return {
            "student_count": student_count or 0,
            "teacher_count": teacher_count or 0,
        }

    async def get_all_stats(self) -> dict:
        """Get platform-wide statistics for super admin."""
        total_schools = (
            await self.db.execute(select(func.count(Organization.id)))
        ).scalar() or 0

        active_schools = (
            await self.db.execute(
                select(func.count(Organization.id)).where(Organization.is_active == True)
            )
        ).scalar() or 0

        total_students = (
            await self.db.execute(
                select(func.count(Student.id)).where(Student.is_active == True)
            )
        ).scalar() or 0

        total_teachers = (
            await self.db.execute(
                select(func.count(Teacher.id)).where(Teacher.is_active == True)
            )
        ).scalar() or 0

        total_revenue = (
            await self.db.execute(
                select(func.coalesce(func.sum(SubscriptionPayment.amount), 0)).where(
                    SubscriptionPayment.status == "completed"
                )
            )
        ).scalar() or 0

        today = date.today()
        monthly_revenue = (
            await self.db.execute(
                select(func.coalesce(func.sum(SubscriptionPayment.amount), 0)).where(
                    SubscriptionPayment.status == "completed",
                    func.extract("year", SubscriptionPayment.created_at) == today.year,
                    func.extract("month", SubscriptionPayment.created_at) == today.month,
                )
            )
        ).scalar() or 0

        plan_rows = (
            await self.db.execute(
                select(SubscriptionPlan.name, func.count(Organization.id))
                .join(Organization, Organization.subscription_plan_id == SubscriptionPlan.id, isouter=True)
                .group_by(SubscriptionPlan.name)
                .order_by(SubscriptionPlan.name)
            )
        ).all()

        return {
            "total_schools": total_schools,
            "active_schools": active_schools,
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_revenue": total_revenue,
            "monthly_revenue": monthly_revenue,
            "schools_by_plan": {name: count for name, count in plan_rows},
        }

    async def list_subscription_plans(self, active_only: bool = True) -> list[SubscriptionPlan]:
        query = select(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly.asc())
        if active_only:
            query = query.where(SubscriptionPlan.is_active == True)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_subscription_plan(self, plan_id: uuid.UUID) -> Optional[SubscriptionPlan]:
        result = await self.db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
        )
        return result.scalar_one_or_none()

    async def update_subscription_plan(
        self, plan_id: uuid.UUID, **kwargs
    ) -> Optional[SubscriptionPlan]:
        plan = await self.get_subscription_plan(plan_id)
        if not plan:
            return None
        for key, value in kwargs.items():
            if hasattr(plan, key):
                setattr(plan, key, value)
        await self.db.flush()
        await self.db.refresh(plan)
        return plan

    async def create_subscription_payment(self, **kwargs) -> SubscriptionPayment:
        payment = SubscriptionPayment(**kwargs)
        self.db.add(payment)
        await self.db.flush()
        await self.db.refresh(payment)
        return payment

    async def get_subscription_payment_by_order(
        self, school_id: uuid.UUID, order_id: str
    ) -> Optional[SubscriptionPayment]:
        result = await self.db.execute(
            select(SubscriptionPayment)
            .options(selectinload(SubscriptionPayment.plan))
            .where(
                SubscriptionPayment.school_id == school_id,
                SubscriptionPayment.razorpay_order_id == order_id,
            )
        )
        return result.scalar_one_or_none()
