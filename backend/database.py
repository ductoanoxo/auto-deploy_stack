import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

load_dotenv()

from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

# The user provided postgresql://... which we need to convert to postgresql+asyncpg://...
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres.vmbynsnwpmydsttxgsmv:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres")

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Disable prepared statements for compatibility with PgBouncer/Supabase pooler
if "prepared_statement_cache_size" not in DATABASE_URL:
    separator = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL += f"{separator}prepared_statement_cache_size=0&statement_cache_size=0"

# Obfuscate the password for logging
logger.info(f"Final DATABASE_URL (obfuscated): {DATABASE_URL.replace(os.getenv('DATABASE_URL','').split(':')[2].split('@')[0], '****') if '@' in DATABASE_URL else DATABASE_URL}")

from sqlalchemy.pool import NullPool

try:
    engine = create_async_engine(
        DATABASE_URL, 
        echo=True,
        connect_args={"statement_cache_size": 0},
        poolclass=NullPool
    )
except Exception as e:
    logger.error(f"Failed to create async engine: {e}")
    raise

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
