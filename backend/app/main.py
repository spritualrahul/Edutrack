"""EduStack API - Main FastAPI application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.db.session import init_db, close_db
from app.api.v1.routers import organizations, students, fees, attendance, notices, leaves, ai, timetable
from app.api.v1.routers import auth as auth_router
from app.middleware.tenant import TenantContextMiddleware
from app.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tenant context middleware (runs after CORS)
app.add_middleware(TenantContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# Register API routers
API_V1_PREFIX = "/api/v1"
app.include_router(auth_router.router, prefix=API_V1_PREFIX)
app.include_router(organizations.router, prefix=API_V1_PREFIX)
app.include_router(students.router, prefix=API_V1_PREFIX)
app.include_router(fees.router, prefix=API_V1_PREFIX)
app.include_router(attendance.router, prefix=API_V1_PREFIX)
app.include_router(notices.router, prefix=API_V1_PREFIX)
app.include_router(leaves.router, prefix=API_V1_PREFIX)
app.include_router(ai.router, prefix=API_V1_PREFIX)
app.include_router(timetable.router, prefix=API_V1_PREFIX)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}
