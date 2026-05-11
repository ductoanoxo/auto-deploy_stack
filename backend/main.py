from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
import psutil
import logging
import sys
import hashlib
from pythonjsonlogger import jsonlogger
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from database import engine, Base, get_db
from models import User
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Configure structured JSON logging
logger = logging.getLogger()
logHandler = logging.StreamHandler(sys.stdout)
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(name)s %(message)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

app = FastAPI(title="DevOps ChatOps & CRUD API")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Prometheus Instrumentator
Instrumentator().instrument(app).expose(app)

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import os

# Configure OpenTelemetry Tracing
provider = TracerProvider()
# Read endpoint from env, default to Alloy HTTP port if not set
otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://alloy:4318/v1/traces")
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

FastAPIInstrumentor.instrument_app(app)

# --- Models & Schemas ---

class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str

class UserSchema(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class ContainerInfo(BaseModel):
    name: str
    status: str
    image: str

class SystemStatus(BaseModel):
    server_status: str
    cpu_percent: float
    ram_percent: float
    ram_used_mb: float
    ram_total_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_total_gb: float
    containers: List[ContainerInfo]
    docker_status: str
    timestamp: str

class HealthResponse(BaseModel):
    status: str
    db_status: str
    timestamp: str

# --- Startup ---

@app.on_event("startup")
async def startup():
    logger.info("Starting up backend application...")
    # Create tables in database
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified successfully")
    except Exception as e:
        logger.error(f"FATAL: Could not initialize database: {e}", extra={"error": str(e)})
        # We don't raise here so the app can at least start and serve health checks
        # even if it's in a broken state, which helps with debugging.
        # But in some cases, it might be better to crash.
        pass

# --- Helper ---

def get_docker_containers() -> tuple[list[ContainerInfo], str]:
    """Attempt to connect to Docker daemon and list running containers."""
    try:
        import docker
        client = docker.from_env()
        client.ping()
        containers = client.containers.list()
        container_list = [
            ContainerInfo(
                name=c.name,
                status=c.status,
                image=c.image.tags[0] if c.image.tags else str(c.image.id[:12])
            )
            for c in containers
        ]
        return container_list, "connected"
    except Exception as e:
        logger.warning(f"Docker socket not available", extra={"error": str(e)})
        return [], f"unavailable"

# --- User CRUD Endpoints ---

@app.get("/api/users", response_model=List[UserSchema])
async def read_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return users

@app.get("/api/users/{user_id}", response_model=UserSchema)
async def read_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@app.post("/api/users", response_model=UserSchema)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    db_user = User(
        username=user.username,
        email=user.email,
        full_name=user.full_name
    )
    db.add(db_user)
    try:
        await db.commit()
        await db.refresh(db_user)
        logger.info("New user created", extra={"user_id": db_user.id, "username": db_user.username})
        return db_user
    except IntegrityError as e:
        await db.rollback()
        error_detail = "Username or email already exists."
        if "username" in str(e.orig):
            error_detail = "Username already exists."
        elif "email" in str(e.orig):
            error_detail = "Email already exists."
        raise HTTPException(status_code=400, detail=error_detail)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

@app.put("/api/users/{user_id}", response_model=UserSchema)
async def update_user(user_id: int, user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.username = user.username
    db_user.email = user.email
    db_user.full_name = user.full_name
    
    try:
        await db.commit()
        await db.refresh(db_user)
        logger.info("User updated", extra={"user_id": user_id})
        return db_user
    except IntegrityError as e:
        await db.rollback()
        error_detail = "Username or email already exists."
        if "username" in str(e.orig):
            error_detail = "Username already exists."
        elif "email" in str(e.orig):
            error_detail = "Email already exists."
        raise HTTPException(status_code=400, detail=error_detail)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(db_user)
    await db.commit()
    logger.info("User deleted", extra={"user_id": user_id})
    return {"message": "User deleted"}

@app.get("/api/status", response_model=SystemStatus)
async def status():
    """ChatOps endpoint: returns server metrics and Docker container info."""
    logger.info("Status check requested via /status command")

    # System metrics via psutil
    cpu = psutil.cpu_percent(interval=0.1)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    # Docker container info
    containers, docker_status = get_docker_containers()

    return SystemStatus(
        server_status="running",
        cpu_percent=cpu,
        ram_percent=ram.percent,
        ram_used_mb=round(ram.used / (1024 ** 2), 1),
        ram_total_mb=round(ram.total / (1024 ** 2), 1),
        disk_percent=disk.percent,
        disk_used_gb=round(disk.used / (1024 ** 3), 1),
        disk_total_gb=round(disk.total / (1024 ** 3), 1),
        containers=containers,
        docker_status=docker_status,
        timestamp=datetime.utcnow().isoformat() + "Z"
    )

@app.get("/api/health", response_model=HealthResponse)
async def health(db: AsyncSession = Depends(get_db)):
    """Health check endpoint for pipeline verification."""
    db_status = "ok"
    try:
        await db.execute(select(1))
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return HealthResponse(
        status="ok",
        db_status=db_status,
        timestamp=datetime.utcnow().isoformat() + "Z"
    )

@app.get("/api/stress")
def stress(iterations: int = Query(default=1000000, le=5000000)):
    """
    Demo endpoint: giả lập CPU-intensive workload để trigger auto-scaling.
    Dùng 'def' thay vì 'async def' để FastAPI chạy trong thread pool,
    tránh block event loop và cho phép tận dụng đa nhân CPU.
    """
    # Pure Python arithmetic
    cpu_before = psutil.cpu_percent(interval=None)
    
    result = 1
    for i in range(1, iterations + 1):
        result = (result * i + i * i) % 999983
    
    cpu_after = psutil.cpu_percent(interval=0.1)

    return {
        "status": "ok",
        "iterations": iterations,
        "result_sample": result,
        "cpu_before": cpu_before,
        "cpu_after": cpu_after,
        "message": "CPU stress test completed"
    }
