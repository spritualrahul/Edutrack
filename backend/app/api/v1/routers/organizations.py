"""Organization/School management API routes."""
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_audit_event
from app.core.auth import AuthenticatedUser, get_authenticated_user, require_roles
from app.db.session import get_db
from app.models.organization import Organization
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.academic import AcademicClass, Section
from app.models.parent import Parent
from app.repositories.organization_repo import OrganizationRepository
from app.schemas.schemas import (OrganizationCreate, OrganizationUpdate, OrganizationResponse,
                                  PaginatedResponse, SubscriptionCheckoutRequest,
                                  SubscriptionPlanResponse, SubscriptionPlanUpdate,
                                  SubscriptionVerifyRequest)
from app.services.razorpay_service import RazorpayConfigurationError, RazorpayGatewayError, RazorpayService

router = APIRouter(prefix="/organizations", tags=["Organizations"])


def _serialize_organization(org: Organization, stats: Optional[dict] = None) -> dict:
    item = OrganizationResponse.model_validate(org).model_dump()
    plan = org.__dict__.get("subscription_plan")
    if plan:
        item["subscription_plan_name"] = plan.name
        item["subscription_plan_features"] = plan.features or {}
    item.update(stats or {})
    return item


@router.get("", response_model=PaginatedResponse)
async def list_organizations(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None, is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin")),
):
    repo = OrganizationRepository(db)
    orgs, total = await repo.list_all(offset=(page - 1) * page_size, limit=page_size,
                                       is_active=is_active, search=search)
    items = []
    for org in orgs:
        stats = await repo.get_stats(org.id)
        items.append(_serialize_organization(org, stats))
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size,
                             total_pages=(total + page_size - 1) // page_size)


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    data: OrganizationCreate, request: Request, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin")),
):
    repo = OrganizationRepository(db)
    payload = data.model_dump(exclude_none=True)
    if payload.get("slug") and await repo.get_by_slug(payload["slug"]):
        raise HTTPException(status_code=400, detail="Organization with this slug already exists")
    if payload.get("subscription_plan_id"):
        plan = await repo.get_subscription_plan(payload["subscription_plan_id"])
        if not plan or not plan.is_active:
            raise HTTPException(status_code=400, detail="Selected subscription plan is not active")

    try:
        org = await repo.create(**payload)
        await log_audit_event(
            db,
            school_id=org.id,
            actor=current_user,
            action="school.onboard",
            resource_type="organization",
            resource_id=org.id,
            metadata={"unique_code": org.unique_code},
            ip_address=request.client.host if request.client else None,
        )
    except IntegrityError:
        raise HTTPException(status_code=400, detail="School slug or unique code already exists")

    stats = await repo.get_stats(org.id)
    return _serialize_organization(org, stats)


@router.get("/subscription-plans", response_model=list[SubscriptionPlanResponse])
async def list_subscription_plans(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    repo = OrganizationRepository(db)
    active_only = not (include_inactive and current_user.is_super_admin)
    return await repo.list_subscription_plans(active_only=active_only)


@router.patch("/subscription-plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_subscription_plan(
    plan_id: uuid.UUID,
    data: SubscriptionPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin")),
):
    repo = OrganizationRepository(db)
    plan = await repo.update_subscription_plan(plan_id, **data.model_dump(exclude_unset=True))
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    return plan


@router.get("/stats/platform", response_model=dict)
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin")),
):
    repo = OrganizationRepository(db)
    return await repo.get_all_stats()


@router.post("/{org_id}/subscription/checkout")
async def create_subscription_checkout(
    org_id: uuid.UUID,
    data: SubscriptionCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
):
    if not current_user.is_super_admin and current_user.school_id != org_id:
        raise HTTPException(status_code=403, detail="School admins can only buy plans for their own school")

    repo = OrganizationRepository(db)
    org = await repo.get_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    plan = await repo.get_subscription_plan(data.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=400, detail="Subscription plan is not available")

    amount = Decimal(plan.price_yearly if data.billing_cycle == "yearly" else plan.price_monthly)
    service = RazorpayService()
    if not service.is_configured:
        return {
            "gateway_configured": False,
            "message": "Razorpay keys are not configured on the backend.",
            "plan": SubscriptionPlanResponse.model_validate(plan).model_dump(),
        }

    receipt = f"sub-{org.unique_code}-{uuid.uuid4().hex[:8]}"
    try:
        order = await service.create_order(
            amount_rupees=amount,
            receipt=receipt,
            notes={
                "school_id": str(org.id),
                "plan_id": str(plan.id),
                "billing_cycle": data.billing_cycle,
                "purpose": "saas_subscription",
            },
        )
    except RazorpayGatewayError:
        raise HTTPException(status_code=502, detail="Could not create Razorpay order")
    payment = await repo.create_subscription_payment(
        school_id=org.id,
        plan_id=plan.id,
        billing_cycle=data.billing_cycle,
        amount=amount,
        status="created",
        razorpay_order_id=order["id"],
        metadata_={"razorpay_order": order},
    )
    return {
        "gateway_configured": True,
        "order": order,
        "subscription_payment_id": payment.id,
        "razorpay_key_id": service.settings.RAZORPAY_KEY_ID,
        "plan": SubscriptionPlanResponse.model_validate(plan).model_dump(),
    }


@router.post("/{org_id}/subscription/verify", response_model=OrganizationResponse)
async def verify_subscription_payment(
    org_id: uuid.UUID,
    data: SubscriptionVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
):
    if not current_user.is_super_admin and current_user.school_id != org_id:
        raise HTTPException(status_code=403, detail="School admins can only verify payments for their own school")

    repo = OrganizationRepository(db)
    org = await repo.get_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    payment = await repo.get_subscription_payment_by_order(org_id, data.razorpay_order_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Subscription order not found")
    if payment.status == "completed":
        stats = await repo.get_stats(org.id)
        return _serialize_organization(org, stats)

    service = RazorpayService()
    try:
        verified = service.verify_signature(
            order_id=data.razorpay_order_id,
            payment_id=data.razorpay_payment_id,
            signature=data.razorpay_signature,
        )
    except RazorpayConfigurationError:
        raise HTTPException(status_code=503, detail="Razorpay is not configured")
    if not verified:
        payment.status = "failed"
        await db.flush()
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature")

    today = date.today()
    payment.status = "completed"
    payment.razorpay_payment_id = data.razorpay_payment_id
    payment.razorpay_signature = data.razorpay_signature
    org.subscription_plan_id = payment.plan_id
    org.subscription_status = "active"
    org.subscription_start = today
    org.subscription_end = today + timedelta(days=365 if payment.billing_cycle == "yearly" else 30)
    org.settings = {
        **(org.settings or {}),
        "enabled_features": payment.plan.features or {},
        "student_limit": payment.plan.max_students,
        "teacher_limit": payment.plan.max_teachers,
        "staff_limit": payment.plan.max_staff,
    }
    await log_audit_event(
        db,
        school_id=org.id,
        actor=current_user,
        action="subscription.payment_verified",
        resource_type="subscription_payment",
        resource_id=payment.id,
        metadata={"plan_id": str(payment.plan_id), "billing_cycle": payment.billing_cycle},
        ip_address=request.client.host if request.client else None,
    )
    await db.flush()
    refreshed = await repo.get_by_id(org.id)
    stats = await repo.get_stats(org.id)
    return _serialize_organization(refreshed or org, stats)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    repo = OrganizationRepository(db)
    org = await repo.get_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not current_user.is_super_admin and current_user.school_id != org.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization.",
        )
    stats = await repo.get_stats(org.id)
    return _serialize_organization(org, stats)


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID, data: OrganizationUpdate, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
):
    repo = OrganizationRepository(db)
    update_data = data.model_dump(exclude_unset=True)

    if current_user.role == "org:school_admin":
        if current_user.school_id != org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="School admins can only update their own school.",
            )
        forbidden_fields = {"is_active", "settings", "unique_code", "slug", "subscription_plan_id", "subscription_status"}
        attempted_forbidden = forbidden_fields.intersection(update_data)
        if attempted_forbidden:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"School admins cannot update: {', '.join(sorted(attempted_forbidden))}",
            )

    try:
        org = await repo.update(org_id, **update_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    stats = await repo.get_stats(org.id)
    return _serialize_organization(org, stats)


@router.delete("/{org_id}")
async def deactivate_organization(
    org_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin")),
):
    repo = OrganizationRepository(db)
    org = await repo.update(org_id, is_active=False, subscription_status="cancelled")
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await log_audit_event(
        db,
        school_id=org.id,
        actor=current_user,
        action="school.deactivate",
        resource_type="organization",
        resource_id=org.id,
        metadata={"unique_code": org.unique_code},
        ip_address=request.client.host if request.client else None,
    )
    return {"success": True, "message": "School deactivated"}


# ---------------------------------------------------------------------------
# Super-admin: school member drill-down
# ---------------------------------------------------------------------------

def _serialize_student_for_admin(student: Student) -> dict:
    """Serialize a student for the super-admin view."""
    return {
        "id": str(student.id),
        "admission_number": student.admission_number,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "full_name": student.full_name,
        "date_of_birth": str(student.date_of_birth) if student.date_of_birth else None,
        "gender": student.gender,
        "blood_group": student.blood_group,
        "photo_url": student.photo_url,
        "email": student.email,
        "phone": student.phone,
        "address": student.address,
        "class_name": student.academic_class.name if student.academic_class else None,
        "section_name": student.section.name if student.section else None,
        "roll_number": student.roll_number,
        "admission_date": str(student.admission_date) if student.admission_date else None,
        "status": student.status,
        "parent_name": student.parent.primary_contact_name if student.parent else None,
        "parent_phone": student.parent.primary_phone if student.parent else None,
        "father_name": student.parent.father_name if student.parent else None,
        "mother_name": student.parent.mother_name if student.parent else None,
    }


def _serialize_teacher_for_admin(teacher: Teacher) -> dict:
    """Serialize a teacher for the super-admin view."""
    return {
        "id": str(teacher.id),
        "employee_id": teacher.employee_id,
        "first_name": teacher.first_name,
        "last_name": teacher.last_name,
        "full_name": teacher.full_name,
        "email": teacher.email,
        "phone": teacher.phone,
        "date_of_birth": str(teacher.date_of_birth) if teacher.date_of_birth else None,
        "gender": teacher.gender,
        "photo_url": teacher.photo_url,
        "address": teacher.address,
        "designation": teacher.designation,
        "department": teacher.department,
        "qualification": teacher.qualification,
        "experience_years": teacher.experience_years,
        "joining_date": str(teacher.joining_date) if teacher.joining_date else None,
        "specialization": teacher.specialization,
        "status": teacher.status,
        "is_active": teacher.is_active,
        "staff_type": teacher.staff_type or "teaching",
    }


@router.get("/{org_id}/students")
async def list_school_students(
    org_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin")),
):
    """List all students for a school (super-admin only)."""
    # Verify the org exists
    repo = OrganizationRepository(db)
    org = await repo.get_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    query = select(Student).where(Student.school_id == org_id)
    if search:
        query = query.where(
            Student.first_name.ilike(f"%{search}%")
            | Student.last_name.ilike(f"%{search}%")
            | Student.admission_number.ilike(f"%{search}%")
        )
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.options(
        selectinload(Student.academic_class),
        selectinload(Student.section),
        selectinload(Student.parent),
    ).order_by(Student.first_name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    students = result.scalars().all()

    return {
        "items": [_serialize_student_for_admin(s) for s in students],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{org_id}/teachers")
async def list_school_teachers(
    org_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin")),
):
    """List all teachers for a school (super-admin only)."""
    repo = OrganizationRepository(db)
    org = await repo.get_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    query = select(Teacher).where(Teacher.school_id == org_id).where(
        (Teacher.staff_type == "teaching") | (Teacher.staff_type.is_(None))
    )
    if search:
        query = query.where(
            Teacher.first_name.ilike(f"%{search}%")
            | Teacher.last_name.ilike(f"%{search}%")
            | Teacher.employee_id.ilike(f"%{search}%")
        )
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Teacher.first_name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    teachers = result.scalars().all()

    return {
        "items": [_serialize_teacher_for_admin(t) for t in teachers],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{org_id}/staff")
async def list_school_staff(
    org_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin")),
):
    """List all non-teaching staff for a school (super-admin only)."""
    repo = OrganizationRepository(db)
    org = await repo.get_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    query = select(Teacher).where(
        Teacher.school_id == org_id, Teacher.staff_type == "non_teaching"
    )
    if search:
        query = query.where(
            Teacher.first_name.ilike(f"%{search}%")
            | Teacher.last_name.ilike(f"%{search}%")
            | Teacher.employee_id.ilike(f"%{search}%")
        )
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Teacher.first_name).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    staff = result.scalars().all()

    return {
        "items": [_serialize_teacher_for_admin(s) for s in staff],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }
