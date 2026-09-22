# AI Document Processing — Architecture

## Product flow

```
User → React (Vite + MUI) → FastAPI → processing services → Supabase (Auth / Storage / Postgres)
                                      ↘ OpenAI (optional)
                                      ↘ Tesseract OCR (optional)
```

## Frontend

- React + TypeScript + Vite + Material UI
- Supabase Auth (email/password, password recovery)
- Dashboard with upload, document list, detail dialog
- In-dialog Q&A against stored documents
- Accepts PDF, DOCX, images, and text formats

## Backend

- Python 3.12 + FastAPI
- Document ingestion, size validation, multi-format extraction
- OCR provider interface + Tesseract implementation
- AI provider interface + OpenAI implementation (summarize, classify, extract, answer)
- Heuristic fallbacks when no API key is configured
- JWT auth via Supabase; service-role client for storage and DB writes

## Key modules

| Path | Responsibility |
|------|----------------|
| `backend/app/services/document_processor.py` | Text extraction + OCR fallback |
| `backend/app/services/ocr.py` | Tesseract / Unconfigured providers |
| `backend/app/services/intelligence.py` | Classify / summarize / analyze / Q&A |
| `backend/app/ai/provider.py` | OpenAI provider + factory |
| `backend/app/api/documents.py` | REST endpoints |
| `backend/app/core/config.py` | Settings from env |
| `backend/app/core/supabase.py` | Admin Supabase client |

## Data

- Supabase PostgreSQL — `documents` + `processing_jobs` tables (see `supabase/schema.sql`)
- Supabase Storage — private `documents` bucket
- Row Level Security on user-owned rows

## Deployment

| Layer | Target |
|-------|--------|
| Frontend | Vercel |
| Backend | Render (see `render.yaml`) |
| Auth / DB / Storage | Supabase |
| CI | GitHub Actions (`.github/workflows/`) |
