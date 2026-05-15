"""Tenant isolation middleware.

Logs every request's tenant context (school_id) for auditing and attaches
tenant context to the request state for downstream handlers.
"""

from __future__ import annotations

import logging
import re
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

SCHOOL_PATH_RE = re.compile(
    r"/api/v\d+/schools/(?P<school_id>[0-9a-fA-F-]{36})(?:/|$)"
)


class TenantContextMiddleware(BaseHTTPMiddleware):
    """Extract tenant context from JWT claims and attach to request state.

    This middleware runs *after* CORS so it can read the Authorization
    header. It does NOT enforce access — enforcement is done in the
    FastAPI dependency layer (`require_school_access`). This middleware
    merely logs and attaches context for auditing.
    """

    # Paths that do NOT require tenant context
    EXCLUDED_PREFIXES = (
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
        "/api/health",
        "/api/v1/auth",
    )

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        # Skip non-API or public paths
        path = request.url.path
        if not path.startswith("/api") or any(path.startswith(p) for p in self.EXCLUDED_PREFIXES):
            return await call_next(request)

        match = SCHOOL_PATH_RE.search(path)
        school_id = match.group("school_id") if match else request.query_params.get("school_id")
        request.state.school_id = school_id

        response = await call_next(request)

        duration = time.time() - start_time
        logger.info(
            "tenant_request path=%s method=%s school_id=%s status=%s duration=%.3fs",
            path, request.method, school_id, response.status_code, duration,
        )

        return response
