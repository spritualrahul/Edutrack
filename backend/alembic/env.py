"""Alembic environment configuration for async SQLAlchemy (Neon DB)."""
import asyncio
import os
import sys
from pathlib import Path
from logging.config import fileConfig

# Ensure the backend root is on sys.path so `app` package is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from DATABASE_URL env var if available
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)


def _clean_neon_url(url: str) -> str:
    """Strip asyncpg-incompatible params (sslmode, channel_binding) from URL."""
    if "?" in url:
        base, params = url.split("?", 1)
        filtered = "&".join(
            p for p in params.split("&")
            if not p.startswith("sslmode=") and not p.startswith("channel_binding=")
        )
        return f"{base}?{filtered}" if filtered else base
    return url


# Import all models for auto-generation
from app.models import Base
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    # Clean the URL for asyncpg compatibility
    section = config.get_section(config.config_ini_section, {})
    if "sqlalchemy.url" in section:
        section["sqlalchemy.url"] = _clean_neon_url(section["sqlalchemy.url"])

    connectable = async_engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"ssl": "require"},
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
