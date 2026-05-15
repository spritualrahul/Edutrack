"""Tenant-scoped notice management routes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_audit_event
from app.core.auth import AuthenticatedUser, require_roles, require_school_access
from app.db.session import get_db
from app.models.academic import AcademicClass, Section
from app.models.notice import Notice
from app.models.parent import Parent
from app.models.student import Student
from app.models.teacher import Teacher
from app.schemas.schemas import MessageResponse, NoticeCreate, NoticeResponse, NoticeUpdate, PaginatedResponse

router = APIRouter(prefix="/schools/{school_id}/notices", tags=["Notices"])

NOTICE_WRITER_ROLES = ("org:super_admin", "org:school_admin", "org:teacher")
NOTICE_READER_ROLES = (
    "org:super_admin",
    "org:school_admin",
    "org:accounts",
    "org:teacher",
    "org:parent",
    "org:student",
)
TEACHER_NOTICE_TARGET_ROLES = {"org:parent", "org:student"}
NOTICE_ALLOWED_TARGET_ROLES = set(NOTICE_READER_ROLES)


def _serialize_notice(notice: Notice) -> dict:
    return {
        "id": notice.id,
        "title": notice.title,
        "content": notice.content,
        "category": notice.category,
        "priority": notice.priority,
        "is_published": notice.is_published,
        "is_pinned": notice.is_pinned,
        "target_roles": notice.target_roles or [],
        "target_classes": notice.target_classes or [],
        "attachments": notice.attachments or [],
        "published_at": notice.published_at,
        "author_name": notice.author.full_name if notice.author else None,
        "created_at": notice.created_at,
    }


def _validate_teacher_notice(data: NoticeCreate | NoticeUpdate, *, require_classes: bool) -> None:
    target_roles = set(data.target_roles or [])
    if target_roles and not target_roles.issubset(TEACHER_NOTICE_TARGET_ROLES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teachers can only send notices to parents and students.",
        )

    target_classes = data.target_classes or []
    if require_classes and not target_classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teachers must select at least one target class.",
        )
    if data.target_classes is not None and not target_classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teachers must keep at least one target class selected.",
        )


def _validate_notice_targets(data: NoticeCreate | NoticeUpdate) -> None:
    target_roles = set(data.target_roles or [])
    invalid_roles = target_roles - NOTICE_ALLOWED_TARGET_ROLES
    if invalid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid notice target roles: {', '.join(sorted(invalid_roles))}",
        )


def _class_keys(
    class_id: uuid.UUID,
    class_name: str,
    section_id: Optional[uuid.UUID] = None,
    section_name: Optional[str] = None,
) -> set[str]:
    keys = {str(class_id)}
    clean_class = class_name.strip() if class_name else ""
    clean_section = section_name.strip() if section_name else ""

    if clean_class:
        keys.add(clean_class)
    if section_id:
        keys.add(str(section_id))
    if clean_class and clean_section:
        keys.update(
            {
                f"{clean_class}-{clean_section}",
                f"{clean_class} {clean_section}",
                f"{clean_class} Section {clean_section}",
                f"{clean_class}/{clean_section}",
            }
        )
    return keys


async def _audience_class_keys(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    current_user: AuthenticatedUser,
) -> list[str]:
    rows = []

    if current_user.role == "org:student":
        result = await db.execute(
            select(Student.class_id, AcademicClass.name, Student.section_id, Section.name)
            .join(AcademicClass, AcademicClass.id == Student.class_id)
            .outerjoin(Section, Section.id == Student.section_id)
            .where(
                Student.school_id == school_id,
                Student.clerk_user_id == current_user.clerk_id,
                Student.is_active == True,
            )
        )
        rows = result.all()

    elif current_user.role == "org:parent":
        result = await db.execute(
            select(Student.class_id, AcademicClass.name, Student.section_id, Section.name)
            .join(Parent, Student.parent_id == Parent.id)
            .join(AcademicClass, AcademicClass.id == Student.class_id)
            .outerjoin(Section, Section.id == Student.section_id)
            .where(
                Student.school_id == school_id,
                Parent.school_id == school_id,
                Parent.clerk_user_id == current_user.clerk_id,
                Parent.is_active == True,
                Student.is_active == True,
            )
        )
        rows = result.all()

    elif current_user.role == "org:teacher":
        result = await db.execute(
            select(Section.class_id, AcademicClass.name, Section.id, Section.name)
            .join(AcademicClass, AcademicClass.id == Section.class_id)
            .join(Teacher, Teacher.id == Section.class_teacher_id)
            .where(
                Section.school_id == school_id,
                Teacher.school_id == school_id,
                Teacher.clerk_user_id == current_user.clerk_id,
                Teacher.is_active == True,
                Section.is_active == True,
            )
        )
        rows = result.all()

    keys: set[str] = set()
    for class_id, class_name, section_id, section_name in rows:
        keys.update(_class_keys(class_id, class_name, section_id, section_name))
    return sorted(keys)


@router.get("", response_model=PaginatedResponse)
async def list_notices(
    school_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    priority: Optional[str] = None,
    include_drafts: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles(*NOTICE_READER_ROLES)),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    query = (
        select(Notice)
        .options(selectinload(Notice.author))
        .where(Notice.school_id == school_id)
    )

    can_view_drafts = current_user.role in ("org:super_admin", "org:school_admin")
    if not include_drafts or not can_view_drafts:
        query = query.where(Notice.is_published == True)

    if current_user.role not in ("org:super_admin", "org:school_admin"):
        query = query.where(
            or_(
                Notice.target_roles.is_(None),
                Notice.target_roles == [],
                Notice.target_roles.any(current_user.role),
            )
        )
        unscoped_classes = or_(Notice.target_classes.is_(None), Notice.target_classes == [])
        if current_user.role in ("org:parent", "org:student", "org:teacher"):
            class_keys = await _audience_class_keys(db, school_id=school_id, current_user=current_user)
            if class_keys:
                query = query.where(or_(unscoped_classes, Notice.target_classes.overlap(class_keys)))
            else:
                query = query.where(unscoped_classes)
        else:
            query = query.where(unscoped_classes)

    if category:
        query = query.where(Notice.category == category)
    if priority:
        query = query.where(Notice.priority == priority)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    result = await db.execute(
        query.order_by(Notice.is_pinned.desc(), Notice.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [_serialize_notice(notice) for notice in result.scalars().all()]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=NoticeResponse, status_code=status.HTTP_201_CREATED)
async def create_notice(
    school_id: uuid.UUID,
    data: NoticeCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles(*NOTICE_WRITER_ROLES)),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    _validate_notice_targets(data)
    if current_user.role == "org:teacher":
        _validate_teacher_notice(data, require_classes=True)

    notice = Notice(
        school_id=school_id,
        title=data.title,
        content=data.content,
        category=data.category,
        priority=data.priority,
        target_roles=data.target_roles,
        target_classes=data.target_classes,
        is_published=data.is_published,
        is_pinned=data.is_pinned,
        published_at=datetime.now(timezone.utc) if data.is_published else None,
        attachments=data.attachments,
        author_id=current_user.user_id,
    )
    db.add(notice)
    await db.flush()
    await db.refresh(notice, attribute_names=["author"])

    await log_audit_event(
        db,
        school_id=school_id,
        actor=current_user,
        action="notice.create",
        resource_type="notice",
        resource_id=notice.id,
        metadata={
            "is_published": notice.is_published,
            "target_roles": notice.target_roles or [],
            "target_classes": notice.target_classes or [],
        },
        ip_address=request.client.host if request.client else None,
    )

    return _serialize_notice(notice)


@router.patch("/{notice_id}", response_model=NoticeResponse)
async def update_notice(
    school_id: uuid.UUID,
    notice_id: uuid.UUID,
    data: NoticeUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles(*NOTICE_WRITER_ROLES)),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    _validate_notice_targets(data)
    result = await db.execute(
        select(Notice)
        .options(selectinload(Notice.author))
        .where(Notice.id == notice_id, Notice.school_id == school_id)
    )
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    if current_user.role == "org:teacher":
        if notice.author_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Teachers can only update their own notices.")
        _validate_teacher_notice(data, require_classes=False)

    previous_published = notice.is_published
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(notice, key):
            setattr(notice, key, value)

    if notice.is_published and not previous_published:
        notice.published_at = datetime.now(timezone.utc)
    elif not notice.is_published:
        notice.published_at = None

    await db.flush()
    await db.refresh(notice, attribute_names=["author"])

    await log_audit_event(
        db,
        school_id=school_id,
        actor=current_user,
        action="notice.update",
        resource_type="notice",
        resource_id=notice.id,
        metadata={"updated_fields": sorted(update_data.keys())},
        ip_address=request.client.host if request.client else None,
    )

    return _serialize_notice(notice)


@router.delete("/{notice_id}", response_model=MessageResponse)
async def delete_notice(
    school_id: uuid.UUID,
    notice_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    result = await db.execute(select(Notice).where(Notice.id == notice_id, Notice.school_id == school_id))
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    await log_audit_event(
        db,
        school_id=school_id,
        actor=current_user,
        action="notice.delete",
        resource_type="notice",
        resource_id=notice.id,
        metadata={"title": notice.title},
        ip_address=request.client.host if request.client else None,
    )

    await db.delete(notice)
    return MessageResponse(message="Notice deleted")
