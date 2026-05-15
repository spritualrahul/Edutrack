"""Tenant-scoped AI feature APIs."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.providers.openai_provider import AIConfigurationError
from app.ai.services.notice_generator import NoticeGeneratorService
from app.ai.services.ocr_extractor import OCRExtractorService
from app.ai.services.parent_assistant import ParentAssistantService
from app.ai.services.timetable_optimizer import TimetableOptimizerService
from app.ai.services.usage import enforce_ai_limit, log_ai_usage
from app.core.auth import AuthenticatedUser, require_roles, require_school_access
from app.core.config import get_settings
from app.db.session import get_db
from app.models.organization import Organization
from app.models.timetable import TimetableSlot

router = APIRouter(prefix="/schools/{school_id}/ai", tags=["AI Features"])


class NoticeDraftRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1200)
    audience: list[str] = Field(default_factory=lambda: ["org:parent", "org:student"])
    tone: str = Field("professional", max_length=60)
    language: str = Field("English", max_length=60)
    category: Optional[str] = None


class ParentChatRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=1000)
    student_id: Optional[uuid.UUID] = None
    conversation_id: Optional[uuid.UUID] = None


class TimetableOptimizeRequest(BaseModel):
    existing_slots: list[dict[str, Any]] = Field(default_factory=list)
    absent_teacher_id: Optional[uuid.UUID] = None
    target_date: Optional[date] = None
    constraints: Optional[str] = Field(None, max_length=1600)


async def _school_or_404(db: AsyncSession, school_id: uuid.UUID) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == school_id, Organization.is_active == True))
    school = result.scalar_one_or_none()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


async def _load_timetable_slots(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    target_date: Optional[date],
) -> list[dict[str, Any]]:
    conditions = [TimetableSlot.school_id == school_id, TimetableSlot.is_active == True]
    if target_date:
        conditions.append(TimetableSlot.effective_from <= target_date)
        conditions.append((TimetableSlot.effective_to.is_(None)) | (TimetableSlot.effective_to >= target_date))

    result = await db.execute(
        select(TimetableSlot)
        .options(
            selectinload(TimetableSlot.academic_class),
            selectinload(TimetableSlot.section),
            selectinload(TimetableSlot.subject),
            selectinload(TimetableSlot.teacher),
            selectinload(TimetableSlot.substitute_teacher),
        )
        .where(*conditions)
        .order_by(TimetableSlot.day_of_week, TimetableSlot.start_time)
        .limit(500)
    )
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    slots = []
    for slot in result.scalars().all():
        class_name = slot.academic_class.name if slot.academic_class else "Class"
        section_name = slot.section.name if slot.section else ""
        teacher = slot.substitute_teacher if slot.is_substitute and slot.substitute_teacher else slot.teacher
        slots.append(
            {
                "id": str(slot.id),
                "day": day_names[slot.day_of_week],
                "time": f"{slot.start_time.isoformat(timespec='minutes')}-{slot.end_time.isoformat(timespec='minutes')}",
                "class_label": f"{class_name}-{section_name}" if section_name else class_name,
                "subject": slot.subject.name if slot.subject else "General",
                "teacher_id": str(teacher.id) if teacher else str(slot.teacher_id),
                "teacher": teacher.full_name if teacher else "Teacher",
                "room": slot.room or "",
                "is_substitute": slot.is_substitute,
            }
        )
    return slots


async def _handle_ai_error(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    user: AuthenticatedUser,
    feature: str,
    error: Exception,
) -> None:
    await log_ai_usage(
        db,
        school_id=school_id,
        user=user,
        feature=feature,
        model=None,
        status_="error",
        error_message=str(error),
    )


@router.post("/notices/generate")
async def generate_notice_draft(
    school_id: uuid.UUID,
    data: NoticeDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:teacher")),
    _school_access: AuthenticatedUser = Depends(require_school_access()),
):
    feature = "notice_generator"
    await enforce_ai_limit(db, school_id=school_id, user=current_user, feature=feature)
    school = await _school_or_404(db, school_id)

    if current_user.role == "org:teacher":
        invalid = set(data.audience) - {"org:parent", "org:student"}
        if invalid:
            raise HTTPException(status_code=403, detail="Teachers can only generate notices for parents and students.")

    try:
        result = await NoticeGeneratorService().generate(
            school=school,
            prompt=data.prompt,
            audience=data.audience,
            tone=data.tone,
            language=data.language,
            category=data.category,
        )
        await log_ai_usage(
            db,
            school_id=school_id,
            user=current_user,
            feature=feature,
            model=result.model,
            status_="success",
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            metadata={"tone": data.tone, "language": data.language},
        )
        return result.data
    except AIConfigurationError as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=503, detail="OpenAI is not configured.")
    except Exception as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=500, detail="Could not generate notice draft.")


@router.post("/parent-assistant/chat")
async def parent_assistant_chat(
    school_id: uuid.UUID,
    data: ParentChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:parent")),
    _school_access: AuthenticatedUser = Depends(require_school_access()),
):
    settings = get_settings()
    feature = "parent_assistant"
    await enforce_ai_limit(
        db,
        school_id=school_id,
        user=current_user,
        feature=feature,
        limit=settings.AI_PARENT_CHAT_DAILY_LIMIT,
    )
    school = await _school_or_404(db, school_id)

    try:
        result, conversation = await ParentAssistantService().answer(
            db=db,
            school=school,
            parent_user_id=current_user.user_id,
            parent_clerk_id=current_user.clerk_id,
            message=data.message,
            student_id=data.student_id,
            conversation_id=data.conversation_id,
        )
        await log_ai_usage(
            db,
            school_id=school_id,
            user=current_user,
            feature=feature,
            model=result.model,
            status_="success",
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            metadata={"conversation_id": str(conversation.id), "student_id": str(data.student_id) if data.student_id else None},
        )
        return {"conversation_id": conversation.id, **result.data}
    except PermissionError as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except AIConfigurationError as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=503, detail="OpenAI is not configured.")
    except Exception as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=500, detail="Could not answer parent question.")


@router.post("/timetable/optimize")
async def optimize_timetable(
    school_id: uuid.UUID,
    data: TimetableOptimizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:teacher")),
    _school_access: AuthenticatedUser = Depends(require_school_access()),
):
    feature = "timetable_optimizer"
    await enforce_ai_limit(db, school_id=school_id, user=current_user, feature=feature)
    school = await _school_or_404(db, school_id)
    existing_slots = data.existing_slots or await _load_timetable_slots(
        db,
        school_id=school_id,
        target_date=data.target_date,
    )

    try:
        result = await TimetableOptimizerService().optimize(
            db=db,
            school=school,
            existing_slots=existing_slots,
            absent_teacher_id=data.absent_teacher_id,
            target_date=data.target_date,
            constraints=data.constraints,
        )
        await log_ai_usage(
            db,
            school_id=school_id,
            user=current_user,
            feature=feature,
            model=result.model,
            status_="success",
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            metadata={"slot_count": len(existing_slots), "target_date": data.target_date.isoformat() if data.target_date else None},
        )
        return result.data
    except AIConfigurationError as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=503, detail="OpenAI is not configured.")
    except Exception as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=500, detail="Could not optimize timetable.")


@router.post("/documents/extract")
async def extract_student_document(
    school_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school_access: AuthenticatedUser = Depends(require_school_access()),
):
    feature = "ocr_extraction"
    await enforce_ai_limit(db, school_id=school_id, user=current_user, feature=feature)
    school = await _school_or_404(db, school_id)

    content_type = file.content_type or ""
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP image for AI extraction.")

    content = await file.read()
    max_bytes = get_settings().AI_OCR_MAX_FILE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="Document image is too large.")

    try:
        result = await OCRExtractorService().extract(
            school=school,
            filename=file.filename or "document",
            content_type=content_type,
            content=content,
        )
        await log_ai_usage(
            db,
            school_id=school_id,
            user=current_user,
            feature=feature,
            model=result.model,
            status_="success",
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            metadata={"filename": file.filename, "content_type": content_type, "size": len(content)},
        )
        return result.data
    except AIConfigurationError as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=503, detail="OpenAI is not configured.")
    except Exception as exc:
        await _handle_ai_error(db, school_id=school_id, user=current_user, feature=feature, error=exc)
        raise HTTPException(status_code=500, detail="Could not extract document fields.")
