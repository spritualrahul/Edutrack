"""Transactional email service backed by Resend."""

from __future__ import annotations

import asyncio
import html
import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Iterable, Optional

from app.core.config import get_settings
from app.models.organization import Organization

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class EmailDeliveryResult:
    sent: bool
    provider_id: Optional[str] = None
    reason: Optional[str] = None


class EmailService:
    """Sends tenant-aware transactional emails.

    Resend only accepts sender addresses from verified domains. For production,
    verify the school's domain in Resend and set RESEND_ALLOW_SCHOOL_FROM=true.
    Until then, the app sends from the platform sender and sets reply_to to the
    school's configured email.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    async def send_email(
        self,
        *,
        to: str | Iterable[str],
        subject: str,
        html_body: str,
        school: Optional[Organization] = None,
        text: Optional[str] = None,
    ) -> EmailDeliveryResult:
        recipients = self._normalize_recipients(to)
        if not recipients:
            return EmailDeliveryResult(sent=False, reason="No recipients")

        if not self.settings.RESEND_API_KEY:
            logger.info("Resend email skipped: RESEND_API_KEY is not configured")
            return EmailDeliveryResult(sent=False, reason="Resend is not configured")

        payload = {
            "from": self._sender_for_school(school),
            "to": recipients,
            "subject": subject,
            "html": html_body,
        }
        if text:
            payload["text"] = text
        if school and school.email and self.settings.RESEND_REPLY_TO_SCHOOL_EMAIL:
            payload["reply_to"] = school.email

        try:
            import resend

            resend.api_key = self.settings.RESEND_API_KEY
            response = await asyncio.to_thread(resend.Emails.send, payload)
            provider_id = response.get("id") if isinstance(response, dict) else None
            return EmailDeliveryResult(sent=True, provider_id=provider_id)
        except Exception as exc:  # pragma: no cover - provider/network failure path
            logger.exception("Resend email failed for subject %r", subject)
            return EmailDeliveryResult(sent=False, reason=str(exc))

    async def send_leave_request_to_admins(
        self,
        *,
        to: Iterable[str],
        school: Organization,
        teacher_name: str,
        leave_type: str,
        start_date: date,
        end_date: date,
        total_days: int,
        reason: str,
    ) -> EmailDeliveryResult:
        subject = f"Leave request from {teacher_name}"
        body = self._layout(
            school,
            title="New teacher leave request",
            intro=f"{teacher_name} has applied for {leave_type} leave.",
            rows={
                "Teacher": teacher_name,
                "Leave type": leave_type,
                "Dates": f"{start_date.isoformat()} to {end_date.isoformat()}",
                "Total days": str(total_days),
                "Reason": reason,
            },
            footer="Review this request in the School Admin leave approvals page.",
        )
        return await self.send_email(to=to, subject=subject, html_body=body, school=school)

    async def send_leave_decision_to_teacher(
        self,
        *,
        to: str,
        school: Organization,
        teacher_name: str,
        status: str,
        leave_type: str,
        start_date: date,
        end_date: date,
        rejection_reason: Optional[str] = None,
    ) -> EmailDeliveryResult:
        subject = f"Your leave request was {status}"
        rows = {
            "Teacher": teacher_name,
            "Status": status.title(),
            "Leave type": leave_type,
            "Dates": f"{start_date.isoformat()} to {end_date.isoformat()}",
        }
        if rejection_reason:
            rows["Reason"] = rejection_reason

        body = self._layout(
            school,
            title=f"Leave request {status}",
            intro=f"Your leave request at {school.name} has been {status}.",
            rows=rows,
            footer="This is an automated update from your school ERP.",
        )
        return await self.send_email(to=to, subject=subject, html_body=body, school=school)

    async def send_fee_receipt_confirmation(
        self,
        *,
        to: str,
        school: Organization,
        student_name: str,
        receipt_number: str,
        amount: Decimal,
        payment_mode: str,
    ) -> EmailDeliveryResult:
        subject = f"Fee receipt {receipt_number} from {school.name}"
        body = self._layout(
            school,
            title="Fee payment received",
            intro=f"We have received a fee payment for {student_name}.",
            rows={
                "Student": student_name,
                "Receipt number": receipt_number,
                "Amount": f"INR {amount}",
                "Payment mode": payment_mode.title(),
            },
            footer="Please keep this receipt number for your records.",
        )
        return await self.send_email(to=to, subject=subject, html_body=body, school=school)

    def _sender_for_school(self, school: Optional[Organization]) -> str:
        if self.settings.RESEND_ALLOW_SCHOOL_FROM and school and school.email:
            return self._format_sender(school.name, school.email)

        fallback_email = self.settings.RESEND_FROM_EMAIL or self.settings.EMAIL_FROM
        fallback_name = school.name if school else self.settings.RESEND_FROM_NAME
        return self._format_sender(fallback_name, fallback_email)

    @staticmethod
    def _format_sender(name: str, email: str) -> str:
        safe_name = " ".join((name or "EduStack").replace('"', "").split())
        return f"{safe_name} <{email}>"

    @staticmethod
    def _normalize_recipients(to: str | Iterable[str]) -> list[str]:
        if isinstance(to, str):
            candidates = [to]
        else:
            candidates = list(to)
        return sorted({email.strip() for email in candidates if email and email.strip()})

    @staticmethod
    def _layout(
        school: Organization,
        *,
        title: str,
        intro: str,
        rows: dict[str, str],
        footer: str,
    ) -> str:
        row_html = "".join(
            "<tr>"
            f"<td style='padding:10px 12px;color:#64748b;border-bottom:1px solid #e5e7eb'>{html.escape(label)}</td>"
            f"<td style='padding:10px 12px;color:#111827;border-bottom:1px solid #e5e7eb;font-weight:600'>{html.escape(value)}</td>"
            "</tr>"
            for label, value in rows.items()
        )
        return f"""
        <div style="margin:0;padding:24px;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#111827">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
            <div style="padding:24px;border-bottom:1px solid #eef2f7">
              <div style="font-size:13px;color:#4f46e5;font-weight:700">{html.escape(school.name)}</div>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3">{html.escape(title)}</h1>
              <p style="margin:12px 0 0;color:#475569;line-height:1.6">{html.escape(intro)}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">{row_html}</table>
            <div style="padding:18px 24px;color:#64748b;font-size:13px;line-height:1.6">{html.escape(footer)}</div>
          </div>
        </div>
        """
