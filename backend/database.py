import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

load_dotenv()

from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

# The user provided postgresql://... which we need to convert to postgresql+asyncpg://...
# Lấy từ biến môi trường, nếu không có (như lúc chạy Test) thì dùng tạm sqlite
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    DATABASE_URL = "sqlite+aiosqlite:///./test.db"

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Disable prepared statements for compatibility with PgBouncer/Supabase pooler
if "prepared_statement_cache_size" not in DATABASE_URL:
    separator = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL += f"{separator}prepared_statement_cache_size=0&statement_cache_size=0"

# Obfuscate the password for logging safely
def obfuscate_url(url: str) -> str:
    try:
        if "@" in url:
            # Extract parts: protocol://user:pass@host
            protocol_part, rest = url.split("://", 1)
            credentials, host_part = rest.split("@", 1)
            if ":" in credentials:
                user, _ = credentials.split(":", 1)
                return f"{protocol_part}://{user}:****@{host_part}"
            return f"{protocol_part}://****@{host_part}"
        return url
    except Exception:
        return "DATABASE_URL (invalid format)"

logger.info(f"Connecting to database: {obfuscate_url(DATABASE_URL)}")

from sqlalchemy.pool import NullPool

try:
    engine = create_async_engine(
        DATABASE_URL, 
        echo=False,  # Set to False in prod to reduce noise, or True for debugging
        connect_args={"statement_cache_size": 0},
        poolclass=NullPool
    )
    logger.info("Async engine created successfully")
except Exception as e:
    logger.error(f"CRITICAL: Failed to create async engine: {e}")
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
