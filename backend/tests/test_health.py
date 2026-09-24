from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ai-document-processing"


def test_api_health_includes_capabilities():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "capabilities" in body
    caps = body["capabilities"]
    assert "ocr" in caps
    assert "ai" in caps
    assert isinstance(caps["ocr"], bool)
    assert isinstance(caps["ai"], bool)
    assert caps["max_upload_size_mb"] >= 1
