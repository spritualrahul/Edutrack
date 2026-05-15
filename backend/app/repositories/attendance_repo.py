"""Attendance repository."""
import uuid
from datetime import date
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.attendance import Attendance
from app.models.student import Student


class AttendanceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def mark_attendance(self, school_id: uuid.UUID, student_id: uuid.UUID,
                               att_date: date, status: str, class_id: uuid.UUID,
                               section_id: Optional[uuid.UUID] = None,
                               marked_by_id: Optional[uuid.UUID] = None,
                               remarks: Optional[str] = None) -> Attendance:
        student_query = select(Student.id).where(
            Student.id == student_id,
            Student.school_id == school_id,
            Student.class_id == class_id,
            Student.is_active == True,
        )
        if section_id:
            student_query = student_query.where(Student.section_id == section_id)

        student_result = await self.db.execute(student_query)
        if not student_result.scalar_one_or_none():
            raise ValueError("Student does not belong to the requested school/class")

        existing = await self.db.execute(
            select(Attendance).where(
                Attendance.school_id == school_id,
                Attendance.student_id == student_id,
                Attendance.date == att_date,
            )
        )
        record = existing.scalar_one_or_none()
        if record:
            record.status = status
            record.remarks = remarks
        else:
            record = Attendance(school_id=school_id, student_id=student_id, class_id=class_id,
                                section_id=section_id, date=att_date, status=status,
                                marked_by_id=marked_by_id, remarks=remarks)
            self.db.add(record)
        await self.db.flush()
        await self.db.refresh(record)
        return record

    async def bulk_mark(self, school_id: uuid.UUID, records: list, marked_by_id: Optional[uuid.UUID] = None) -> int:
        count = 0
        for rec in records:
            await self.mark_attendance(school_id=school_id, student_id=rec["student_id"],
                                        att_date=rec["date"], status=rec["status"],
                                        class_id=rec.get("class_id"), section_id=rec.get("section_id"),
                                        marked_by_id=marked_by_id, remarks=rec.get("remarks"))
            count += 1
        return count

    async def get_class_attendance(self, school_id: uuid.UUID, class_id: uuid.UUID,
                                    att_date: date, section_id: Optional[uuid.UUID] = None) -> List[Attendance]:
        query = select(Attendance).where(
            Attendance.school_id == school_id, Attendance.class_id == class_id, Attendance.date == att_date)
        if section_id:
            query = query.where(Attendance.section_id == section_id)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_student_attendance(self, student_id: uuid.UUID, school_id: uuid.UUID,
                                      start_date: date, end_date: date) -> List[Attendance]:
        result = await self.db.execute(
            select(Attendance).where(
                Attendance.student_id == student_id, Attendance.school_id == school_id,
                Attendance.date >= start_date, Attendance.date <= end_date
            ).order_by(Attendance.date.desc()))
        return result.scalars().all()

    async def get_summary(self, school_id: uuid.UUID, att_date: date,
                          class_id: Optional[uuid.UUID] = None) -> dict:
        query = select(Attendance.status, func.count(Attendance.id)).where(
            Attendance.school_id == school_id, Attendance.date == att_date)
        if class_id:
            query = query.where(Attendance.class_id == class_id)
        query = query.group_by(Attendance.status)
        result = await self.db.execute(query)
        rows = result.all()
        summary = {"present": 0, "absent": 0, "late": 0, "half_day": 0}
        total = 0
        for status, count in rows:
            summary[status] = count
            total += count
        summary["total_students"] = total
        summary["attendance_percentage"] = round((summary["present"] + summary["late"]) / max(total, 1) * 100, 1)
        return summary
