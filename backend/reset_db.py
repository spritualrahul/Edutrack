import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from app.models.base import Base

async def reset_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set")
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
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Done.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(reset_db())
