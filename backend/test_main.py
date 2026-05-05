from fastapi.testclient import TestClient
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
