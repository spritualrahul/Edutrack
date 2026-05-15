"""Authentication & user management API routes.

Provides endpoints for:
- POST /auth/sync          — Sync current Clerk user to DB (called after sign-in)
- GET  /auth/me            — Get current user's profile + role + permissions
- POST /auth/webhook       — Clerk webhook for user.created / user.updated events
- POST /auth/assign-role   — Super-admin assigns role to a user
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import base64
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import AuthenticatedUser, get_authenticated_user, require_roles
from app.core.config import get_settings
from app.core.permissions import get_permissions_for_role
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import Role, User
from app.services.clerk_service import ClerkService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

SCHOOL_ADMIN_ASSIGNABLE_ROLES = {
    "org:accounts",
    "org:teacher",
    "org:parent",
    "org:student",
}
SCHOOL_BOUND_ROLES = {
    "org:school_admin",
    "org:accounts",
    "org:teacher",
    "org:parent",
    "org:student",
}
WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60
ROLE_ALIASES = {
    "org:super_admin": "org:super_admin",
    "super_admin": "org:super_admin",
    "super-admin": "org:super_admin",
    "super admin": "org:super_admin",
    "org:school_admin": "org:school_admin",
    "school_admin": "org:school_admin",
    "school-admin": "org:school_admin",
    "school admin": "org:school_admin",
    "org:accounts": "org:accounts",
    "accounts": "org:accounts",
    "accountant": "org:accounts",
    "fee-counter": "org:accounts",
    "fee_counter": "org:accounts",
    "org:teacher": "org:teacher",
    "teacher": "org:teacher",
    "org:parent": "org:parent",
    "parent": "org:parent",
    "org:student": "org:student",
    "student": "org:student",
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SyncResponse(BaseModel):
    user_id: str
    role: str
    school_id: Optional[str] = None
    permissions: list[str]
    first_name: str
    last_name: Optional[str] = None
    email: str
    is_new: bool = False


class AssignRoleRequest(BaseModel):
    clerk_id: str
    role: str
    school_id: Optional[str] = None


class MeResponse(BaseModel):
    user_id: str
    clerk_id: str
    email: str
    first_name: str
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    school_id: Optional[str] = None
    permissions: list[str]
    is_active: bool


def _normalize_role_name(role_name: Optional[str]) -> Optional[str]:
    if not role_name:
        return None
    return ROLE_ALIASES.get(str(role_name).strip().lower())


async def _resolve_school_identifier(
    school_identifier: Optional[str],
    db: AsyncSession,
) -> Optional[uuid.UUID]:
    """Resolve a Clerk school key.

    Clerk metadata may store the database UUID in `school_id`, or the
    human-friendly `organizations.unique_code` in `school_code`,
    `school_unique_code`, `unique_code`, or even `school_id`.
    """
    if not school_identifier:
        return None

    value = str(school_identifier).strip()
    filters = [Organization.unique_code == value.upper()]
    try:
        filters.append(Organization.id == uuid.UUID(value))
    except ValueError:
        pass

    condition = filters[0] if len(filters) == 1 else (filters[0] | filters[1])
    result = await db.execute(
        select(Organization.id).where(Organization.is_active == True, condition)
    )
    return result.scalar_one_or_none()


async def _resolve_role_from_metadata(
    metadata: dict,
    db: AsyncSession,
) -> tuple[Optional[Role], Optional[uuid.UUID]]:
    role_name = _normalize_role_name(metadata.get("role"))
    if not role_name:
        return None, None

    role_result = await db.execute(select(Role).where(Role.name == role_name))
    role = role_result.scalar_one_or_none()
    if not role:
        logger.warning("Ignoring unknown Clerk role from metadata: %s", role_name)
        return None, None

    if role_name == "org:super_admin":
        return role, None

    if role_name not in SCHOOL_BOUND_ROLES:
        return role, None

    school_key = (
        metadata.get("school_id")
        or metadata.get("school_code")
        or metadata.get("school_unique_code")
        or metadata.get("unique_code")
        or metadata.get("organization_code")
    )
    school_id = await _resolve_school_identifier(school_key, db)
    if not school_id:
        logger.warning("Ignoring school-bound Clerk role without valid school key: %s", role_name)
        return None, None

    return role, school_id


async def _apply_role_metadata_to_user(user: User, metadata: dict, db: AsyncSession) -> None:
    role, school_id = await _resolve_role_from_metadata(metadata, db)
    if not role:
        return

    current_role_name = _normalize_role_name(user.role.name if user.role else None)
    metadata_role_name = role.name

    if current_role_name and current_role_name != "org:student" and metadata_role_name != current_role_name:
        logger.info(
            "Ignoring Clerk metadata role '%s' for existing user %s with DB role '%s'",
            metadata_role_name,
            user.clerk_id,
            current_role_name,
        )
        return

    user.role_id = role.id
    user.school_id = school_id


async def _authoritative_clerk_metadata(current: CurrentUser) -> dict:
    """Resolve role metadata from the session token or Clerk Backend API.

    Clerk public metadata is not always present in the session token unless
    the Clerk JWT/session template includes it. The backend API read is
    authoritative and keeps existing DB users from getting stuck as students
    after their Clerk public metadata is changed to an admin role.
    """
    metadata = dict(current.metadata or {})

    try:
        clerk_data = await ClerkService().get_user(current.clerk_id)
    except Exception as exc:
        logger.warning("Could not fetch Clerk public metadata for %s: %s", current.clerk_id, exc)
        return metadata

    public_metadata = (
        clerk_data.get("public_metadata")
        or clerk_data.get("publicMetadata")
        or {}
    )
    if isinstance(public_metadata, dict):
        metadata.update(public_metadata)
    return metadata


async def _sync_clerk_metadata_from_user(user: User) -> None:
    """Keep Clerk metadata aligned with the DB-backed role."""
    if not user.role:
        return

    role_name = _normalize_role_name(user.role.name) or user.role.name

    try:
        await ClerkService().sync_user_metadata(
            clerk_id=user.clerk_id,
            role=role_name,
            school_id=str(user.school_id) if user.school_id else None,
        )
    except Exception as exc:
        logger.warning("Could not sync Clerk metadata from DB for %s: %s", user.clerk_id, exc)


async def _metadata_matches_user(metadata: dict, user: User, db: AsyncSession) -> bool:
    if not user.role:
        return False

    role_name = _normalize_role_name(metadata.get("role"))
    user_role_name = _normalize_role_name(user.role.name) or user.role.name
    if role_name != user_role_name:
        return False

    if role_name == "org:super_admin":
        return user.school_id is None

    if role_name in SCHOOL_BOUND_ROLES:
        school_key = (
            metadata.get("school_id")
            or metadata.get("school_code")
            or metadata.get("school_unique_code")
            or metadata.get("unique_code")
            or metadata.get("organization_code")
        )
        return await _resolve_school_identifier(school_key, db) == user.school_id

    return True


# ---------------------------------------------------------------------------
# Webhook security
# ---------------------------------------------------------------------------

def _decode_svix_secret(secret: str) -> bytes:
    """Decode Clerk/Svix webhook secret into raw HMAC bytes."""
    if secret.startswith("whsec_"):
        encoded = secret.split("_", 1)[1]
        encoded += "=" * (-len(encoded) % 4)
        return base64.b64decode(encoded)
    return secret.encode("utf-8")


def _verify_clerk_webhook_signature(
    body: bytes,
    svix_id: Optional[str],
    svix_timestamp: Optional[str],
    svix_signature: Optional[str],
    secret: str,
) -> None:
    if not all([svix_id, svix_timestamp, svix_signature]):
        raise HTTPException(status_code=400, detail="Missing webhook signature headers")

    try:
        timestamp = int(str(svix_timestamp))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook timestamp")

    if abs(time.time() - timestamp) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS:
        raise HTTPException(status_code=401, detail="Webhook timestamp is outside the allowed tolerance")

    signed_payload = f"{svix_id}.{svix_timestamp}.".encode("utf-8") + body
    expected = base64.b64encode(
        hmac.new(_decode_svix_secret(secret), signed_payload, hashlib.sha256).digest()
    ).decode("utf-8")

    received_signatures = [
        part.split(",", 1)[1]
        for part in svix_signature.split(" ")
        if part.startswith("v1,") and "," in part
    ]

    if not received_signatures or not any(
        hmac.compare_digest(expected, signature)
        for signature in received_signatures
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/sync", response_model=SyncResponse)
async def sync_user(
    current: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync the currently authenticated Clerk user to the local DB.

    Called by the frontend after sign-in. If the user doesn't exist in
    the DB yet, they are auto-provisioned with a default role.
    """
    metadata = await _authoritative_clerk_metadata(current)

    # Check if user already exists
    stmt = (
        select(User)
        .options(selectinload(User.role))
        .where(User.clerk_id == current.clerk_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    is_new = False

    if not user:
        # Auto-provision new user with default "org:student" role
        # (admin must later assign the correct role)
        default_role_stmt = select(Role).where(Role.name == "org:student")
        default_role_result = await db.execute(default_role_stmt)
        default_role = default_role_result.scalar_one_or_none()

        if not default_role:
            # If roles haven't been seeded yet, create a basic student role
            default_role = Role(
                name="org:student",
                display_name="Student",
                is_system=True,
            )
            db.add(default_role)
            await db.flush()

        # Try to get user details from Clerk
        clerk_email = current.email or f"{current.clerk_id}@placeholder.local"
        clerk_first_name = metadata.get("first_name", "New")
        clerk_last_name = metadata.get("last_name", "User")

        # Try fetching from Clerk API for better data
        try:
            clerk_svc = ClerkService()
            clerk_data = await clerk_svc.get_user(current.clerk_id)
            clerk_email = clerk_data.get("email_addresses", [{}])[0].get("email_address", clerk_email)
            clerk_first_name = clerk_data.get("first_name") or clerk_first_name
            clerk_last_name = clerk_data.get("last_name") or clerk_last_name
        except Exception as e:
            logger.warning("Could not fetch Clerk user data: %s", e)

        metadata_role, metadata_school_id = await _resolve_role_from_metadata(metadata, db)
        user = User(
            clerk_id=current.clerk_id,
            email=clerk_email,
            first_name=clerk_first_name,
            last_name=clerk_last_name,
            role_id=(metadata_role.id if metadata_role else default_role.id),
            school_id=metadata_school_id,
            is_active=True,
            metadata_={"auto_provisioned": True},
        )
        db.add(user)
        await db.flush()

        # Reload with role relationship
        stmt = (
            select(User)
            .options(selectinload(User.role))
            .where(User.id == user.id)
        )
        result = await db.execute(stmt)
        user = result.scalar_one()
        is_new = True

        # Sync role to Clerk metadata
        try:
            clerk_svc = ClerkService()
            await clerk_svc.sync_user_metadata(
                clerk_id=current.clerk_id,
                role=_normalize_role_name(user.role.name) or user.role.name,
                school_id=str(user.school_id) if user.school_id else None,
            )
        except Exception as e:
            logger.warning("Could not sync Clerk metadata on provision: %s", e)
    else:
        await _apply_role_metadata_to_user(user, metadata, db)
        await db.flush()
        stmt = (
            select(User)
            .options(selectinload(User.role))
            .where(User.id == user.id)
        )
        result = await db.execute(stmt)
        user = result.scalar_one()
        if not await _metadata_matches_user(metadata, user, db):
            await _sync_clerk_metadata_from_user(user)

    role_name = _normalize_role_name(user.role.name if user.role else None) or "org:student"
    permissions = list(get_permissions_for_role(role_name))

    return SyncResponse(
        user_id=str(user.id),
        role=role_name,
        school_id=str(user.school_id) if user.school_id else None,
        permissions=permissions,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        is_new=is_new,
    )


@router.get("/me", response_model=MeResponse)
async def get_me(
    user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """Get current user's full profile with role and permissions."""
    return MeResponse(
        user_id=str(user.user_id),
        clerk_id=user.clerk_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        school_id=str(user.school_id) if user.school_id else None,
        permissions=list(user.permissions),
        is_active=user.is_active,
    )


@router.post("/assign-role", response_model=SyncResponse)
async def assign_role(
    data: AssignRoleRequest,
    admin: AuthenticatedUser = Depends(require_roles("org:super_admin", "org:school_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a user. Only super_admin and school_admin can do this.

    School admins can only assign roles within their own school.
    Super admins can assign any role to any user.
    """
    # Validate the target role exists
    target_role_name = _normalize_role_name(data.role)
    if not target_role_name:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")

    role_stmt = select(Role).where(Role.name == target_role_name)
    role_result = await db.execute(role_stmt)
    target_role = role_result.scalar_one_or_none()

    if not target_role:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")

    if admin.role == "org:school_admin" and target_role_name not in SCHOOL_ADMIN_ASSIGNABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="School admins can only assign school-scoped staff, teacher, parent, and student roles.",
        )

    # Find the target user
    user_stmt = (
        select(User)
        .options(selectinload(User.role))
        .where(User.clerk_id == data.clerk_id)
    )
    user_result = await db.execute(user_stmt)
    target_user = user_result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in database.")

    requested_school_id = await _resolve_school_identifier(data.school_id, db)
    if data.school_id and not requested_school_id:
        raise HTTPException(status_code=400, detail="Invalid school id or unique code.")

    if target_role_name in SCHOOL_BOUND_ROLES:
        if admin.role == "org:school_admin":
            requested_school_id = admin.school_id
        if not requested_school_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="school_id is required for school-scoped roles.",
            )

    if admin.role == "org:school_admin":
        if requested_school_id != admin.school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="School admins can only manage users in their own school.",
            )
        if target_user.school_id not in (None, admin.school_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="School admins cannot modify users from another school.",
            )

    # Update role and school_id
    target_user.role_id = target_role.id
    if target_role_name == "org:super_admin":
        target_user.school_id = None  # Super admins are not school-bound
    else:
        target_user.school_id = requested_school_id

    await db.flush()

    # Sync to Clerk
    try:
        clerk_svc = ClerkService()
        await clerk_svc.sync_user_metadata(
            clerk_id=data.clerk_id,
            role=target_role_name,
            school_id=str(target_user.school_id) if target_user.school_id else None,
        )
    except Exception as e:
        logger.error("Failed to sync role to Clerk: %s", e)
        # Don't fail the request — DB is already updated

    permissions = list(get_permissions_for_role(target_role_name))

    return SyncResponse(
        user_id=str(target_user.id),
        role=target_role_name,
        school_id=str(target_user.school_id) if target_user.school_id else None,
        permissions=permissions,
        first_name=target_user.first_name,
        last_name=target_user.last_name,
        email=target_user.email,
        is_new=False,
    )


@router.post("/webhook")
async def clerk_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Clerk webhook events for user lifecycle.

    Supported events:
    - user.created   → auto-provision user in DB
    - user.updated   → sync metadata changes
    - user.deleted   → deactivate user
    """
    settings = get_settings()
    body = await request.body()

    if settings.CLERK_WEBHOOK_SECRET:
        _verify_clerk_webhook_signature(
            body=body,
            svix_id=request.headers.get("svix-id"),
            svix_timestamp=request.headers.get("svix-timestamp"),
            svix_signature=request.headers.get("svix-signature"),
            secret=settings.CLERK_WEBHOOK_SECRET,
        )
    elif settings.APP_ENV == "production" or settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=500, detail="Clerk webhook secret is not configured")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = payload.get("type")
    data = payload.get("data", {})

    logger.info("Clerk webhook: %s for user %s", event_type, data.get("id"))

    if event_type == "user.created":
        await _handle_user_created(data, db)
    elif event_type == "user.updated":
        await _handle_user_updated(data, db)
    elif event_type == "user.deleted":
        await _handle_user_deleted(data, db)

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Webhook handlers
# ---------------------------------------------------------------------------

async def _handle_user_created(data: dict, db: AsyncSession):
    """Auto-provision a new Clerk user in the local DB."""
    clerk_id = data.get("id")
    if not clerk_id:
        return

    # Check if already exists
    existing = await db.execute(select(User).where(User.clerk_id == clerk_id))
    if existing.scalar_one_or_none():
        return

    # Get default role
    default_role_result = await db.execute(select(Role).where(Role.name == "org:student"))
    default_role = default_role_result.scalar_one_or_none()

    if not default_role:
        default_role = Role(name="org:student", display_name="Student", is_system=True)
        db.add(default_role)
        await db.flush()

    email = (data.get("email_addresses") or [{}])[0].get("email_address", "")
    phone = (data.get("phone_numbers") or [{}])[0].get("phone_number", "")

    # Check if role was set in public_metadata during Clerk sign-up
    public_metadata = data.get("public_metadata", {})
    role_name = _normalize_role_name(public_metadata.get("role")) or "org:student"
    school_key = (
        public_metadata.get("school_id")
        or public_metadata.get("school_code")
        or public_metadata.get("school_unique_code")
        or public_metadata.get("unique_code")
        or public_metadata.get("organization_code")
    )
    school_id = await _resolve_school_identifier(school_key, db)

    # Resolve the role
    role_result = await db.execute(select(Role).where(Role.name == role_name))
    role = role_result.scalar_one_or_none() or default_role

    user = User(
        clerk_id=clerk_id,
        email=email,
        phone=phone or None,
        first_name=data.get("first_name") or "User",
        last_name=data.get("last_name"),
        avatar_url=data.get("image_url"),
        role_id=role.id,
        school_id=school_id,
        is_active=True,
        metadata_={"source": "clerk_webhook"},
    )
    db.add(user)
    await db.flush()
    logger.info("Provisioned user %s from webhook", clerk_id)


async def _handle_user_updated(data: dict, db: AsyncSession):
    """Sync updated Clerk user data to the local DB."""
    clerk_id = data.get("id")
    if not clerk_id:
        return

    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if not user:
        return

    # Update basic profile fields
    user.first_name = data.get("first_name") or user.first_name
    user.last_name = data.get("last_name") or user.last_name
    user.avatar_url = data.get("image_url") or user.avatar_url

    email = (data.get("email_addresses") or [{}])[0].get("email_address")
    if email:
        user.email = email

    await _apply_role_metadata_to_user(user, data.get("public_metadata") or {}, db)

    await db.flush()
    logger.info("Updated user %s from webhook", clerk_id)


async def _handle_user_deleted(data: dict, db: AsyncSession):
    """Deactivate a user when they're deleted from Clerk."""
    clerk_id = data.get("id")
    if not clerk_id:
        return

    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if user:
        user.is_active = False
        await db.flush()
        logger.info("Deactivated user %s from webhook", clerk_id)
