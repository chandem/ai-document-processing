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


def test_upload_markdown():
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("notes.md", b"# Title\n\nSome markdown body.", "text/markdown")},
    )
    assert response.status_code == 200
    assert "Title" in response.json()["text"]


def test_analyze_invoice_like_text():
    content = (
        b"Invoice number INV-100\n"
        b"Bill to: Acme Corp\n"
        b"Subtotal 500\nTax 50\nTotal due 550\n"
    )
    response = client.post(
        "/api/v1/documents/analyze",
        files={"file": ("invoice.txt", content, "text/plain")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["category"] in {"invoice", "other"}  # LLM or heuristic
    assert body["summary"]
    assert 0 <= body["confidence"] <= 1


def test_upload_rejects_corrupt_image():
    # Fake bytes should fail OCR / processing with 422
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("scan.png", b"not-a-real-image", "image/png")},
    )
    assert response.status_code == 422


def test_upload_rejects_empty_filename():
    response = client.post(
        "/api/v1/documents/upload",
        files={"file": ("", b"data", "text/plain")},
    )
    # Starlette may reject empty filename before our handler
    assert response.status_code in {400, 422}
