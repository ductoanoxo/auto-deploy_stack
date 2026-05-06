from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
import datetime

client = TestClient(app)

def test_hello_endpoint():
    response = client.post(
        "/api/hello",
        json={"name": "Alice"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["message"] == "Hello Alice"
    assert "timestamp" in data

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data

@patch("main.get_docker_containers")
def test_status_endpoint(mock_docker):
    """Test /api/status with mocked Docker client (no socket needed in CI)."""
    mock_docker.return_value = (
        [
            {"name": "backend", "status": "running", "image": "python:3.10-slim"},
            {"name": "frontend", "status": "running", "image": "node:18-alpine"},
        ],
        "connected"
    )
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    
    # System metrics should always be present
    assert "cpu_percent" in data
    assert "ram_percent" in data
    assert "disk_percent" in data
    assert "server_status" in data
    assert data["server_status"] == "running"
    
    # Docker info
    assert "containers" in data
    assert "docker_status" in data
    assert "timestamp" in data

@patch("main.get_docker_containers")
def test_status_without_docker(mock_docker):
    """Test /api/status gracefully handles missing Docker socket."""
    mock_docker.return_value = ([], "unavailable (ConnectionError)")
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["containers"] == []
    assert "unavailable" in data["docker_status"]
