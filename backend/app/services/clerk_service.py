"""Clerk API service for syncing user metadata.

This service provides methods to:
- Sync role, school_id, and permissions to Clerk public_metadata
- Provision users in the local DB from Clerk webhook payloads
- Fetch Clerk user details
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.core.config import get_settings
from app.core.permissions import get_permissions_for_role

logger = logging.getLogger(__name__)

# Module-level persistent client — reuses TCP/TLS connections across requests
_shared_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    """Return the shared httpx client, creating it lazily."""
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        settings = get_settings()
        _shared_client = httpx.AsyncClient(
            base_url="https://api.clerk.com/v1",
            headers={
                "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(10.0, connect=5.0),
            # Keep connections alive for reuse (HTTP/2 where possible)
            http2=False,
        )
    return _shared_client


class ClerkService:
    """Interacts with the Clerk Backend API to manage user metadata."""

    def __init__(self):
        self._client = _get_client()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_user(self, clerk_id: str) -> dict:
        """Fetch a Clerk user by their ID."""
        resp = await self._client.get(f"/users/{clerk_id}")
        resp.raise_for_status()
        return resp.json()

    async def sync_user_metadata(
        self,
        clerk_id: str,
        role: str,
        school_id: Optional[str] = None,
        extra: Optional[dict] = None,
    ) -> dict:
        """Write role, school_id, and permissions into Clerk public_metadata.

        This ensures the Next.js frontend can read the role from the
        session token without hitting our API on every navigation.
        """
        permissions = list(get_permissions_for_role(role))

        public_metadata: dict[str, Any] = {
            "role": role,
            "school_id": str(school_id) if school_id else None,
            "permissions": permissions,
        }
        if extra:
            public_metadata.update(extra)

        payload = {"public_metadata": public_metadata}

        resp = await self._client.patch(
            f"/users/{clerk_id}",
            json=payload,
        )
        if resp.status_code != 200:
            logger.error(
                "Failed to sync Clerk metadata for %s: %s %s",
                clerk_id, resp.status_code, resp.text,
            )
            resp.raise_for_status()

        logger.info("Synced Clerk metadata for user %s (role=%s)", clerk_id, role)
        return resp.json()

    async def set_user_role(self, clerk_id: str, role: str, school_id: Optional[str] = None) -> dict:
        """Convenience wrapper: set role and school_id in Clerk metadata."""
        return await self.sync_user_metadata(clerk_id, role, school_id)

    async def list_users(self, limit: int = 100, offset: int = 0) -> list[dict]:
        """List Clerk users (for admin user management)."""
        resp = await self._client.get(
            "/users",
            params={"limit": limit, "offset": offset},
        )
        resp.raise_for_status()
        return resp.json()
