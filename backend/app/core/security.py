"""Security utilities for Clerk JWT validation and RBAC."""

from typing import Optional

import httpx
import jwt
from jwt.algorithms import RSAAlgorithm
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

security_scheme = HTTPBearer()

# Cache for JWKS keys
_jwks_cache: Optional[dict] = None

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


def normalize_role(role: Optional[str]) -> Optional[str]:
    if not role:
        return None
    return ROLE_ALIASES.get(str(role).strip().lower())


async def get_jwks() -> dict:
    """Fetch Clerk JWKS keys for JWT validation."""
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache

    settings = get_settings()
    async with httpx.AsyncClient() as client:
        response = await client.get(settings.CLERK_JWKS_URL)
        response.raise_for_status()
        _jwks_cache = response.json()
        return _jwks_cache


async def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk JWT token and return the claims."""
    settings = get_settings()

    try:
        jwks = await get_jwks()
        # Decode the token header to get the key ID
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        # Find the matching key
        rsa_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = RSAAlgorithm.from_jwk(key)
                break

        if not rsa_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find appropriate key",
            )

        # Decode and verify the token
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            issuer=settings.CLERK_ISSUER or None,
            options={"verify_iss": bool(settings.CLERK_ISSUER)},
        )
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


class CurrentUser:
    """Dependency for extracting current user from Clerk JWT."""

    def __init__(
        self,
        clerk_id: str,
        email: Optional[str],
        role: str,
        school_id: Optional[str],
        metadata: dict,
    ):
        self.clerk_id = clerk_id
        self.email = email
        self.role = role
        self.school_id = school_id
        self.metadata = metadata


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> CurrentUser:
    """Extract and validate the current user from the request.

    Clerk encodes public metadata into the session token under
    ``metadata``, ``public_metadata``, or ``publicMetadata`` depending on
    SDK/template configuration.
    """
    payload = await verify_clerk_token(credentials.credentials)

    metadata = payload.get("public_metadata") or payload.get("publicMetadata") or payload.get("metadata") or {}

    # Clerk sometimes nests user fields at top level
    email = payload.get("email") or metadata.get("email")

    return CurrentUser(
        clerk_id=payload.get("sub", ""),
        email=email,
        role=normalize_role(metadata.get("role")) or "org:student",
        school_id=metadata.get("school_id"),
        metadata=metadata,
    )


def require_role(*allowed_roles: str):
    """Dependency factory for role-based access control."""

    async def role_checker(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized. Required: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker


def require_school_access():
    """Ensure user has access to the requested school's data."""

    async def school_checker(
        request: Request,
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        # Super admins can access all schools
        if current_user.role == "org:super_admin":
            return current_user

        # Extract school_id from path or query
        school_id = request.path_params.get("school_id") or request.query_params.get(
            "school_id"
        )

        if school_id and current_user.school_id != school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this school's data",
            )

        return current_user

    return school_checker