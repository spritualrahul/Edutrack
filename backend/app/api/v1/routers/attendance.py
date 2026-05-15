"""Attendance management API routes."""
import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import AuthenticatedUser, require_roles, require_school_access, require_own_student_access
from app.db.session import get_db
from app.models.teacher import Teacher
from app.repositories.attendance_repo import AttendanceRepository
from app.schemas.schemas import BulkAttendanceRequest, AttendanceSummary

router = APIRouter(prefix="/schools/{school_id}/attendance", tags=["Attendance"])


@router.post("/bulk")
async def mark_bulk_attendance(
    school_id: uuid.UUID, data: BulkAttendanceRequest, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:teacher")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    repo = AttendanceRepository(db)
    records = [{"student_id": r.student_id, "date": r.date, "status": r.status,
                "class_id": data.class_id, "section_id": data.section_id, "remarks": r.remarks}
               for r in data.records]
    marked_by_teacher_id = None
    if current_user.role == "org:teacher":
        teacher_result = await db.execute(
            select(Teacher.id).where(
                Teacher.school_id == school_id,
                Teacher.clerk_user_id == current_user.clerk_id,
                Teacher.is_active == True,
            )
        )
        marked_by_teacher_id = teacher_result.scalar_one_or_none()

    try:
        count = await repo.bulk_mark(school_id, records, marked_by_id=marked_by_teacher_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": f"Marked attendance for {count} students", "count": count}


@router.get("/summary", response_model=AttendanceSummary)
async def get_attendance_summary(
    school_id: uuid.UUID, target_date: date = Query(default=None),
    class_id: Optional[uuid.UUID] = None, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:teacher")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    if not target_date:
        target_date = date.today()
    repo = AttendanceRepository(db)
    summary = await repo.get_summary(school_id, target_date, class_id)
    return AttendanceSummary(**summary)


@router.get("/student/{student_id}")
async def get_student_attendance(
    school_id: uuid.UUID, student_id: uuid.UUID,
    start_date: date = Query(...), end_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:teacher", "org:parent", "org:student")),
    _school: AuthenticatedUser = Depends(require_school_access()),
    _own: AuthenticatedUser = Depends(require_own_student_access()),
):
    repo = AttendanceRepository(db)
    records = await repo.get_student_attendance(student_id, school_id, start_date, end_date)
    return [{"id": r.id, "date": r.date, "status": r.status, "remarks": r.remarks} for r in records]
