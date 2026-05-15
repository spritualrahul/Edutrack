"""Organization/School management API routes."""
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit_event
from app.core.auth import AuthenticatedUser, get_authenticated_user, require_roles
from app.db.session import get_db
from app.models.organization import Organization
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
