import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def drop_alembic():
    url = os.getenv("DATABASE_URL")
    if not url:
        return
    
    # Strip asyncpg incompatible params
    if "?" in url:
        base, params = url.split("?", 1)
        filtered = "&".join(
            p for p in params.split("&")
            if not p.startswith("sslmode=") and not p.startswith("channel_binding=")
        )
        url = f"{base}?{filtered}" if filtered else base

    engine = create_async_engine(url, connect_args={"ssl": "require"})
    async with engine.begin() as conn:
        print("Dropping alembic_version table...")
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        print("Done.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(drop_alembic())
