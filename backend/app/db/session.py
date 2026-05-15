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


# Neon serverless PostgreSQL requires SSL connections.
# Pool settings are tuned for serverless: smaller pool, shorter recycle time.
engine = create_async_engine(
    _get_neon_url(settings.DATABASE_URL),
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


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


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
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Close database connections."""
    await engine.dispose()
