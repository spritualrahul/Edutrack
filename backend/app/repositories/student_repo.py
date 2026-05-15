"""Student repository for database operations."""
import uuid
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.student import Student
from app.models.academic import AcademicClass, Section
from app.models.parent import Parent
from app.models.fee import StudentFeeAllocation


class StudentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, school_id: uuid.UUID, **kwargs) -> Student:
        student = Student(school_id=school_id, **kwargs)
        self.db.add(student)
        await self.db.flush()
        await self.db.refresh(student)
        return student

    async def get_by_id(self, student_id: uuid.UUID, school_id: uuid.UUID) -> Optional[Student]:
        result = await self.db.execute(
            select(Student)
            .options(selectinload(Student.academic_class), selectinload(Student.section), selectinload(Student.parent))
            .where(Student.id == student_id, Student.school_id == school_id)
        )
        return result.scalar_one_or_none()

    async def list_students(self, school_id: uuid.UUID, offset: int = 0, limit: int = 20,
                            class_id: Optional[uuid.UUID] = None, search: Optional[str] = None) -> Tuple[List[Student], int]:
        query = select(Student).where(Student.school_id == school_id)
        if class_id:
            query = query.where(Student.class_id == class_id)
        if search:
            query = query.where(
                Student.first_name.ilike(f"%{search}%") | Student.last_name.ilike(f"%{search}%") | Student.admission_number.ilike(f"%{search}%")
            )
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar()
        query = query.options(
            selectinload(Student.academic_class),
            selectinload(Student.section),
            selectinload(Student.parent),
        ).order_by(Student.first_name).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def search_for_fee_counter(self, school_id: uuid.UUID, query: str) -> List[dict]:
        stmt = (
            select(Student.id, Student.admission_number, Student.first_name, Student.last_name,
                   Student.photo_url, AcademicClass.name.label("class_name"), Section.name.label("section_name"),
                   Parent.primary_phone.label("parent_phone"))
            .outerjoin(AcademicClass, Student.class_id == AcademicClass.id)
            .outerjoin(Section, Student.section_id == Section.id)
            .outerjoin(Parent, Student.parent_id == Parent.id)
            .where(Student.school_id == school_id, Student.is_active == True,
                   (Student.first_name.ilike(f"%{query}%") | Student.admission_number.ilike(f"%{query}%")))
            .limit(10)
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        students = []
        for row in rows:
            pending_q = select(func.coalesce(func.sum(StudentFeeAllocation.total_amount - StudentFeeAllocation.discount_amount - StudentFeeAllocation.paid_amount), 0)).where(
                StudentFeeAllocation.student_id == row.id, StudentFeeAllocation.status.in_(["pending", "partial", "overdue"]))
            pending = (await self.db.execute(pending_q)).scalar()
            students.append({"id": row.id, "admission_number": row.admission_number, "full_name": f"{row.first_name} {row.last_name or ''}".strip(),
                             "class_name": row.class_name or "", "section_name": row.section_name, "parent_phone": row.parent_phone,
                             "photo_url": row.photo_url, "pending_fees": pending or Decimal("0")})
        return students

    async def update(self, student_id: uuid.UUID, school_id: uuid.UUID, **kwargs) -> Optional[Student]:
        student = await self.get_by_id(student_id, school_id)
        if not student:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(student, key):
                setattr(student, key, value)
        await self.db.flush()
        await self.db.refresh(student)
        return student
