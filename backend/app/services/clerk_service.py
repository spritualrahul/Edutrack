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


class ClerkService:
    """Interacts with the Clerk Backend API to manage user metadata."""

    BASE_URL = "https://api.clerk.com/v1"

    def __init__(self):
        settings = get_settings()
        self.secret_key = settings.CLERK_SECRET_KEY
        self._headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_user(self, clerk_id: str) -> dict:
        """Fetch a Clerk user by their ID."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/users/{clerk_id}",
                headers=self._headers,
            )
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

        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{self.BASE_URL}/users/{clerk_id}",
                headers=self._headers,
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
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/users",
                headers=self._headers,
                params={"limit": limit, "offset": offset},
            )
            resp.raise_for_status()
            return resp.json()
