# API Reference

Base URL (local): `http://localhost:8000`  
Versioned routes: `/api/v1/...`  
Interactive docs: `/docs`

---

## Health

- `GET /health`
- `GET /api/v1/health` — includes `capabilities.ocr`, `capabilities.ai`

---

## Usage (free tier)

### `GET /api/v1/documents/usage` 🔒

```json
{
  "day": "2026-09-24",
  "uploads": 3,
  "asks": 12,
  "exports": 1,
  "limits": {
    "uploads_per_day": 50,
    "asks_per_day": 100,
    "exports_per_day": 50
  }
}
```

Exceeding a limit returns **429**.

---

## Documents

Auth header for 🔒 routes: `Authorization: Bearer <supabase_access_token>`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/documents/upload` | No | Extract text |
| POST | `/documents/analyze` | No | Classify + summarize |
| POST | `/documents/ask` | No | Upload + ask (+ citations) |
| POST | `/documents/persist` | Yes | Queue background analysis |
| GET | `/documents` | Yes | List |
| GET | `/documents/export.csv` | Yes | CSV of all docs (Excel-friendly) |
| GET | `/documents/{id}` | Yes | Detail |
| GET | `/documents/{id}/history` | Yes | Processing jobs |
| GET | `/documents/{id}/conversations` | Yes | Q&A threads |
| GET | `/documents/{id}/conversations/{cid}/messages` | Yes | Messages + citations |
| POST | `/documents/{id}/ask` | Yes | Q&A with citations + optional history |
| POST | `/documents/{id}/retry` | Yes | Retry failed |
| GET | `/documents/{id}/export` | Yes | JSON download |
| GET | `/documents/{id}/export.csv` | Yes | CSV download |
| GET | `/documents/export.xlsx` | Yes | Excel of all docs |
| GET | `/documents/{id}/export.xlsx` | Yes | Excel download |
| GET | `/documents/{id}/file-url` | Yes | Signed original-file URL |
| PATCH | `/documents/{id}` | Yes | Human correction |
| DELETE | `/documents/{id}` | Yes | Delete |

### Ask body (persisted document)

```json
{
  "question": "What is the total due?",
  "conversation_id": null,
  "save_history": true
}
```

### Ask response

```json
{
  "document_id": "...",
  "question": "What is the total due?",
  "answer": "The total amount due is 1,250 USD.",
  "citations": [
    { "index": 1, "snippet": "The total amount due is 1250 USD.", "score": 2.0 }
  ],
  "conversation_id": "...",
  "source": "llm"
}
```

### Correct document (human review)

`PATCH /api/v1/documents/{id}`

```json
{
  "category": "invoice",
  "summary": "Corrected summary text",
  "structured_data": { "total": "1250 USD" }
}
```

All fields optional; send only what you want to change.

---

## Errors

| Status | Meaning |
|--------|---------|
| 401 | Auth required / invalid token |
| 404 | Not found |
| 409 | Conflict (still processing / retry only when failed) |
| 413 | File or text too large |
| 422 | Processing failure |
| 429 | Daily free-tier quota exceeded |
| 503 | Supabase not configured |
