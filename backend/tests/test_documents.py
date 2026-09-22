from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_upload_text_document():
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("hello.txt", b"Hello world from AI docs.", "text/plain")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["word_count"] == 5
    assert "Hello world" in body["text"]


def test_upload_rejects_unsupported_image():
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("scan.png", b"fake-image", "image/png")},
    )
    assert response.status_code == 422
