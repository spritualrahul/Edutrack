"""Fee management and payment collection API routes."""
import csv
import io
import uuid
from datetime import date
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.audit import log_audit_event
from app.core.auth import AuthenticatedUser, require_roles, require_school_access, require_own_student_access
from app.db.session import get_db
from app.models.fee import Payment, Receipt, StudentFeeAllocation
from app.models.organization import Organization
from app.models.parent import Parent
from app.models.student import Student
from app.repositories.fee_repo import FeeRepository
from app.schemas.schemas import (CollectFeeRequest, FeeStructureCreate, FeeAllocationResponse,
                                  OnlineFeeOrderRequest, OnlineFeeVerifyRequest,
                                  PaymentResponse, DailyCollectionSummary,
                                  ReceiptResponse)
from app.services.email_service import EmailService
from app.services.razorpay_service import RazorpayConfigurationError, RazorpayGatewayError, RazorpayService

router = APIRouter(prefix="/schools/{school_id}/fees", tags=["Fee Management"])


@router.post("/structures", status_code=status.HTTP_201_CREATED)
async def create_fee_structure(
    school_id: uuid.UUID, data: FeeStructureCreate, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    repo = FeeRepository(db)
    components = [c.model_dump() for c in data.components]
    structure = await repo.create_fee_structure(school_id, name=data.name, class_id=data.class_id,
                                                 academic_year=data.academic_year, description=data.description,
                                                 components=components)
    return {"id": structure.id, "name": structure.name, "message": "Fee structure created"}


@router.get("/students/{student_id}/pending", response_model=list[FeeAllocationResponse])
async def get_student_pending_fees(
    school_id: uuid.UUID, student_id: uuid.UUID, db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts", "org:parent", "org:student")),
    _school: AuthenticatedUser = Depends(require_school_access()),
    _own: AuthenticatedUser = Depends(require_own_student_access()),
):
    repo = FeeRepository(db)
    fees = await repo.get_student_fees(student_id, school_id, status="pending")
    partial = await repo.get_student_fees(student_id, school_id, status="partial")
    overdue = await repo.get_student_fees(student_id, school_id, status="overdue")
    all_fees = fees + partial + overdue
    result = []
    for f in all_fees:
        item = FeeAllocationResponse.model_validate(f).model_dump()
        item["balance"] = float(f.total_amount - f.discount_amount - f.paid_amount)
        result.append(item)
    return result


@router.post("/online/order")
async def create_online_fee_order(
    school_id: uuid.UUID,
    data: OnlineFeeOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:parent", "org:student")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    await _ensure_student_payment_access(db, current_user, school_id, data.student_id)
    service = RazorpayService()
    if not service.is_configured:
        return {
            "gateway_configured": False,
            "message": "Razorpay keys are not configured on the backend.",
        }

    repo = FeeRepository(db)
    receipt_ref = f"fee-{str(data.student_id)[:8]}-{uuid.uuid4().hex[:8]}"
    try:
        order = await service.create_order(
            amount_rupees=data.amount,
            receipt=receipt_ref,
            notes={
                "school_id": str(school_id),
                "student_id": str(data.student_id),
                "fee_allocation_id": str(data.fee_allocation_id),
                "purpose": "student_fee",
            },
        )
        payment = await repo.create_online_payment_order(
            school_id=school_id,
            student_id=data.student_id,
            fee_allocation_id=data.fee_allocation_id,
            amount=data.amount,
            razorpay_order_id=order["id"],
            created_by_id=current_user.user_id,
        )
    except RazorpayConfigurationError:
        raise HTTPException(status_code=503, detail="Razorpay is not configured")
    except RazorpayGatewayError:
        raise HTTPException(status_code=502, detail="Could not create Razorpay order")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "gateway_configured": True,
        "order": order,
        "payment_id": payment.id,
        "razorpay_key_id": service.settings.RAZORPAY_KEY_ID,
    }


@router.post("/online/verify", response_model=PaymentResponse)
async def verify_online_fee_payment(
    school_id: uuid.UUID,
    data: OnlineFeeVerifyRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:parent", "org:student")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    await _ensure_student_payment_access(db, current_user, school_id, data.student_id)
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
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature")

    repo = FeeRepository(db)
    try:
        payment = await repo.complete_online_payment(
            school_id=school_id,
            student_id=data.student_id,
            fee_allocation_id=data.fee_allocation_id,
            amount=data.amount,
            razorpay_order_id=data.razorpay_order_id,
            razorpay_payment_id=data.razorpay_payment_id,
            razorpay_signature=data.razorpay_signature,
            collected_by_id=current_user.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await log_audit_event(
        db,
        school_id=school_id,
        actor=current_user,
        action="fee.online_payment_verified",
        resource_type="payment",
        resource_id=payment.id,
        metadata={
            "student_id": str(data.student_id),
            "fee_allocation_id": str(data.fee_allocation_id),
            "amount": str(data.amount),
        },
        ip_address=request.client.host if request.client else None,
    )
    await _queue_fee_receipt_email(db, school_id, payment.id, background_tasks)
    return await _load_payment_response(db, school_id, payment.id)


@router.post("/collect", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def collect_fee(
    school_id: uuid.UUID, data: CollectFeeRequest, request: Request, background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    """Collect fee payment - primary endpoint for fee counter staff."""
    repo = FeeRepository(db)
    try:
        payment = await repo.collect_fee(
            school_id=school_id, student_id=data.student_id,
            fee_allocation_id=data.fee_allocation_id, amount=data.amount,
            payment_mode=data.payment_mode, transaction_id=data.transaction_id,
            reference_number=data.reference_number, cheque_number=data.cheque_number,
            cheque_date=data.cheque_date, bank_name=data.bank_name, remarks=data.remarks,
            collected_by_id=current_user.user_id)
        await log_audit_event(
            db,
            school_id=school_id,
            actor=current_user,
            action="fee.collect",
            resource_type="payment",
            resource_id=payment.id,
            metadata={
                "student_id": str(data.student_id),
                "fee_allocation_id": str(data.fee_allocation_id),
                "amount": str(data.amount),
                "payment_mode": data.payment_mode,
            },
            ip_address=request.client.host if request.client else None,
        )
        await _queue_fee_receipt_email(db, school_id, payment.id, background_tasks)
        return await _load_payment_response(db, school_id, payment.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/daily-summary", response_model=DailyCollectionSummary)
async def get_daily_collection_summary(
    school_id: uuid.UUID, target_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    if not target_date:
        target_date = date.today()
    repo = FeeRepository(db)
    summary = await repo.get_daily_collection(school_id, target_date)
    summary["recent_payments"] = [_serialize_payment(p) for p in summary["recent_payments"]]
    return summary


@router.get("/receipts", response_model=list[ReceiptResponse])
async def list_receipts(
    school_id: uuid.UUID,
    student_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts", "org:parent", "org:student")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    repo = FeeRepository(db)
    student_ids: Optional[list[uuid.UUID]]
    if current_user.role in ("org:super_admin", "org:school_admin", "org:accounts"):
        student_ids = [student_id] if student_id else None
    else:
        allowed = await _get_allowed_student_ids(db, current_user, school_id)
        if student_id and student_id not in allowed:
            raise HTTPException(status_code=403, detail="Access denied to this receipt list")
        student_ids = [student_id] if student_id else allowed
    receipts = await repo.list_receipts(school_id, student_ids=student_ids)
    return [_serialize_receipt(receipt) for receipt in receipts]


@router.get("/receipts/{receipt_id}/download")
async def download_receipt_pdf(
    school_id: uuid.UUID,
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts", "org:parent", "org:student")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    repo = FeeRepository(db)
    receipt = await repo.get_receipt(school_id, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if current_user.role not in ("org:super_admin", "org:school_admin", "org:accounts"):
        allowed = await _get_allowed_student_ids(db, current_user, school_id)
        if receipt.student_id not in allowed:
            raise HTTPException(status_code=403, detail="Access denied to this receipt")

    school_result = await db.execute(select(Organization).where(Organization.id == school_id))
    school = school_result.scalar_one_or_none()
    pdf = _build_receipt_pdf(receipt, school)
    filename = f"{receipt.receipt_number}.pdf"
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/pending.csv")
async def download_pending_fee_report(
    school_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    query = (
        select(StudentFeeAllocation, Student)
        .join(Student, Student.id == StudentFeeAllocation.student_id)
        .where(
            StudentFeeAllocation.school_id == school_id,
            StudentFeeAllocation.status.in_(["pending", "partial", "overdue"]),
        )
        .order_by(Student.first_name, StudentFeeAllocation.due_date)
    )
    rows = (await db.execute(query)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["student", "admission_number", "month", "year", "due_date", "total", "paid", "balance", "status"])
    for allocation, student in rows:
        balance = allocation.total_amount - allocation.discount_amount - allocation.paid_amount
        writer.writerow([
            student.full_name,
            student.admission_number,
            allocation.month,
            allocation.year,
            allocation.due_date.isoformat(),
            allocation.total_amount,
            allocation.paid_amount,
            balance,
            allocation.status,
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="pending-fees.csv"'},
    )


@router.get("/reports/daily.csv")
async def download_daily_collection_report(
    school_id: uuid.UUID,
    target_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin", "org:accounts")),
    _school: AuthenticatedUser = Depends(require_school_access()),
):
    if not target_date:
        target_date = date.today()
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.student), selectinload(Payment.receipt))
        .where(
            Payment.school_id == school_id,
            Payment.status == "completed",
            func.date(Payment.payment_date) == target_date,
        )
        .order_by(Payment.payment_date.desc())
    )
    payments = result.scalars().all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["receipt", "student", "admission_number", "amount", "mode", "transaction_id", "payment_date"])
    for payment in payments:
        if payment.payment_date.date() != target_date:
            continue
        writer.writerow([
            payment.receipt.receipt_number if payment.receipt else "",
            payment.student.full_name if payment.student else "",
            payment.student.admission_number if payment.student else "",
            payment.amount,
            payment.payment_mode,
            payment.transaction_id or "",
            payment.payment_date.isoformat(),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="daily-collection-{target_date.isoformat()}.csv"'},
    )


async def _queue_fee_receipt_email(
    db: AsyncSession,
    school_id: uuid.UUID,
    payment_id: uuid.UUID,
    background_tasks: BackgroundTasks,
) -> None:
    school_result = await db.execute(select(Organization).where(Organization.id == school_id))
    school = school_result.scalar_one_or_none()
    if not school:
        return

    payment_result = await db.execute(
        select(Payment)
        .options(
            selectinload(Payment.student).selectinload(Student.parent),
            selectinload(Payment.receipt),
        )
        .where(Payment.id == payment_id, Payment.school_id == school_id)
    )
    payment = payment_result.scalar_one_or_none()
    if not payment or not payment.student or not payment.receipt:
        return

    parent = payment.student.parent
    recipient = None
    if parent:
        recipient = (
            parent.primary_email
            or parent.father_email
            or parent.mother_email
            or parent.guardian_email
        )
    recipient = recipient or payment.student.email
    if not recipient:
        return

    background_tasks.add_task(
        EmailService().send_fee_receipt_confirmation,
        to=recipient,
        school=school,
        student_name=payment.student.full_name,
        receipt_number=payment.receipt.receipt_number,
        amount=payment.amount,
        payment_mode=payment.payment_mode,
    )


async def _ensure_student_payment_access(
    db: AsyncSession,
    current_user: AuthenticatedUser,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
) -> None:
    if current_user.role in ("org:super_admin", "org:school_admin", "org:accounts"):
        return
    allowed = await _get_allowed_student_ids(db, current_user, school_id)
    if student_id not in allowed:
        raise HTTPException(status_code=403, detail="Access denied to this student")


async def _get_allowed_student_ids(
    db: AsyncSession,
    current_user: AuthenticatedUser,
    school_id: uuid.UUID,
) -> list[uuid.UUID]:
    if current_user.role == "org:student":
        result = await db.execute(
            select(Student.id).where(
                Student.school_id == school_id,
                Student.clerk_user_id == current_user.clerk_id,
                Student.is_active == True,
            )
        )
        return list(result.scalars().all())
    if current_user.role == "org:parent":
        result = await db.execute(
            select(Student.id)
            .join(Parent, Student.parent_id == Parent.id)
            .where(
                Student.school_id == school_id,
                Parent.school_id == school_id,
                Parent.clerk_user_id == current_user.clerk_id,
                Student.is_active == True,
            )
        )
        return list(result.scalars().all())
    return []


async def _load_payment_response(
    db: AsyncSession, school_id: uuid.UUID, payment_id: uuid.UUID
) -> dict:
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.student), selectinload(Payment.receipt))
        .where(Payment.id == payment_id, Payment.school_id == school_id)
    )
    payment = result.scalar_one()
    return _serialize_payment(payment)


def _serialize_payment(payment: Payment) -> dict:
    item = PaymentResponse.model_validate(payment).model_dump()
    item["student_name"] = payment.student.full_name if payment.student else None
    item["receipt_number"] = payment.receipt.receipt_number if payment.receipt else None
    return item


def _serialize_receipt(receipt: Receipt) -> dict:
    item = ReceiptResponse.model_validate(receipt).model_dump()
    item["student_name"] = receipt.student.full_name if receipt.student else None
    return item


def _build_receipt_pdf(receipt: Receipt, school: Optional[Organization]) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    school_name = school.name if school else "School"
    story = [
        Paragraph(f"<b>{school_name}</b>", styles["Title"]),
        Paragraph("Fee Receipt", styles["Heading2"]),
        Spacer(1, 14),
    ]
    student = receipt.student
    payment = receipt.payment
    rows = [
        ["Receipt No.", receipt.receipt_number],
        ["Student", student.full_name if student else ""],
        ["Admission No.", student.admission_number if student else ""],
        ["Receipt Date", receipt.receipt_date.strftime("%d %b %Y")],
        ["Amount", f"INR {receipt.amount:,.2f}"],
        ["Payment Mode", payment.payment_mode.title() if payment else ""],
        ["Transaction", payment.transaction_id if payment and payment.transaction_id else "-"],
    ]
    table = Table(rows, colWidths=[140, 330])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3f4f6")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("PADDING", (0, 0), (-1, -1), 9),
    ]))
    story.append(table)
    if receipt.fee_details:
        story.extend([Spacer(1, 16), Paragraph("<b>Fee Details</b>", styles["Heading3"])])
        breakdown = receipt.fee_details.get("breakdown") or {}
        detail_rows = [["Component", "Amount"]]
        detail_rows.extend([[name, f"INR {Decimal(str(amount)):,.2f}"] for name, amount in breakdown.items()])
        detail_table = Table(detail_rows, colWidths=[300, 170])
        detail_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#d1d5db")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("PADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(detail_table)
    story.extend([
        Spacer(1, 18),
        Paragraph(f"Amount in words: {receipt.amount_in_words or ''}", styles["Normal"]),
        Spacer(1, 24),
        Paragraph("This is a computer-generated receipt.", styles["Italic"]),
    ])
    doc.build(story)
    buffer.seek(0)
    return buffer
