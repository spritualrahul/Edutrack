"""Database session management with async SQLAlchemy (Neon Serverless PostgreSQL)."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()


def _get_neon_url(url: str) -> str:
    """Clean Neon DB URL for asyncpg compatibility.

    asyncpg doesn't support sslmode/channel_binding as URL params,
    so we strip them and handle SSL via connect_args instead.
    """
    # Remove query params that asyncpg doesn't understand
    if "?" in url:
        base, params = url.split("?", 1)
        filtered = "&".join(
            p for p in params.split("&")
            if not p.startswith("sslmode=") and not p.startswith("channel_binding=")
        )
        return f"{base}?{filtered}" if filtered else base
    return url


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


# Engine and session factory — initialized lazily in init_db()
engine = None
AsyncSessionLocal = None


def _create_engine():
    """Create the async engine. Called once at startup."""
    global engine, AsyncSessionLocal

    db_url = settings.DATABASE_URL
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Add it in your Render dashboard under Environment Variables."
        )

    # Ensure correct async driver prefix
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(
        _get_neon_url(db_url),
        echo=settings.DATABASE_ECHO,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={
            "ssl": "require",
        },
    )

    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_db() -> AsyncSession:
    """Dependency that provides an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database engine and tables."""
    _create_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Close database connections."""
    if engine:
        await engine.dispose()

