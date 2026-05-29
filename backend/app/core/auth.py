"""Enhanced authentication dependencies with DB-backed user resolution.

This module provides FastAPI dependency factories that:
1. Verify the Clerk JWT (via `verify_clerk_token`)
2. Resolve the caller to a database `User` row
3. Enforce role, permission, and tenant-scoping checks
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Optional, Sequence

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import Permission, get_permissions_for_role, has_permission
from app.core.security import CurrentUser, get_current_user, normalize_role
from app.db.session import get_db
from app.models.user import User


# ---------------------------------------------------------------------------
# Resolved user dataclass (enriched from DB)
# ---------------------------------------------------------------------------

@dataclass
class AuthenticatedUser:
    """A fully-resolved user combining JWT claims with DB state."""

    clerk_id: str
    user_id: uuid.UUID
    email: str
    first_name: str
    last_name: Optional[str]
    role: str
    school_id: Optional[uuid.UUID]
    permissions: frozenset[str] = field(default_factory=frozenset)
    is_active: bool = True
    metadata: dict = field(default_factory=dict)

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p)

    @property
    def is_super_admin(self) -> bool:
        return self.role == "org:super_admin"

    def has_permission(self, perm: str | Permission) -> bool:
        value = perm.value if isinstance(perm, Permission) else perm
        return value in self.permissions


# ---------------------------------------------------------------------------
# Core dependency: resolve JWT → DB user
# ---------------------------------------------------------------------------

async def get_authenticated_user(
    request: Request,
    current: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuthenticatedUser:
    """Resolve JWT claims to a database-backed user.

    Results are cached in request.state so multiple dependencies that
    depend on this function only trigger ONE database query per request.
    """
    # Return cached result if already resolved this request
    cached = getattr(request.state, "_authenticated_user", None)
    if cached is not None:
        return cached

    stmt = (
        select(User)
        .options(selectinload(User.role))
        .where(User.clerk_id == current.clerk_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not provisioned. Please contact your administrator.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    role_name = normalize_role(user.role.name if user.role else None) or "org:student"
    permissions = get_permissions_for_role(role_name)

    authenticated = AuthenticatedUser(
        clerk_id=user.clerk_id,
        user_id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=role_name,
        school_id=user.school_id,
        permissions=permissions,
        is_active=user.is_active,
        metadata=user.metadata_ or {},
    )

    # Cache on request state
    request.state._authenticated_user = authenticated
    return authenticated


# ---------------------------------------------------------------------------
# Dependency factories
# ---------------------------------------------------------------------------

def require_roles(*allowed_roles: str):
    """Dependency factory: require the user to have one of the given roles."""

    async def _checker(
        user: AuthenticatedUser = Depends(get_authenticated_user),
    ) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not authorized. Required: {', '.join(allowed_roles)}",
            )
        return user

    return _checker


def require_permissions(*perms: str | Permission):
    """Dependency factory: require the user to hold ALL given permissions."""

    async def _checker(
        user: AuthenticatedUser = Depends(get_authenticated_user),
    ) -> AuthenticatedUser:
        missing = [
            (p.value if isinstance(p, Permission) else p)
            for p in perms
            if not user.has_permission(p)
        ]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(missing)}",
            )
        return user

    return _checker


def require_school_access():
    """Ensure the user has access to the school identified in the URL.

    * super_admin → can access any school
    * others → school_id in URL must match their own school_id
    """

    async def _checker(
        request: Request,
        user: AuthenticatedUser = Depends(get_authenticated_user),
    ) -> AuthenticatedUser:
        if user.is_super_admin:
            return user

        # Try path params first, then query params
        school_id_str = request.path_params.get("school_id") or request.query_params.get("school_id")

        if school_id_str:
            try:
                requested_school = uuid.UUID(str(school_id_str))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid school_id format")

            if user.school_id != requested_school:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: you do not belong to this school.",
                )

        return user

    return _checker


def require_own_student_access():
    """For parent/student roles: ensure they can only access their own student data.

    Parents can only see students linked to their parent record.
    Students can only see their own data.
    """

    async def _checker(
        request: Request,
        user: AuthenticatedUser = Depends(get_authenticated_user),
        db: AsyncSession = Depends(get_db),
    ) -> AuthenticatedUser:
        # Super admin and school admin can see all
        if user.role in ("org:super_admin", "org:school_admin", "org:accounts", "org:teacher"):
            return user

        student_id_str = request.path_params.get("student_id")
        if not student_id_str:
            return user

        try:
            student_id = uuid.UUID(str(student_id_str))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid student_id format")

        if user.role == "org:student":
            # Student can only access own record
            from app.models.student import Student
            stmt = select(Student).where(
                Student.id == student_id,
                Student.school_id == user.school_id,
                Student.clerk_user_id == user.clerk_id,
            )
            result = await db.execute(stmt)
            if not result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Students can only access their own data.",
                )

        elif user.role == "org:parent":
            # Parent can only access their own children
            from app.models.student import Student
            from app.models.parent import Parent
            stmt = select(Student).join(Parent, Student.parent_id == Parent.id).where(
                Student.id == student_id,
                Student.school_id == user.school_id,
                Parent.school_id == user.school_id,
                Parent.clerk_user_id == user.clerk_id,
            )
            result = await db.execute(stmt)
            if not result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Parents can only access their own children's data.",
                )

        return user

    return _checker
