# API Reference

Base URL (local): `http://localhost:8000`  
Versioned routes: `/api/v1/...`

Interactive docs: `/docs` (Swagger) and `/redoc`

---

## Health

### `GET /health`
### `GET /api/v1/health`

```json
{
  "status": "ok",
  "service": "ai-document-processing",
  "version": "0.1.0",
  "env": "development",
  "capabilities": {
    "ocr": true,
    "ai": true,
    "max_upload_size_mb": 20
  }
}
```

(`capabilities` is present on `/api/v1/health`.)

---

## Documents

Authenticated routes require:

```http
Authorization: Bearer <supabase_access_token>
```

### `POST /api/v1/documents/upload`

Extract text only (no auth). Multipart field: `file`.

### `POST /api/v1/documents/analyze`

Classify + summarize (+ optional `structured_data`). Multipart: `file`.

### `POST /api/v1/documents/ask`

Upload + ask in one request. Multipart: `file`, `question`.

### `POST /api/v1/documents/persist` 🔒

Store file, extract text, queue background AI analysis.  
Returns immediately with `status: "processing"`. Poll list/detail until `completed` or `failed`.

### `GET /api/v1/documents` 🔒

List the current user’s documents (newest first). Includes `status`, `error_message`, `retry_count`, `structured_data`.

### `GET /api/v1/documents/{id}` 🔒

Full detail including `extracted_text`.

### `GET /api/v1/documents/{id}/history` 🔒

Processing job history (`stage`, `status`, `attempt`, `error_message`, timestamps).

### `POST /api/v1/documents/{id}/retry` 🔒

Re-run analysis for a **failed** document (409 if not failed).

### `POST /api/v1/documents/{id}/ask` 🔒

Q&A against stored text. Returns 409 if still `processing`.

### `GET /api/v1/documents/{id}/export` 🔒

Download analysis JSON (`Content-Disposition: attachment`).

### `DELETE /api/v1/documents/{id}` 🔒

Delete DB row (jobs cascade) and storage object.

---

## Errors

| Status | Meaning |
|--------|---------|
| 400 | Bad request |
| 401 | Missing/invalid Bearer token |
| 404 | Document not found |
| 409 | Conflict (e.g. retry only when failed; Q&A while processing) |
| 413 | File or extracted text too large |
| 422 | Unsupported type / OCR/processing failure |
| 503 | Supabase not configured |
| 500 | Unexpected server error |

---

## Supported upload types

PDF, DOCX, TXT, MD, CSV, JSON, PNG, JPG, JPEG, TIFF, WEBP, BMP  
(Scanned PDFs and images use Tesseract when available.)
