"""Tenant-scoped timetable API routes."""

from __future__ import annotations

import uuid
from datetime import date, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import AuthenticatedUser, require_roles, require_school_access
from app.db.session import get_db
from app.models.academic import AcademicClass, Section, Subject
from app.models.teacher import Teacher
from app.models.timetable import TimetableSlot

router = APIRouter(prefix="/schools/{school_id}/timetable", tags=["Timetable"])


class TimetableSlotCreate(BaseModel):
    class_id: uuid.UUID
    section_id: uuid.UUID
    teacher_id: uuid.UUID
    subject_id: Optional[uuid.UUID] = None
    substitute_teacher_id: Optional[uuid.UUID] = None
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    room: Optional[str] = Field(None, max_length=80)
    effective_from: date
    effective_to: Optional[date] = None
    is_substitute: bool = False
    notes: Optional[str] = Field(None, max_length=1200)


class TimetableSlotUpdate(BaseModel):
    class_id: Optional[uuid.UUID] = None
    section_id: Optional[uuid.UUID] = None
    teacher_id: Optional[uuid.UUID] = None
    subject_id: Optional[uuid.UUID] = None
    substitute_teacher_id: Optional[uuid.UUID] = None
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    room: Optional[str] = Field(None, max_length=80)
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_substitute: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=1200)


def _slot_response(slot: TimetableSlot) -> dict:
    class_name = slot.academic_class.name if slot.academic_class else "Class"
    section_name = slot.section.name if slot.section else ""
    teacher_name = slot.teacher.full_name if slot.teacher else "Teacher"
    substitute_name = slot.substitute_teacher.full_name if slot.substitute_teacher else None

    return {
        "id": slot.id,
        "school_id": slot.school_id,
        "class_id": slot.class_id,
        "section_id": slot.section_id,
        "subject_id": slot.subject_id,
        "teacher_id": slot.teacher_id,
        "substitute_teacher_id": slot.substitute_teacher_id,
        "day_of_week": slot.day_of_week,
        "start_time": slot.start_time.isoformat(timespec="minutes"),
        "end_time": slot.end_time.isoformat(timespec="minutes"),
        "room": slot.room,
        "effective_from": slot.effective_from,
        "effective_to": slot.effective_to,
        "is_substitute": slot.is_substitute,
        "is_active": slot.is_active,
        "notes": slot.notes,
        "class_label": f"{class_name}-{section_name}" if section_name else class_name,
        "subject": slot.subject.name if slot.subject else "General",
        "teacher": teacher_name,
        "substitute_teacher": substitute_name,
    }


async def _load_slot(db: AsyncSession, school_id: uuid.UUID, slot_id: uuid.UUID) -> Optional[TimetableSlot]:
    result = await db.execute(
        select(TimetableSlot)
        .options(
            selectinload(TimetableSlot.academic_class),
            selectinload(TimetableSlot.section),
            selectinload(TimetableSlot.subject),
            selectinload(TimetableSlot.teacher),
            selectinload(TimetableSlot.substitute_teacher),
        )
        .where(TimetableSlot.id == slot_id, TimetableSlot.school_id == school_id)
    )
    return result.scalar_one_or_none()


async def _teacher_id_for_user(db: AsyncSession, school_id: uuid.UUID, user: AuthenticatedUser) -> Optional[uuid.UUID]:
    result = await db.execute(
        select(Teacher.id).where(
            Teacher.school_id == school_id,
            Teacher.clerk_user_id == user.clerk_id,
            Teacher.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def _ensure_school_resources(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    class_id: Optional[uuid.UUID] = None,
    section_id: Optional[uuid.UUID] = None,
    subject_id: Optional[uuid.UUID] = None,
    teacher_id: Optional[uuid.UUID] = None,
    substitute_teacher_id: Optional[uuid.UUID] = None,
) -> None:
    if class_id:
        result = await db.execute(select(AcademicClass.id).where(AcademicClass.id == class_id, AcademicClass.school_id == school_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Class does not belong to this school.")

    if section_id:
        section_conditions = [Section.id == section_id, Section.school_id == school_id]
        if class_id:
            section_conditions.append(Section.class_id == class_id)
        result = await db.execute(select(Section.id).where(and_(*section_conditions)))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Section does not belong to this school/class.")

    if subject_id:
        subject_conditions = [Subject.id == subject_id, Subject.school_id == school_id]
        if class_id:
            subject_conditions.append(Subject.class_id == class_id)
        result = await db.execute(select(Subject.id).where(and_(*subject_conditions)))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Subject does not belong to this school/class.")

    teacher_ids = [value for value in (teacher_id, substitute_teacher_id) if value]
    if teacher_ids:
        result = await db.execute(
            select(Teacher.id).where(
                Teacher.school_id == school_id,
                Teacher.id.in_(teacher_ids),
                Teacher.is_active == True,
            )
        )
        found = {row[0] for row in result.all()}
        missing = set(teacher_ids) - found
        if missing:
            raise HTTPException(status_code=400, detail="Teacher does not belong to this school.")


def _validate_time_window(start: time, end: time) -> None:
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time.")


@router.get("")
async def list_timetable_slots(
    school_id: uuid.UUID,
    target_date: Optional[date] = Query(None),
    class_id: Optional[uuid.UUID] = None,
    section_id: Optional[uuid.UUID] = None,
    teacher_id: Optional[uuid.UUID] = None,
    day_of_week: Optional[int] = Query(None, ge=0, le=6),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:teacher")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    conditions = [TimetableSlot.school_id == school_id, TimetableSlot.is_active == True]

    if target_date:
        conditions.append(TimetableSlot.effective_from <= target_date)
        conditions.append(or_(TimetableSlot.effective_to.is_(None), TimetableSlot.effective_to >= target_date))
    if class_id:
        conditions.append(TimetableSlot.class_id == class_id)
    if section_id:
        conditions.append(TimetableSlot.section_id == section_id)
    if teacher_id:
        conditions.append(or_(TimetableSlot.teacher_id == teacher_id, TimetableSlot.substitute_teacher_id == teacher_id))
    if day_of_week is not None:
        conditions.append(TimetableSlot.day_of_week == day_of_week)

    if current_user.role == "org:teacher":
        own_teacher_id = await _teacher_id_for_user(db, school_id, current_user)
        if not own_teacher_id:
            return []
        conditions.append(or_(TimetableSlot.teacher_id == own_teacher_id, TimetableSlot.substitute_teacher_id == own_teacher_id))

    result = await db.execute(
        select(TimetableSlot)
        .options(
            selectinload(TimetableSlot.academic_class),
            selectinload(TimetableSlot.section),
            selectinload(TimetableSlot.subject),
            selectinload(TimetableSlot.teacher),
            selectinload(TimetableSlot.substitute_teacher),
        )
        .where(and_(*conditions))
        .order_by(TimetableSlot.day_of_week, TimetableSlot.start_time, TimetableSlot.created_at)
    )
    return [_slot_response(slot) for slot in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_timetable_slot(
    school_id: uuid.UUID,
    data: TimetableSlotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    _validate_time_window(data.start_time, data.end_time)
    await _ensure_school_resources(
        db,
        school_id=school_id,
        class_id=data.class_id,
        section_id=data.section_id,
        subject_id=data.subject_id,
        teacher_id=data.teacher_id,
        substitute_teacher_id=data.substitute_teacher_id,
    )

    slot = TimetableSlot(school_id=school_id, **data.model_dump())
    db.add(slot)
    await db.flush()
    loaded = await _load_slot(db, school_id, slot.id)
    return _slot_response(loaded or slot)


@router.patch("/{slot_id}")
async def update_timetable_slot(
    school_id: uuid.UUID,
    slot_id: uuid.UUID,
    data: TimetableSlotUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    slot = await _load_slot(db, school_id, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found.")

    update_data = data.model_dump(exclude_unset=True)
    start = update_data.get("start_time", slot.start_time)
    end = update_data.get("end_time", slot.end_time)
    _validate_time_window(start, end)
    await _ensure_school_resources(
        db,
        school_id=school_id,
        class_id=update_data.get("class_id", slot.class_id),
        section_id=update_data.get("section_id", slot.section_id),
        subject_id=update_data.get("subject_id", slot.subject_id),
        teacher_id=update_data.get("teacher_id"),
        substitute_teacher_id=update_data.get("substitute_teacher_id"),
    )

    for key, value in update_data.items():
        setattr(slot, key, value)
    await db.flush()
    loaded = await _load_slot(db, school_id, slot.id)
    return _slot_response(loaded or slot)


@router.delete("/{slot_id}")
async def delete_timetable_slot(
    school_id: uuid.UUID,
    slot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    result = await db.execute(select(TimetableSlot).where(TimetableSlot.id == slot_id, TimetableSlot.school_id == school_id))
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found.")
    slot.is_active = False
    await db.flush()
    return {"message": "Timetable slot removed."}
