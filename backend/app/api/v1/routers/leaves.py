"""Teacher leave workflow routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_audit_event
from app.core.auth import AuthenticatedUser, require_roles, require_school_access
from app.db.session import get_db
from app.models.leave import LeaveApplication
from app.models.organization import Organization
from app.models.teacher import Teacher
from app.models.user import Role, User
from app.schemas.schemas import (
    LeaveApplicationCreate,
    LeaveApplicationResponse,
    LeaveDecisionRequest,
)
from app.services.email_service import EmailService

router = APIRouter(prefix="/schools/{school_id}/leaves", tags=["Leave Workflow"])


def _serialize_leave(leave: LeaveApplication) -> dict:
    return {
        "id": leave.id,
        "teacher_name": leave.teacher.full_name if leave.teacher else None,
        "leave_type": leave.leave_type,
        "start_date": leave.start_date,
        "end_date": leave.end_date,
        "total_days": leave.total_days,
        "reason": leave.reason,
        "status": leave.status,
        "rejection_reason": leave.rejection_reason,
        "created_at": leave.created_at,
    }


async def _get_current_teacher(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    current_user: AuthenticatedUser,
) -> Teacher:
    result = await db.execute(
        select(Teacher).where(
            Teacher.school_id == school_id,
            Teacher.clerk_user_id == current_user.clerk_id,
            Teacher.is_active == True,
        )
    )
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not linked to an active teacher profile in this school.",
        )
    return teacher


async def _get_school(db: AsyncSession, school_id: uuid.UUID) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == school_id))
    school = result.scalar_one_or_none()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


async def _get_school_admin_emails(db: AsyncSession, school_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(User.email)
        .join(Role, User.role_id == Role.id)
        .where(
            User.school_id == school_id,
            User.is_active == True,
            Role.name == "org:school_admin",
        )
    )
    return [email for email in result.scalars().all() if email]


@router.get("/me", response_model=list[LeaveApplicationResponse])
async def list_my_leaves(
    school_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:teacher")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    teacher = await _get_current_teacher(db, school_id=school_id, current_user=current_user)
    result = await db.execute(
        select(LeaveApplication)
        .options(selectinload(LeaveApplication.teacher))
        .where(LeaveApplication.school_id == school_id, LeaveApplication.teacher_id == teacher.id)
        .order_by(LeaveApplication.created_at.desc())
    )
    return [_serialize_leave(leave) for leave in result.scalars().all()]


@router.post("/me", response_model=LeaveApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_leave(
    school_id: uuid.UUID,
    data: LeaveApplicationCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:teacher")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    teacher = await _get_current_teacher(db, school_id=school_id, current_user=current_user)
    total_days = (data.end_date - data.start_date).days + 1

    leave = LeaveApplication(
        school_id=school_id,
        teacher_id=teacher.id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        total_days=total_days,
        reason=data.reason,
        status="pending",
    )
    db.add(leave)
    await db.flush()
    await db.refresh(leave, attribute_names=["teacher"])

    await log_audit_event(
        db,
        school_id=school_id,
        actor=current_user,
        action="leave.apply",
        resource_type="leave_application",
        resource_id=leave.id,
        metadata={
            "teacher_id": str(teacher.id),
            "start_date": data.start_date.isoformat(),
            "end_date": data.end_date.isoformat(),
            "total_days": total_days,
        },
        ip_address=request.client.host if request.client else None,
    )

    school = await _get_school(db, school_id)
    admin_emails = await _get_school_admin_emails(db, school_id)
    if admin_emails:
        background_tasks.add_task(
            EmailService().send_leave_request_to_admins,
            to=admin_emails,
            school=school,
            teacher_name=teacher.full_name,
            leave_type=leave.leave_type,
            start_date=leave.start_date,
            end_date=leave.end_date,
            total_days=leave.total_days,
            reason=leave.reason,
        )

    return _serialize_leave(leave)


@router.patch("/me/{leave_id}/cancel", response_model=LeaveApplicationResponse)
async def cancel_my_leave(
    school_id: uuid.UUID,
    leave_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:teacher")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    teacher = await _get_current_teacher(db, school_id=school_id, current_user=current_user)
    result = await db.execute(
        select(LeaveApplication)
        .options(selectinload(LeaveApplication.teacher))
        .where(
            LeaveApplication.id == leave_id,
            LeaveApplication.school_id == school_id,
            LeaveApplication.teacher_id == teacher.id,
        )
    )
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave application not found")
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending leave applications can be cancelled")

    leave.status = "cancelled"
    await db.flush()

    await log_audit_event(
        db,
        school_id=school_id,
        actor=current_user,
        action="leave.cancel",
        resource_type="leave_application",
        resource_id=leave.id,
        ip_address=request.client.host if request.client else None,
    )

    return _serialize_leave(leave)


@router.get("/requests", response_model=list[LeaveApplicationResponse])
async def list_leave_requests(
    school_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    result = await db.execute(
        select(LeaveApplication)
        .options(selectinload(LeaveApplication.teacher))
        .where(LeaveApplication.school_id == school_id)
        .order_by(LeaveApplication.created_at.desc())
    )
    return [_serialize_leave(leave) for leave in result.scalars().all()]


@router.patch("/requests/{leave_id}/decision", response_model=LeaveApplicationResponse)
async def decide_leave_request(
    school_id: uuid.UUID,
    leave_id: uuid.UUID,
    data: LeaveDecisionRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    result = await db.execute(
        select(LeaveApplication)
        .options(selectinload(LeaveApplication.teacher))
        .where(LeaveApplication.id == leave_id, LeaveApplication.school_id == school_id)
    )
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave application not found")
    if leave.status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="This leave application can no longer be changed")

    leave.status = data.status
    leave.approved_by_id = current_user.user_id
    leave.rejection_reason = data.rejection_reason if data.status == "rejected" else None
    await db.flush()
    await db.refresh(leave, attribute_names=["teacher"])

    await log_audit_event(
        db,
        school_id=school_id,
        actor=current_user,
        action=f"leave.{data.status}",
        resource_type="leave_application",
        resource_id=leave.id,
        metadata={
            "teacher_id": str(leave.teacher_id),
            "rejection_reason": leave.rejection_reason,
        },
        ip_address=request.client.host if request.client else None,
    )

    school = await _get_school(db, school_id)
    if leave.teacher and leave.teacher.email:
        background_tasks.add_task(
            EmailService().send_leave_decision_to_teacher,
            to=leave.teacher.email,
            school=school,
            teacher_name=leave.teacher.full_name,
            status=leave.status,
            leave_type=leave.leave_type,
            start_date=leave.start_date,
            end_date=leave.end_date,
            rejection_reason=leave.rejection_reason,
        )

    return _serialize_leave(leave)
