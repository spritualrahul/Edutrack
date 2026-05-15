"""Small Razorpay integration wrapper.

All payment creation and signature verification stays server-side. The
frontend may receive a Razorpay order id, but it never confirms payment
without this service validating the webhook/checkout signature first.
"""

from __future__ import annotations

import hmac
import hashlib
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import get_settings


class RazorpayConfigurationError(RuntimeError):
    """Raised when Razorpay credentials are not configured."""


class RazorpayGatewayError(RuntimeError):
    """Raised when Razorpay rejects or times out a gateway request."""


class RazorpayService:
    """Create Razorpay orders and verify checkout signatures."""

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def is_configured(self) -> bool:
        return bool(self.settings.RAZORPAY_KEY_ID and self.settings.RAZORPAY_KEY_SECRET)

    async def create_order(
        self,
        *,
        amount_rupees: Decimal,
        receipt: str,
        notes: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not self.is_configured:
            raise RazorpayConfigurationError("Razorpay is not configured")

        amount_paise = int((amount_rupees * Decimal("100")).quantize(Decimal("1")))
        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt[:40],
            "payment_capture": 1,
            "notes": notes or {},
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    "https://api.razorpay.com/v1/orders",
                    json=payload,
                    auth=(self.settings.RAZORPAY_KEY_ID, self.settings.RAZORPAY_KEY_SECRET),
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            raise RazorpayGatewayError("Razorpay order creation failed") from exc

    def verify_signature(self, *, order_id: str, payment_id: str, signature: str) -> bool:
        if not self.is_configured:
            raise RazorpayConfigurationError("Razorpay is not configured")

        body = f"{order_id}|{payment_id}".encode("utf-8")
        digest = hmac.new(
            self.settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(digest, signature)
