from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
import psutil
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DevOps ChatOps API")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for demo purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---

class GreetingRequest(BaseModel):
    name: str

class GreetingResponse(BaseModel):
    message: str
    timestamp: str

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
    timestamp: str

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
        logger.warning(f"Docker socket not available: {e}")
        return [], f"unavailable ({type(e).__name__})"

# --- Endpoints ---

@app.post("/api/hello", response_model=GreetingResponse)
async def hello(request: GreetingRequest):
    logger.info(f"Greeting request: name={request.name}")
    return GreetingResponse(
        message=f"Hello {request.name}",
        timestamp=datetime.utcnow().isoformat() + "Z"
    )

@app.get("/api/status", response_model=SystemStatus)
async def status():
    """ChatOps endpoint: returns server metrics and Docker container info."""
    logger.info("Status check requested via /status command")

    # System metrics via psutil
    cpu = psutil.cpu_percent(interval=0.5)
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
async def health():
    """Simple health check endpoint for pipeline verification."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow().isoformat() + "Z"
    )
