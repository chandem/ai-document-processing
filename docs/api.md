# API Reference

Base URL (local): `http://localhost:8000`  
Versioned routes: `/api/v1/...`

Interactive docs: `/docs` (Swagger) and `/redoc`

---

## Health

### `GET /health`
### `GET /api/v1/health`

```json
{ "status": "ok", "service": "ai-document-processing", "version": "0.1.0", "env": "development" }
```

---

## Documents

All authenticated routes require:

```http
Authorization: Bearer <supabase_access_token>
```

### `POST /api/v1/documents/upload`

Extract text only (no auth). Multipart form field: `file`.

**Response**

```json
{
  "filename": "invoice.pdf",
  "content_type": "application/pdf",
  "status": "completed",
  "text": "...",
  "character_count": 1234,
  "word_count": 200,
  "created_at": "2026-09-22T12:00:00Z"
}
```

### `POST /api/v1/documents/analyze`

Classify + summarize (no auth). Multipart: `file`.

```json
{
  "filename": "invoice.pdf",
  "status": "completed",
  "category": "invoice",
  "confidence": 0.91,
  "summary": "..."
}
```

### `POST /api/v1/documents/ask`

Upload + ask in one request (no auth). Multipart: `file`, `question`.

```json
{ "question": "What is the total?", "answer": "..." }
```

### `POST /api/v1/documents/persist` 🔒

Store file in Supabase Storage, run full analysis, save metadata.

Multipart: `file` + Bearer token.

### `GET /api/v1/documents` 🔒

List the current user’s documents (newest first).

### `GET /api/v1/documents/{id}` 🔒

Document detail including `extracted_text` and `summary`.

### `POST /api/v1/documents/{id}/ask` 🔒

```json
{ "question": "Who is the vendor?" }
```

```json
{
  "document_id": "...",
  "question": "Who is the vendor?",
  "answer": "Acme Corp"
}
```

### `GET /api/v1/documents/{id}/export` 🔒

Download analysis as JSON (`Content-Disposition: attachment`).

### `DELETE /api/v1/documents/{id}` 🔒

Delete DB row and storage object.

---

## Errors

| Status | Meaning |
|--------|---------|
| 400 | Bad request (missing filename, empty question) |
| 401 | Missing/invalid Bearer token |
| 404 | Document not found |
| 413 | File too large |
| 422 | Unsupported type / OCR/processing failure |
| 503 | Supabase not configured |
| 500 | Unexpected server error (detail includes exception type) |

Example:

```json
{ "detail": "Supabase is not configured. Set SUPABASE_URL on the backend." }
```

---

## Supported upload types

PDF, DOCX, TXT, MD, CSV, JSON, PNG, JPG, JPEG, TIFF, WEBP, BMP  
(Scanned PDFs and images use Tesseract when available.)
